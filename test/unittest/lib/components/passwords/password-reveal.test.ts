import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordReveal from '#lib/components/passwords/password-reveal.svelte';
import { deferred } from '../../../helpers/media.js';

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const nav = vi.hoisted(() => ({ invalidateAll: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('$app/navigation', () => nav);
vi.mock('svelte-sonner', () => ({ toast }));

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const showButton = () => screen.getByRole('button', { name: 'Show password for GitHub' });
const hideButton = () => screen.getByRole('button', { name: 'Hide password for GitHub' });

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('PasswordReveal', () => {
	it('shows eight dots and a hidden label until revealed', () => {
		render(PasswordReveal, { props: { id: 'p1', name: 'GitHub' } });

		expect(screen.getByText('••••••••')).toBeTruthy();
		expect(screen.getByText('Hidden')).toBeTruthy();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('POSTs to the reveal endpoint and shows the password', async () => {
		fetchMock.mockResolvedValue(json({ password: 'hunter2' }));
		render(PasswordReveal, { props: { id: 'p1', name: 'GitHub' } });

		await fireEvent.click(showButton());

		expect(await screen.findByText('hunter2')).toBeTruthy();
		expect(fetchMock).toHaveBeenCalledWith('/api/passwords/p1/reveal', { method: 'POST' });
		expect(screen.queryByText('••••••••')).toBeNull();
	});

	it('keeps the spaces of a password as it was sent', async () => {
		fetchMock.mockResolvedValue(json({ password: '  pw  ' }));
		render(PasswordReveal, { props: { id: 'p1', name: 'GitHub' } });

		await fireEvent.click(showButton());

		expect((await screen.findByText((_, el) => el?.textContent === '  pw  ')).textContent).toBe(
			'  pw  '
		);
	});

	it('forgets the value on hide, so the next reveal POSTs again', async () => {
		fetchMock.mockImplementation(async () => json({ password: 'hunter2' }));
		render(PasswordReveal, { props: { id: 'p1', name: 'GitHub' } });

		await fireEvent.click(showButton());
		await screen.findByText('hunter2');
		await fireEvent.click(hideButton());

		expect(screen.getByText('••••••••')).toBeTruthy();
		expect(screen.queryByText('hunter2')).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(1);

		await fireEvent.click(showButton());
		await screen.findByText('hunter2');
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('disables the eye and sends one request while a reveal is pending', async () => {
		const reply = deferred<Response>();
		fetchMock.mockReturnValue(reply.promise);
		render(PasswordReveal, { props: { id: 'p1', name: 'GitHub' } });

		await fireEvent.click(showButton());
		expect(screen.getByRole('button', { name: 'Show password for GitHub' })).toHaveProperty(
			'disabled',
			true
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Show password for GitHub' }));
		expect(fetchMock).toHaveBeenCalledTimes(1);

		reply.resolve(json({ password: 'hunter2' }));
		expect(await screen.findByText('hunter2')).toBeTruthy();
	});

	it('shows an error toast with the server message and leaves the list alone', async () => {
		fetchMock.mockResolvedValue(json({ message: 'Server said no' }, 500));
		render(PasswordReveal, { props: { id: 'p1', name: 'GitHub' } });

		await fireEvent.click(showButton());

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith("Couldn't show the password", {
				description: 'Server said no'
			})
		);
		expect(nav.invalidateAll).not.toHaveBeenCalled();
		expect(screen.getByText('••••••••')).toBeTruthy();
	});

	it('uses a generic description when the request never reaches the server', async () => {
		fetchMock.mockRejectedValue('offline');
		render(PasswordReveal, { props: { id: 'p1', name: 'GitHub' } });

		await fireEvent.click(showButton());

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith("Couldn't show the password", {
				description: 'Something went wrong'
			})
		);
	});

	it('refreshes the list when the entry is already gone (404)', async () => {
		fetchMock.mockResolvedValue(json({ message: 'Not found' }, 404));
		render(PasswordReveal, { props: { id: 'p1', name: 'GitHub' } });

		await fireEvent.click(showButton());

		await waitFor(() => expect(nav.invalidateAll).toHaveBeenCalledTimes(1));
		expect(toast.error).toHaveBeenCalledWith("Couldn't show the password", {
			description: 'Not found'
		});
	});

	it('breaks long passwords in the detail view and truncates them in the row', async () => {
		fetchMock.mockImplementation(async () => json({ password: 'k'.repeat(40) }));
		const { unmount } = render(PasswordReveal, {
			props: { id: 'p1', name: 'GitHub', wrap: true }
		});
		await fireEvent.click(showButton());
		const wrapped = await screen.findByText('k'.repeat(40));
		expect(wrapped.classList).toContain('break-all');
		unmount();

		render(PasswordReveal, { props: { id: 'p1', name: 'GitHub' } });
		await fireEvent.click(showButton());
		expect((await screen.findByText('k'.repeat(40))).classList).toContain('truncate');
	});
});
