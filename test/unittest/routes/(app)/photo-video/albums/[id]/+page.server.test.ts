import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load } from '../../../../../../../src/routes/(app)/photo-video/albums/[id]/+page.server.js';
import { albumSummary } from '../../../../../helpers/albums.js';

const albums = vi.hoisted(() => ({ getAlbumSummary: vi.fn() }));
vi.mock('#lib/server/albums.js', () => albums);

type Ev = Parameters<typeof load>[0];

function event(user: { id: string } | null = { id: 'u1' }, id = 'a1') {
	const setHeaders = vi.fn();
	return {
		event: { locals: { user }, params: { id }, setHeaders } as unknown as Ev,
		setHeaders
	};
}

beforeEach(() => {
	albums.getAlbumSummary.mockReset().mockResolvedValue(albumSummary({ id: 'a1', name: 'Trip' }));
});

describe('album page load', () => {
	it('sends signed-out callers to sign-in', async () => {
		const { event: ev } = event(null);

		await expect(load(ev)).rejects.toMatchObject({ status: 303, location: '/sign-in' });
		expect(albums.getAlbumSummary).not.toHaveBeenCalled();
	});

	it("answers 404 when the album is not the caller's or does not exist", async () => {
		albums.getAlbumSummary.mockResolvedValue(null);
		const { event: ev } = event();

		await expect(load(ev)).rejects.toMatchObject({
			status: 404,
			body: { message: 'Album not found' }
		});
		expect(albums.getAlbumSummary).toHaveBeenCalledWith('u1', 'a1');
	});

	it('returns the album, and keeps the page out of the cache', async () => {
		const { event: ev, setHeaders } = event();

		const data = await load(ev);

		expect(data).toEqual({ album: albumSummary({ id: 'a1', name: 'Trip' }) });
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
	});
});
