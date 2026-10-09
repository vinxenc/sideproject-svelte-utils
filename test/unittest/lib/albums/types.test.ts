import { describe, expect, it } from 'vitest';
import { ALBUM_NAME_MAX, checkAlbumName } from '#lib/albums/types.js';

describe('checkAlbumName', () => {
	it('trims the name and keeps spaces inside it', () => {
		expect(checkAlbumName('  Trip  ')).toEqual({ ok: true, name: 'Trip' });
		expect(checkAlbumName('Summer trip 2024')).toEqual({ ok: true, name: 'Summer trip 2024' });
	});

	it('accepts a name of exactly the maximum length', () => {
		const name = 'W'.repeat(ALBUM_NAME_MAX);
		expect(checkAlbumName(name)).toEqual({ ok: true, name });
	});

	it('rejects a name one character over the maximum', () => {
		expect(checkAlbumName('W'.repeat(ALBUM_NAME_MAX + 1))).toEqual({
			ok: false,
			error: 'Album names can be up to 100 characters'
		});
	});

	it.each(['', '   ', '\t \n'])('rejects the empty or blank name %j', (value) => {
		expect(checkAlbumName(value)).toEqual({ ok: false, error: 'Enter an album name' });
	});

	it.each([null, undefined, 42, { name: 'Trip' }, ['Trip']])(
		'rejects the non-string %j as an empty name',
		(value) => {
			expect(checkAlbumName(value)).toEqual({ ok: false, error: 'Enter an album name' });
		}
	);

	it.each(['Trip\nJune', 'Trip\tJune', 'Trip\u0000', 'Trip\u007f'])(
		'rejects control characters in %j',
		(value) => {
			expect(checkAlbumName(value)).toEqual({
				ok: false,
				error: "Album names can't contain line breaks"
			});
		}
	);

	it('allows duplicate names, which are simply stored', () => {
		expect(checkAlbumName('Trip').ok).toBe(true);
		expect(checkAlbumName('Trip').ok).toBe(true);
	});
});
