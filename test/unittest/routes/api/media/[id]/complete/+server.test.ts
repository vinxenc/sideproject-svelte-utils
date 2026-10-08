import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../../../../../../src/routes/api/media/[id]/complete/+server.js';
import { mediaRow } from '../../../../../helpers/media.js';

const db = vi.hoisted(() => ({
	media: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() }
}));
const storage = vi.hoisted(() => ({ head: vi.fn(), remove: vi.fn() }));
vi.mock('#lib/server/db.js', () => ({ prisma: db }));
vi.mock('#lib/server/storage.js', () => storage);

type Ev = Parameters<typeof POST>[0];

const MAX_THUMB_BYTES = 2 * 1024 * 1024;

function event(user: { id: string } | null = { id: 'u1' }): Ev {
	return {
		locals: { user },
		url: new URL('http://localhost/api/media/m1/complete'),
		params: { id: 'm1' },
		request: new Request('http://localhost/api/media/m1/complete', { method: 'POST' })
	} as unknown as Ev;
}

/** What S3 reports for each key: the original is 1000 bytes; the thumb is `thumb` (null = absent). */
function objects(original: { size: number } | null, thumb: { size: number } | null = null) {
	storage.head.mockImplementation(async (key: string) =>
		key.endsWith('/original') ? original : thumb
	);
}

beforeEach(() => {
	db.media.findFirst.mockReset().mockResolvedValue(mediaRow({ status: 'PENDING', size: 1000 }));
	db.media.update
		.mockReset()
		.mockImplementation(async ({ data }: { data: object }) =>
			mediaRow({ status: 'READY', ...data })
		);
	db.media.delete.mockReset().mockResolvedValue(mediaRow());
	storage.remove.mockReset().mockResolvedValue(undefined);
	objects({ size: 1000 });
});

describe('POST /api/media/:id/complete', () => {
	it('rejects signed-out callers with 401', async () => {
		await expect(POST(event(null))).rejects.toMatchObject({ status: 401 });
		expect(db.media.findFirst).not.toHaveBeenCalled();
	});

	it('answers 404 unless the caller owns a PENDING row with that id', async () => {
		db.media.findFirst.mockResolvedValue(null);

		await expect(POST(event())).rejects.toMatchObject({
			status: 404,
			body: { message: 'Not found' }
		});
		expect(db.media.findFirst).toHaveBeenCalledWith({
			where: { id: 'm1', userId: 'u1', status: 'PENDING' }
		});
	});

	it('answers 409 when the original was never uploaded', async () => {
		objects(null);

		await expect(POST(event())).rejects.toMatchObject({
			status: 409,
			body: { message: 'The file has not been uploaded' }
		});
		expect(db.media.update).not.toHaveBeenCalled();
	});

	it('deletes the upload and answers 422 when the stored size differs', async () => {
		objects({ size: 999 });

		await expect(POST(event())).rejects.toMatchObject({
			status: 422,
			body: { message: 'The uploaded file does not match its declared size' }
		});
		expect(storage.remove).toHaveBeenCalledWith('u1/m1/original', 'u1/m1/thumb');
		expect(db.media.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
		expect(storage.remove.mock.invocationCallOrder[0]).toBeLessThan(
			db.media.delete.mock.invocationCallOrder[0]
		);
		expect(db.media.update).not.toHaveBeenCalled();
	});

	it('marks the row READY without a thumb when none was uploaded', async () => {
		await POST(event());

		expect(db.media.update).toHaveBeenCalledWith({
			where: { id: 'm1' },
			data: { status: 'READY', hasThumb: false }
		});
		expect(storage.remove).not.toHaveBeenCalled();
	});

	it('keeps a thumb of exactly the maximum size', async () => {
		objects({ size: 1000 }, { size: MAX_THUMB_BYTES });

		await POST(event());

		expect(db.media.update).toHaveBeenCalledWith({
			where: { id: 'm1' },
			data: { status: 'READY', hasThumb: true }
		});
		expect(storage.remove).not.toHaveBeenCalled();
	});

	it('discards an oversized thumb and marks hasThumb false', async () => {
		objects({ size: 1000 }, { size: MAX_THUMB_BYTES + 1 });

		await POST(event());

		expect(storage.remove).toHaveBeenCalledWith('u1/m1/thumb');
		expect(db.media.update).toHaveBeenCalledWith({
			where: { id: 'm1' },
			data: { status: 'READY', hasThumb: false }
		});
	});

	it('returns the READY item as JSON, uncached', async () => {
		const res = await POST(event());

		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(await res.json()).toEqual({
			id: 'm1',
			kind: 'IMAGE',
			name: 'beach.jpg',
			width: 1600,
			height: 1200,
			duration: null,
			takenAt: '2024-05-01T10:00:00.000Z',
			hasThumb: false
		});
	});
});
