import { BlobReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../../../../../../src/routes/api/albums/[id]/download/+server.js';

const db = vi.hoisted(() => ({
	album: { findFirst: vi.fn() },
	media: { findMany: vi.fn() }
}));
const storage = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('#lib/server/db.js', () => ({ prisma: db }));
vi.mock('#lib/server/storage.js', () => storage);

type Ev = Parameters<typeof GET>[0];

function event(user: { id: string } | null = { id: 'u1' }, id = 'a1'): Ev {
	return {
		locals: { user },
		url: new URL(`http://localhost/api/albums/${id}/download`),
		params: { id },
		request: new Request(`http://localhost/api/albums/${id}/download`)
	} as unknown as Ev;
}

const row = (id: string, name: string) => ({
	id,
	userId: 'u1',
	name,
	takenAt: new Date('2024-05-01T10:00:00.000Z')
});

beforeEach(() => {
	db.album.findFirst.mockReset().mockResolvedValue({ name: 'Trip' });
	db.media.findMany.mockReset().mockResolvedValue([row('m1', 'a.jpg'), row('m2', 'a.jpg')]);
	storage.get
		.mockReset()
		.mockImplementation(async (key: string) => new Response(`bytes of ${key}`).body);
});

describe('GET /api/albums/:id/download', () => {
	it('rejects signed-out callers with 401', async () => {
		await expect(GET(event(null))).rejects.toMatchObject({ status: 401 });
		expect(db.album.findFirst).not.toHaveBeenCalled();
	});

	it("answers 404 for an album that is not the caller's", async () => {
		db.album.findFirst.mockResolvedValue(null);

		await expect(GET(event())).rejects.toMatchObject({
			status: 404,
			body: { message: 'Not found' }
		});
		expect(db.album.findFirst).toHaveBeenCalledWith({
			where: { id: 'a1', userId: 'u1' },
			select: { name: true }
		});
	});

	it('answers 404 for an album with nothing in it', async () => {
		db.media.findMany.mockResolvedValue([]);

		await expect(GET(event())).rejects.toMatchObject({
			status: 404,
			body: { message: 'This album has no photos or videos' }
		});
	});

	it('fails the download when an original is missing from storage, instead of leaving it out', async () => {
		storage.get.mockImplementation(async (key: string) =>
			key === 'u1/m2/original' ? null : new Response('bytes').body
		);

		const res = await GET(event());

		await expect(res.arrayBuffer()).rejects.toThrow('The original of m2 is missing from storage');
	});

	it('streams the originals as a ZIP named after the album, with repeated names numbered', async () => {
		const res = await GET(event());

		expect(res.headers.get('content-type')).toBe('application/zip');
		expect(res.headers.get('content-disposition')).toContain('filename="Trip.zip"');
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(db.media.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: 'u1', status: 'READY', albums: { some: { albumId: 'a1' } } }
			})
		);

		const bytes = new Uint8Array(await res.arrayBuffer());
		const reader = new ZipReader(new BlobReader(new Blob([bytes])));
		const files: Record<string, string> = {};
		for (const e of await reader.getEntries()) {
			if (e.directory) continue;
			files[e.filename] = new TextDecoder().decode(await e.getData(new Uint8ArrayWriter()));
			expect(e.lastModDate.toISOString().startsWith('2024-05-01T')).toBe(true);
		}
		expect(files).toEqual({
			'a.jpg': 'bytes of u1/m1/original',
			'a (2).jpg': 'bytes of u1/m2/original'
		});
		expect(storage.get).toHaveBeenCalledWith('u1/m1/original');
	});
});
