import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import UploadTile from '#lib/components/media/upload-tile.svelte';
import { uploads } from '#lib/media/uploads.svelte.js';
import type { Row } from '#lib/media/uploads.svelte.js';

const row = (overrides: Partial<Row>): Row => ({
	key: 0,
	file: new File([new Uint8Array(1536)], 'beach.jpg', { type: 'image/jpeg' }),
	kind: 'IMAGE',
	prepared: new Promise(() => {}),
	previewUrl: null,
	duration: null,
	stage: 'ready',
	progress: 0,
	error: '',
	album: null,
	...overrides
});

describe('UploadTile', () => {
	it('shows the size of a file ready to upload and lets it be removed', async () => {
		const remove = vi.spyOn(uploads, 'remove').mockImplementation(() => {});
		const ready = row({ stage: 'ready' });
		render(UploadTile, { row: ready });
		expect(screen.getByText('beach.jpg')).toBeTruthy();
		expect(screen.getByText('1.5 KB')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Retry beach.jpg' })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Remove beach.jpg' }));
		expect(remove).toHaveBeenCalledWith(ready);
	});

	it('shows progress and hides the actions while uploading', () => {
		render(UploadTile, { row: row({ stage: 'uploading', progress: 0.42 }) });
		expect(screen.getByText('Uploading 42%')).toBeTruthy();
		expect(screen.getByRole('progressbar', { name: 'Uploading beach.jpg' })).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('shows the error and offers a retry after a failed upload', async () => {
		const run = vi.spyOn(uploads, 'run').mockResolvedValue();
		const failed = row({ stage: 'error', error: 'Upload failed (500)' });
		render(UploadTile, { row: failed });
		expect(screen.getByText('Upload failed (500)')).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Retry beach.jpg' }));
		expect(run).toHaveBeenCalledWith(failed);
	});

	it('shows the duration badge of a video and no actions once done', () => {
		render(UploadTile, { row: row({ kind: 'VIDEO', stage: 'done', duration: 75 }) });
		expect(screen.getByText('1:15')).toBeTruthy();
		expect(screen.getByText('Added · 1.5 KB')).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('says a picked file is being previewed, with a placeholder and a remove action', () => {
		const { container } = render(UploadTile, { row: row({ stage: 'preview' }) });
		expect(screen.getByText('Preparing preview')).toBeTruthy();
		expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
		expect(screen.getByRole('button', { name: 'Remove beach.jpg' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Retry beach.jpg' })).toBeNull();
	});

	it.each([
		['queued', 'Waiting'],
		['preparing', 'Preparing'],
		['finishing', 'Finishing']
	] as const)('shows the %s stage as "%s" with no actions', (stage, label) => {
		render(UploadTile, { row: row({ stage }) });
		expect(screen.getByText(label)).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('shows the thumbnail once one is ready', () => {
		const { container } = render(UploadTile, {
			row: row({ stage: 'ready', previewUrl: 'blob:p' })
		});
		expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:p');
	});

	it('shows a video icon and a duration-less badge for a video with no preview yet', () => {
		const { container } = render(UploadTile, {
			row: row({ kind: 'VIDEO', stage: 'ready', previewUrl: null, duration: null })
		});
		expect(container.querySelector('.lucide-video')).not.toBeNull();
		expect(container.querySelector('[data-slot="badge"]')).not.toBeNull();
		expect(container.querySelector('[data-slot="badge"]')?.textContent?.trim()).toBe('');
	});

	it('puts the error in the description tooltip', () => {
		const { container } = render(UploadTile, {
			row: row({ stage: 'error', error: 'Network error while uploading' })
		});
		expect(container.querySelector('[title="Network error while uploading"]')).not.toBeNull();
	});
});
