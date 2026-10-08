import { flushSync } from 'svelte';
import { toast } from 'svelte-sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploads } from '#lib/media/uploads.svelte.js';

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
// jsdom can't decode media; a file "prepares" instantly with no thumbnail.
vi.mock('#lib/media/prepare.js', () => ({
	prepare: vi.fn(async () => ({
		takenAt: new Date(0),
		width: null,
		height: null,
		duration: null,
		thumb: null
	}))
}));

const photo = (name = 'a.jpg') => new File(['x'], name, { type: 'image/jpeg' });

afterEach(() => {
	uploads.close();
	vi.clearAllMocks();
});

describe('uploads', () => {
	it('rejects unsupported files with one toast and keeps the rest', () => {
		uploads.add([new File(['x'], 'doc.pdf'), new File([''], 'empty.png'), photo()]);
		expect(uploads.rows.map((r) => r.file.name)).toEqual(['a.jpg']);
		expect(toast.error).toHaveBeenCalledExactlyOnceWith('doc.pdf: Unsupported file type', {
			description: 'and 1 more skipped'
		});
	});

	it('moves a picked file from preview to ready once it is prepared', async () => {
		uploads.add([photo()]);
		expect(uploads.rows[0].stage).toBe('preview');
		await vi.waitFor(() => expect(uploads.rows[0].stage).toBe('ready'));
		expect(uploads.rows[0].previewUrl).toBeNull();
	});

	it('keeps pending in sync for effects as rows are added and removed', () => {
		const seen: number[] = [];
		const cleanup = $effect.root(() => {
			$effect(() => {
				seen.push(uploads.pending.length);
			});
		});
		flushSync();
		uploads.add([photo('a.jpg'), photo('b.jpg')]);
		flushSync();
		uploads.remove(uploads.rows[0]);
		flushSync();
		cleanup();
		expect(seen).toEqual([0, 2, 1]);
		expect(uploads.uploading).toBe(false);
	});
});
