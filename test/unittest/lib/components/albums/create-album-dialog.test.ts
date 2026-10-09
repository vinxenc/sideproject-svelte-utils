import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CreateAlbumDialog from '#lib/components/albums/create-album-dialog.svelte';
import { albumSummary } from '../../../helpers/albums.js';
import { deferred } from '../../../helpers/media.js';

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast }));

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

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

describe('CreateAlbumDialog', () => {
	it('opens from its + trigger and shows the title and description', async () => {
		render(CreateAlbumDialog, { props: { oncreated: vi.fn() } });

		await fireEvent.click(screen.getByRole('button', { name: 'New album' }));

		expect(await screen.findByRole('dialog')).toBeTruthy();
		expect(screen.getByText('Give it a name. You can add photos and videos next.')).toBeTruthy();
	});

	it('hides the trigger when it is asked to', () => {
		render(CreateAlbumDialog, { props: { showTrigger: false, oncreated: vi.fn() } });

		expect(screen.queryByRole('button', { name: 'New album' })).toBeNull();
	});

	it('keeps Create disabled until there is a name to create', async () => {
		render(CreateAlbumDialog, { props: { open: true, oncreated: vi.fn() } });

		const create = screen.getByRole('button', { name: 'Create' }) as HTMLButtonElement;
		expect(create.disabled).toBe(true);
		await fireEvent.input(screen.getByLabelText('Name'), { target: { value: '   ' } });
		expect(create.disabled).toBe(true);
	});

	it('refuses a blank name with a message and no request', async () => {
		render(CreateAlbumDialog, { props: { open: true, oncreated: vi.fn() } });

		await submitName('   ');

		expect(await screen.findByText('Enter an album name')).toBeTruthy();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('creates the trimmed album, closes, toasts, and reports it', async () => {
		const album = albumSummary({ id: 'a9', name: 'Trip' });
		fetchMock.mockResolvedValue(json(album, 201));
		const oncreated = vi.fn();
		const open = { value: true };
		render(CreateAlbumDialog, {
			props: {
				get open() {
					return open.value;
				},
				set open(v: boolean) {
					open.value = v;
				},
				oncreated
			}
		});

		await submitName('  Trip  ');

		await waitFor(() => expect(oncreated).toHaveBeenCalledWith(album));
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/albums',
			expect.objectContaining({ method: 'POST' })
		);
		expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({ name: 'Trip' });
		expect(toast.success).toHaveBeenCalledWith('Album created');
		expect(open.value).toBe(false);
	});

	it('shows the server message and stays open when creating fails', async () => {
		fetchMock.mockResolvedValue(
			json({ status: 400, message: 'Album names can be up to 100 characters' }, 400)
		);
		const oncreated = vi.fn();
		render(CreateAlbumDialog, { props: { open: true, oncreated } });

		await submitName('Trip');

		expect(await screen.findByText('Album names can be up to 100 characters')).toBeTruthy();
		expect(oncreated).not.toHaveBeenCalled();
		expect(screen.getByRole('dialog')).toBeTruthy();
	});

	it('uses a generic message when creating fails without an error', async () => {
		fetchMock.mockRejectedValue('boom');
		render(CreateAlbumDialog, { props: { open: true, oncreated: vi.fn() } });

		await submitName('Trip');

		expect(await screen.findByText('Something went wrong')).toBeTruthy();
	});

	it('sends only one request however often the form is submitted while it runs', async () => {
		const pending = deferred<Response>();
		fetchMock.mockReturnValue(pending.promise);
		render(CreateAlbumDialog, { props: { open: true, oncreated: vi.fn() } });

		await submitName('Trip');
		await submitName('Trip');
		await submitName('Trip');

		expect(fetchMock).toHaveBeenCalledTimes(1);
		pending.resolve(json(albumSummary(), 201));
	});

	it('limits the name to the maximum length', () => {
		render(CreateAlbumDialog, { props: { open: true, oncreated: vi.fn() } });

		expect(screen.getByLabelText('Name').getAttribute('maxlength')).toBe('100');
	});
});
