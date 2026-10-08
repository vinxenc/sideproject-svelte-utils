import { describe, expect, it } from 'vitest';
import { checkMedia } from '#lib/media/types.js';

const MB = 1024 * 1024;
const file = (name: string, type: string, size = 1) => ({ name, type, size });

describe('checkMedia', () => {
	it('accepts a photo by its reported type', () => {
		expect(checkMedia(file('a.jpg', 'image/jpeg'))).toEqual({
			ok: true,
			contentType: 'image/jpeg',
			kind: 'IMAGE'
		});
	});

	it('normalises a reported type with parameters and casing', () => {
		expect(checkMedia(file('a.bin', 'Video/MP4; codecs="avc1"'))).toMatchObject({
			ok: true,
			contentType: 'video/mp4',
			kind: 'VIDEO'
		});
	});

	it('falls back to the extension when the browser reports no type', () => {
		expect(checkMedia(file('IMG_1.HEIC', ''))).toMatchObject({
			ok: true,
			contentType: 'image/heic'
		});
		expect(checkMedia(file('clip.mov', ''))).toMatchObject({ ok: true, kind: 'VIDEO' });
	});

	it('rejects unknown types, extension-less names and dotfiles', () => {
		const unsupported = { ok: false, error: 'Unsupported file type' };
		expect(checkMedia(file('doc.pdf', 'application/pdf'))).toEqual(unsupported);
		expect(checkMedia(file('README', ''))).toEqual(unsupported);
		expect(checkMedia(file('.jpg', ''))).toEqual(unsupported);
	});

	it('rejects empty files', () => {
		expect(checkMedia(file('a.png', 'image/png', 0))).toEqual({
			ok: false,
			error: 'The file is empty'
		});
	});

	it('enforces the per-kind size limits', () => {
		expect(checkMedia(file('a.png', 'image/png', 50 * MB)).ok).toBe(true);
		expect(checkMedia(file('a.png', 'image/png', 50 * MB + 1))).toEqual({
			ok: false,
			error: 'Photos can be up to 50 MB'
		});
		expect(checkMedia(file('a.mp4', 'video/mp4', 1024 * MB)).ok).toBe(true);
		expect(checkMedia(file('a.mp4', 'video/mp4', 1024 * MB + 1))).toEqual({
			ok: false,
			error: 'Videos can be up to 1 GB'
		});
	});
});
