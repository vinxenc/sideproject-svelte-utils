import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { toast } from 'svelte-sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UploadDialog from '#lib/components/media/upload-dialog.svelte';
import { uploadMedia } from '#lib/media/upload.js';
import { uploads } from '#lib/media/uploads.svelte.js';
import { deferred, mediaItem } from '../../../helpers/media.js';

vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('#lib/media/prepare.js', () => ({
	prepare: vi.fn(async () => ({
		takenAt: new Date(0),
		width: null,
		height: null,
		duration: null,
		thumb: null
	}))
}));
vi.mock('#lib/media/upload.js', () => ({ uploadMedia: vi.fn() }));
vi.mock('#lib/components/media/camera-capture.svelte', async () => ({
	default: (await import('../../../helpers/camera-capture-stub.svelte')).default
}));

const ITEM = mediaItem();
const photo = (name = 'a.jpg') => new File(['x'], name, { type: 'image/jpeg' });

beforeEach(() => {
	vi.mocked(uploadMedia).mockReset().mockResolvedValue(ITEM);
});

afterEach(() => {
	uploads.close();
	cleanup();
});

/** Renders the dialog closed. */
function setup() {
	const onuploaded = vi.fn();
	const result = render(UploadDialog, { onuploaded });
	return { ...result, onuploaded };
}

async function openDialog() {
	await fireEvent.click(screen.getByRole('button', { name: 'Add photos and videos' }));
	await screen.findByText('Add to gallery');
}

/** Picks files through the hidden file input, as the Library button does. */
async function pick(...files: File[]) {
	const input = document.querySelector('input[type="file"]') as HTMLInputElement;
	await fireEvent.change(input, { target: { files } });
	return input;
}

const zone = () => screen.getByRole('dialog').querySelector('[role="presentation"]') as HTMLElement;

describe('UploadDialog opening', () => {
	it('opens from the add button and titles itself', async () => {
		setup();

		await openDialog();

		expect(screen.getByText('Add to gallery')).toBeTruthy();
	});

	it('detaches from the store when unmounted, and closes', async () => {
		const attach = vi.spyOn(uploads, 'attach');
		const { unmount, onuploaded } = setup();
		await openDialog();
		expect(uploads.open).toBe(true);

		unmount();

		expect(attach).toHaveBeenCalledWith(onuploaded);
		expect(uploads.open).toBe(false);
	});
});

