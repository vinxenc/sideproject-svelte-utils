import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../../../../../../src/routes/api/media/[id]/[variant]/+server.js';
import { mediaRow } from '../../../../../helpers/media.js';

const db = vi.hoisted(() => ({ media: { findFirst: vi.fn() } }));
const storage = vi.hoisted(() => ({ presignGet: vi.fn() }));
vi.mock('#lib/server/db.js', () => ({ prisma: db }));
vi.mock('#lib/server/storage.js', () => storage);

type Ev = Parameters<typeof GET>[0];

function event(variant: string, user: { id: string } | null = { id: 'u1' }, id = 'm1'): Ev {
	return {
		locals: { user },
		url: new URL(`http://localhost/api/media/${id}/${variant}`),
		params: { id, variant },
		request: new Request(`http://localhost/api/media/${id}/${variant}`)
	} as unknown as Ev;
}

beforeEach(() => {
	db.media.findFirst.mockReset().mockResolvedValue(mediaRow());
	storage.presignGet
		.mockReset()
		.mockImplementation(async (key: string) => `https://s3.test/${key}?get`);
});

describe('GET /api/media/:id/:variant', () => {
	it('rejects signed-out callers with 401', async () => {
		await expect(GET(event('original', null))).rejects.toMatchObject({ status: 401 });
		expect(db.media.findFirst).not.toHaveBeenCalled();
	});

	it('answers 404 for an unknown variant without looking the row up', async () => {
		await expect(GET(event('big'))).rejects.toMatchObject({
			status: 404,
			body: { message: 'Not found' }
		});
		expect(db.media.findFirst).not.toHaveBeenCalled();
	});

	it('answers 404 when the caller does not own a READY row with that id', async () => {
		db.media.findFirst.mockResolvedValue(null);

		await expect(GET(event('original'))).rejects.toMatchObject({ status: 404 });
		expect(db.media.findFirst).toHaveBeenCalledWith({
			where: { id: 'm1', userId: 'u1', status: 'READY' }
		});
	});

	it('answers 404 for a thumb that was never made', async () => {
		db.media.findFirst.mockResolvedValue(mediaRow({ hasThumb: false }));

		await expect(GET(event('thumb'))).rejects.toMatchObject({ status: 404 });
		expect(storage.presignGet).not.toHaveBeenCalled();
	});

	it('redirects an original to a one-hour presigned URL, uncached', async () => {
		const res = await GET(event('original'));

		expect(storage.presignGet).toHaveBeenCalledWith('u1/m1/original', 3600);
		expect(res.status).toBe(302);
		expect(res.headers.get('location')).toBe('https://s3.test/u1/m1/original?get');
		expect(res.headers.get('cache-control')).toBe('private, no-store');
	});

	it('redirects a thumb to its presigned URL', async () => {
		const res = await GET(event('thumb'));

		expect(storage.presignGet).toHaveBeenCalledWith('u1/m1/thumb', 3600);
		expect(res.headers.get('location')).toBe('https://s3.test/u1/m1/thumb?get');
	});
});
