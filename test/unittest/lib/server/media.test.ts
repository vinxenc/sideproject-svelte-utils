import { describe, expect, it } from 'vitest';
import { MAX_THUMB_BYTES, NO_STORE, originalKey, thumbKey, toItem } from '#lib/server/media.js';
import { mediaRow } from '../../helpers/media.js';

describe('media helpers', () => {
	it('builds the object keys under the owner prefix', () => {
		const row = mediaRow({ id: 'm1', userId: 'u1' });

		expect(originalKey(row)).toBe('u1/m1/original');
		expect(thumbKey(row)).toBe('u1/m1/thumb');
	});

	it('caps thumbnails at 2 MiB', () => {
		expect(MAX_THUMB_BYTES).toBe(2 * 1024 * 1024);
	});

	it('marks responses as private and not storable', () => {
		expect(NO_STORE).toEqual({ 'cache-control': 'private, no-store' });
	});

	it('maps a row to the public item, with takenAt as ISO text', () => {
		const item = toItem(
			mediaRow({
				id: 'v1',
				kind: 'VIDEO',
				name: 'clip.mp4',
				width: 1280,
				height: 720,
				duration: 4.5,
				takenAt: new Date('2024-05-01T10:00:00.000Z'),
				hasThumb: false,
				userId: 'u1',
				size: 9,
				status: 'READY',
				contentType: 'video/mp4'
			})
		);

		expect(item).toEqual({
			id: 'v1',
			kind: 'VIDEO',
			name: 'clip.mp4',
			width: 1280,
			height: 720,
			duration: 4.5,
			takenAt: '2024-05-01T10:00:00.000Z',
			hasThumb: false
		});
		expect(Object.keys(item)).toHaveLength(8);
	});
});