describe('UploadDialog library', () => {
	it('opens the file picker from the Library button', async () => {
		const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
		setup();
		await openDialog();

		await fireEvent.click(screen.getByRole('button', { name: 'Library' }));

		expect(click).toHaveBeenCalled();
	});

	it('adds a picked file, counts it on Submit, and clears the picker', async () => {
		setup();
		await openDialog();

		const input = await pick(photo());

		expect(screen.getByText('a.jpg')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Submit (1)' })).toBeTruthy();
		expect(input.value).toBe('');
	});
});

describe('UploadDialog submitting', () => {
	it('shows the uploading state, locks the sources, and closes with a toast when done', async () => {
		const upload = deferred<typeof ITEM>();
		vi.mocked(uploadMedia).mockReturnValueOnce(upload.promise);
		const { onuploaded } = setup();
		await openDialog();
		await pick(photo());
		await fireEvent.click(await screen.findByRole('button', { name: 'Submit (1)' }));

		expect(screen.getByText('Uploading photos and videos')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Hide' })).toBeTruthy();
		expect(screen.getByText('Uploading')).toBeTruthy();
		expect((screen.getByRole('button', { name: 'Library' }) as HTMLButtonElement).disabled).toBe(
			true
		);
		expect((screen.getByRole('button', { name: 'Camera' }) as HTMLButtonElement).disabled).toBe(
			true
		);

		upload.resolve(ITEM);

		await waitFor(() => expect(screen.queryByText('Add to gallery')).toBeNull());
		expect(toast.success).toHaveBeenCalledWith('Added 1 item to the gallery');
		expect(onuploaded).toHaveBeenCalledWith(ITEM, null);
	});

	it('cancelling forgets the selection and closes', async () => {
		setup();
		await openDialog();
		await pick(photo());

		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(uploads.rows).toHaveLength(0);
		await waitFor(() => expect(screen.queryByText('Add to gallery')).toBeNull());
	});
});

describe('UploadDialog drop zone', () => {
	it('takes over the drag so the browser does not open the file', async () => {
		setup();
		await openDialog();

		expect(await fireEvent.dragOver(zone())).toBe(false);
	});

	it('adds dropped files', async () => {
		setup();
		await openDialog();

		await fireEvent.drop(zone(), { dataTransfer: { files: [photo()] } });

		expect(screen.getByText('a.jpg')).toBeTruthy();
	});

	it('ignores a drop that carries no data', async () => {
		setup();
		await openDialog();

		await fireEvent.drop(zone());

		expect(uploads.rows).toHaveLength(0);
	});

	it('ignores a drop while uploads are running', async () => {
		const upload = deferred<typeof ITEM>();
		vi.mocked(uploadMedia).mockReturnValueOnce(upload.promise);
		setup();
		await openDialog();
		await pick(photo('a.jpg'));
		await fireEvent.click(await screen.findByRole('button', { name: 'Submit (1)' }));

		await fireEvent.drop(zone(), { dataTransfer: { files: [photo('b.jpg')] } });
		expect(uploads.rows.map((r) => r.file.name)).toEqual(['a.jpg']);

		upload.resolve(ITEM);
		await waitFor(() => expect(uploads.uploading).toBe(false));
	});
});

describe('UploadDialog camera', () => {
	it('adds the photo the camera takes', async () => {
		setup();
		await openDialog();

		await fireEvent.click(screen.getByRole('button', { name: 'Camera' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Stub capture' }));

		expect(screen.getByText('shot.jpg')).toBeTruthy();
	});

	it('leaves the camera when its close is pressed', async () => {
		setup();
		await openDialog();
		await fireEvent.click(screen.getByRole('button', { name: 'Camera' }));

		await fireEvent.click(screen.getByRole('button', { name: 'Stub close' }));

		expect(screen.queryByRole('button', { name: 'Stub capture' })).toBeNull();
		expect(screen.getByText('Add to gallery')).toBeTruthy();
	});

	it('uses Escape to leave the camera first, then to close the dialog', async () => {
		setup();
		await openDialog();
		await pick(photo());
		await fireEvent.click(screen.getByRole('button', { name: 'Camera' }));

		await fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

		expect(screen.queryByRole('button', { name: 'Stub capture' })).toBeNull();
		expect(screen.getByText('Add to gallery')).toBeTruthy();

		await fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

		await waitFor(() => expect(screen.queryByText('Add to gallery')).toBeNull());
		expect(uploads.rows).toHaveLength(0);
	});
});

describe('UploadDialog in an album', () => {
	it('titles the dialog for the album, and labels the add button with it', async () => {
		render(UploadDialog, { onuploaded: vi.fn(), album: { id: 'a1', name: 'Trip' } });

		await fireEvent.click(screen.getByRole('button', { name: 'Add photos and videos to Trip' }));

		expect(await screen.findByText('Add to "Trip"')).toBeTruthy();
		expect(
			screen.getByText('New photos and videos go into this album and your library.')
		).toBeTruthy();
	});

	it('sends the picked files into the album', async () => {
		render(UploadDialog, { onuploaded: vi.fn(), album: { id: 'a1', name: 'Trip' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Add photos and videos to Trip' }));
		await screen.findByText('Add to "Trip"');

		await pick(photo());

		expect(uploads.rows[0].album).toEqual({ id: 'a1', name: 'Trip' });
	});

	it('hides the round add button while the gallery is selecting, but keeps the dialog mounted', () => {
		render(UploadDialog, { onuploaded: vi.fn(), hideTrigger: true });

		expect(screen.getByRole('button', { name: 'Add photos and videos' }).className).toContain(
			'hidden'
		);
	});
});
