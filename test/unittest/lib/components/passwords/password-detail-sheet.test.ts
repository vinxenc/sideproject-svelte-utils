import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordDetailSheet from '#lib/components/passwords/password-detail-sheet.svelte';
import { deferred } from '../../../helpers/media.js';
import { passwordItem } from '../../../helpers/passwords.js';

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const nav = vi.hoisted(() => ({ invalidateAll: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('$app/navigation', () => nav);
vi.mock('svelte-sonner', () => ({ toast }));

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

const deleteButton = () => screen.getByRole('button', { name: 'Delete' });
const confirmButton = () => screen.getByRole('button', { name: /Delete password/ });

describe('PasswordDetailSheet', () => {
	it('shows the name, type, username, dots and the added date', () => {
		render(PasswordDetailSheet, {
			props: { item: passwordItem(), open: true, ondelete: vi.fn() }
		});

		expect(screen.getByRole('heading', { name: 'GitHub' })).toBeTruthy();
		expect(screen.getByText('App')).toBeTruthy();
		expect(screen.getByText('ada@example.com')).toBeTruthy();
		expect(screen.getByText('••••••••')).toBeTruthy();
		expect(
			screen.getByText(
				new Date('2024-05-01T10:00:00.000Z').toLocaleDateString(undefined, { dateStyle: 'medium' })
			)
		).toBeTruthy();
	});

	it('shows a dash when the entry has no username', () => {
		render(PasswordDetailSheet, {
			props: { item: passwordItem({ username: null }), open: true, ondelete: vi.fn() }
		});

		expect(screen.getByText('—')).toBeTruthy();
	});

	it('opens a confirm dialog from Delete and keeps everything on Cancel', async () => {
		const ondelete = vi.fn();
		render(PasswordDetailSheet, {
			props: { item: passwordItem(), open: true, ondelete }
		});

		await fireEvent.click(deleteButton());
		expect(await screen.findByText('Delete "GitHub"?')).toBeTruthy();

		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

		await waitFor(() => expect(screen.queryByText('Delete "GitHub"?')).toBeNull());
		expect(ondelete).not.toHaveBeenCalled();
		expect(screen.getByRole('heading', { name: 'GitHub' })).toBeTruthy();
	});

	it('calls ondelete on confirm and closes the dialog when it resolves true', async () => {
		const item = passwordItem();
		const ondelete = vi.fn().mockResolvedValue(true);
		render(PasswordDetailSheet, { props: { item, open: true, ondelete } });

		await fireEvent.click(deleteButton());
		await fireEvent.click(await screen.findByRole('button', { name: /Delete password/ }));

		expect(ondelete).toHaveBeenCalledWith(item);
		await waitFor(() => expect(screen.queryByText('Delete "GitHub"?')).toBeNull());
	});

	it('ignores a second confirm while the delete is pending', async () => {
		const reply = deferred<boolean>();
		const ondelete = vi.fn().mockReturnValue(reply.promise);
		render(PasswordDetailSheet, {
			props: { item: passwordItem(), open: true, ondelete }
		});

		await fireEvent.click(deleteButton());
		const confirm = await screen.findByRole('button', { name: /Delete password/ });
		await fireEvent.click(confirm);
		await fireEvent.click(confirm);

		expect(ondelete).toHaveBeenCalledTimes(1);
		reply.resolve(false);
		await waitFor(() => expect(confirmButton()).toHaveProperty('disabled', false));
	});

	it('keeps the dialog open when ondelete resolves false', async () => {
		const ondelete = vi.fn().mockResolvedValue(false);
		render(PasswordDetailSheet, {
			props: { item: passwordItem(), open: true, ondelete }
		});

		await fireEvent.click(deleteButton());
		await fireEvent.click(await screen.findByRole('button', { name: /Delete password/ }));

		await waitFor(() => expect(ondelete).toHaveBeenCalledTimes(1));
		expect(screen.getByText('Delete "GitHub"?')).toBeTruthy();
	});

	it('disables Cancel and the confirm button with a spinner while the delete runs', async () => {
		const reply = deferred<boolean>();
		const ondelete = vi.fn().mockReturnValue(reply.promise);
		render(PasswordDetailSheet, {
			props: { item: passwordItem(), open: true, ondelete }
		});

		await fireEvent.click(deleteButton());
		await fireEvent.click(await screen.findByRole('button', { name: /Delete password/ }));

		expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty('disabled', true);
		expect(confirmButton()).toHaveProperty('disabled', true);
		expect(confirmButton().querySelector('.animate-spin')).not.toBeNull();

		reply.resolve(false);
		await waitFor(() => expect(confirmButton()).toHaveProperty('disabled', false));
	});
});
