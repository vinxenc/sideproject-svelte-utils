import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RenameAlbumDialog from '#lib/components/albums/rename-album-dialog.svelte';
import { albumSummary } from '../../../helpers/albums.js';
import { deferred } from '../../../helpers/media.js';

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast }));

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const album = { id: 'a1', name: 'Trip' };

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

/** Types a name and submits the form, the way Enter does. */
async function submitName(name: string) {
	const input = screen.getByLabelText('Name');
	await fireEvent.input(input, { target: { value: name } });
	await fireEvent.submit(input.closest('form') as HTMLFormElement);
}

describe('RenameAlbumDialog', () => {
	it('shows the title and the field prefilled with the current name', async () => {
		render(RenameAlbumDialog, { props: { open: true, album, onrenamed: vi.fn() } });

		expect(await screen.findByText('Rename album')).toBeTruthy();
		expect(screen.getByText('Choose a new name for this album.')).toBeTruthy();
		await waitFor(() =>
			expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Trip')
		);
	});

	it('keeps Save disabled while the name is unchanged, and enables it after an edit', async () => {
		render(RenameAlbumDialog, { props: { open: true, album, onrenamed: vi.fn() } });
		const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
		await waitFor(() =>
			expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Trip')
		);
		expect(save.disabled).toBe(true);

		await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Holiday' } });
		expect(save.disabled).toBe(false);
	});

	it('refuses a name with a control character with a message and no request', async () => {
		render(RenameAlbumDialog, { props: { open: true, album, onrenamed: vi.fn() } });

		await submitName('a\tb');

		expect(await screen.findByText("Album names can't contain line breaks")).toBeTruthy();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('refuses a blank name with the inline message and no request, Save stays enabled', async () => {
		render(RenameAlbumDialog, { props: { open: true, album, onrenamed: vi.fn() } });

		await submitName('   ');

		expect(await screen.findByText('Enter an album name')).toBeTruthy();
		expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(
			false
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('renames to the trimmed name, closes, toasts, and reports the renamed album', async () => {
		const renamed = albumSummary({ id: 'a1', name: 'Holiday' });
		fetchMock.mockResolvedValue(json(renamed));
		const onrenamed = vi.fn();
		const open = { value: true };
		render(RenameAlbumDialog, {
			props: {
				get open() {
					return open.value;
				},
				set open(v: boolean) {
					open.value = v;
				},
				album,
				onrenamed
			}
		});

		await submitName('  Holiday  ');

		await waitFor(() => expect(onrenamed).toHaveBeenCalledWith(renamed));
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/albums/a1',
			expect.objectContaining({ method: 'PATCH' })
		);
		expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({ name: 'Holiday' });
		expect(toast.success).toHaveBeenCalledWith('Album renamed');
		expect(open.value).toBe(false);
	});

	it('shows the server message and stays open with the typed name when renaming fails', async () => {
		fetchMock.mockResolvedValue(json({ status: 404, message: 'Not found' }, 404));
		const onrenamed = vi.fn();
		render(RenameAlbumDialog, { props: { open: true, album, onrenamed } });

		await submitName('Holiday');

		expect(await screen.findByText('Not found')).toBeTruthy();
		expect(onrenamed).not.toHaveBeenCalled();
		expect(screen.getByRole('dialog')).toBeTruthy();
		expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Holiday');
	});

	it('uses a generic message when renaming fails without an error', async () => {
		fetchMock.mockRejectedValue('x');
		render(RenameAlbumDialog, { props: { open: true, album, onrenamed: vi.fn() } });

		await submitName('Holiday');

		expect(await screen.findByText('Something went wrong')).toBeTruthy();
	});

	it('disables Save while the request is pending', async () => {
		const pending = deferred<Response>();
		fetchMock.mockReturnValue(pending.promise);
		render(RenameAlbumDialog, { props: { open: true, album, onrenamed: vi.fn() } });

		await submitName('Holiday');

		expect((screen.getByRole('button', { name: /Save/ }) as HTMLButtonElement).disabled).toBe(true);
		pending.resolve(json(albumSummary({ name: 'Holiday' })));
	});

	it('reopens with the current name and no error after a cancelled edit', async () => {
		fetchMock.mockResolvedValue(json({ status: 400, message: 'Enter an album name' }, 400));
		const { rerender } = render(RenameAlbumDialog, {
			props: { open: true, album, onrenamed: vi.fn() }
		});
		await submitName('   ');
		expect(await screen.findByText('Enter an album name')).toBeTruthy();

		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		await rerender({ open: false, album, onrenamed: vi.fn() });
		await rerender({ open: true, album, onrenamed: vi.fn() });

		await waitFor(() =>
			expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Trip')
		);
		expect(screen.queryByText('Enter an album name')).toBeNull();
	});

	it('limits the name to the maximum length', async () => {
		render(RenameAlbumDialog, { props: { open: true, album, onrenamed: vi.fn() } });

		expect(screen.getByLabelText('Name').getAttribute('maxlength')).toBe('100');
	});
});
