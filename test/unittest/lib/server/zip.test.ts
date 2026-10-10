import { BlobReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';
import { describe, expect, it, vi } from 'vitest';
import { attachment, safeFileName, uniqueNames, zipStream } from '#lib/server/zip.js';
import type { ZipEntry } from '#lib/server/zip.js';

const body = (text: string) => new Response(text).body as ReadableStream<Uint8Array>;
const entry = (name: string, text: string): ZipEntry => ({
	name,
	modified: new Date('2024-05-01T10:00:00.000Z'),
	open: async () => body(text)
});

/** The archive's entries, read back with a real ZIP reader. */
async function unzip(stream: ReadableStream<Uint8Array>) {
	const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
	const reader = new ZipReader(new BlobReader(new Blob([bytes])));
	const entries = await reader.getEntries();
	const files: Record<string, string> = {};
	for (const e of entries) {
		if (e.directory) continue;
		files[e.filename] = new TextDecoder().decode(await e.getData(new Uint8ArrayWriter()));
	}
	await reader.close();
	return files;
}

describe('zipStream', () => {
	it('builds an archive holding each file, in order', async () => {
		const files = await unzip(zipStream([entry('a.jpg', 'first'), entry('b.mp4', 'second')]));

		expect(files).toEqual({ 'a.jpg': 'first', 'b.mp4': 'second' });
	});

	it('errors the stream when a file cannot be read, instead of ending a truncated archive', async () => {
		const failing: ZipEntry = {
			name: 'bad.jpg',
			modified: new Date(),
			open: async () => {
				throw new Error('S3 GET failed: 500');
			}
		};

		await expect(
			new Response(zipStream([entry('a.jpg', 'first'), failing])).arrayBuffer()
		).rejects.toThrow('S3 GET failed: 500');
	});

	it('stops reading files when the consumer cancels', async () => {
		const open = vi.fn(async () => body('x'));
		const stream = zipStream([{ ...entry('a.jpg', 'x'), open }]);
		const reader = stream.getReader();
		await reader.read();

		await reader.cancel();

		expect(open).toHaveBeenCalledOnce();
	});
});

describe('safeFileName', () => {
	it('replaces separators and control characters', () => {
		expect(safeFileName('a/b\\c\nd.jpg')).toBe('a_b_c_d.jpg');
	});

	it.each(['', '  ', '.', '..'])('falls back for %j', (name) => {
		expect(safeFileName(name)).toBe('file');
		expect(safeFileName(name, 'album')).toBe('album');
	});
});

describe('uniqueNames', () => {
	it('numbers repeats before the extension and leaves the rest alone', () => {
		expect(
			uniqueNames(['a.jpg', 'b.jpg', 'a.jpg', 'a.jpg', 'notes', 'notes', '.env', '.env'])
		).toEqual([
			'a.jpg',
			'b.jpg',
			'a (2).jpg',
			'a (3).jpg',
			'notes',
			'notes (2)',
			'.env',
			'.env (2)'
		]);
	});

	it('never hands out a name twice, even when an upload is already called "a (2).jpg"', () => {
		const names = uniqueNames(['a.jpg', 'a.jpg', 'a (2).jpg', 'a (2).jpg']);

		expect(names).toEqual(['a.jpg', 'a (2).jpg', 'a (2) (2).jpg', 'a (2) (3).jpg']);
		expect(new Set(names).size).toBe(names.length);
	});

	it('treats names that differ only by case as the same name', () => {
		expect(uniqueNames(['IMG.JPG', 'img.jpg', 'Img.jpg'])).toEqual([
			'IMG.JPG',
			'img (2).jpg',
			'Img (3).jpg'
		]);
	});
});

describe('attachment', () => {
	it('gives an ASCII fallback and the real name as UTF-8', () => {
		expect(attachment('Trip "Đà Lạt".zip')).toBe(
			`attachment; filename="Trip ___ L_t_.zip"; filename*=UTF-8''${encodeURIComponent('Trip "Đà Lạt".zip')}`
		);
	});

	it("escapes ' ( ) * in the UTF-8 name, which encodeURIComponent leaves alone", () => {
		const header = attachment("Mom's (2024) *best* Đà Lạt.zip");

		expect(header).toBe(
			`attachment; filename="Mom's (2024) *best* __ L_t.zip"; filename*=UTF-8''Mom%27s%20%282024%29%20%2Abest%2A%20%C4%90%C3%A0%20L%E1%BA%A1t.zip`
		);
		expect(header.split("filename*=UTF-8''")[1]).toMatch(/^[A-Za-z0-9%._-]+$/);
	});
});
