import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AddPasswordSheet from '#lib/components/passwords/add-password-sheet.svelte';
import { deferred } from '../../../helpers/media.js';
import { passwordItem } from '../../../helpers/passwords.js';

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast }));

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const nameField = () => document.getElementById('password-name') as HTMLInputElement;
const usernameField = () => document.getElementById('password-username') as HTMLInputElement;
const passwordField = () => document.getElementById('password-value') as HTMLInputElement;
const save = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
const form = () => document.querySelector('form') as HTMLFormElement;
const typeButton = (label: string) => screen.getByRole('radio', { name: label });

function setup(
	props: { defaultType?: 'APP' | 'API_KEY' | 'CREDIT_CARD' | 'PIN_PLATFORM'; open?: boolean } = {}
) {
	const oncreated = vi.fn();
	render(AddPasswordSheet, {
		props: { open: props.open ?? true, defaultType: props.defaultType ?? 'APP', oncreated }
	});
	return { oncreated };
}

function fill(name: string, password: string, username = '') {
	fireEvent.input(nameField(), { target: { value: name } });
	fireEvent.input(passwordField(), { target: { value: password } });
	if (username) fireEvent.input(usernameField(), { target: { value: username } });
}

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('AddPasswordSheet fields', () => {
	it('renders the fields with the autofill and spelling settings that keep the browser out of them', () => {
		setup();

		expect(nameField().getAttribute('autocomplete')).toBe('off');
		expect(usernameField().getAttribute('autocomplete')).toBe('off');
		expect(passwordField().getAttribute('autocomplete')).toBe('new-password');
		expect(nameField().getAttribute('spellcheck')).toBe('false');
		expect(nameField().getAttribute('maxlength')).toBe('100');
		expect(usernameField().getAttribute('maxlength')).toBe('254');
		expect(passwordField().getAttribute('maxlength')).toBe('1024');
		expect(nameField().value).toBe('');
		expect(passwordField().value).toBe('');
	});

	it('offers the four types as toggles, with the default preselected', () => {
		setup({ defaultType: 'API_KEY' });

		for (const label of ['App', 'Credit card', 'API key', 'PIN platform']) {
			expect(typeButton(label)).toBeTruthy();
		}
		expect(typeButton('API key').getAttribute('aria-checked')).toBe('true');
		expect(typeButton('App').getAttribute('aria-checked')).toBe('false');
	});

	it('keeps the selected type when the selected toggle is clicked again', async () => {
		setup();

		await fireEvent.click(typeButton('App'));
		await fireEvent.click(typeButton('App'));

		expect(typeButton('App').getAttribute('aria-checked')).toBe('true');
	});

	it('uses defaultType each time the sheet opens', async () => {
		const { oncreated } = setup({ open: false, defaultType: 'PIN_PLATFORM' });
		void oncreated;
		cleanup();
		render(AddPasswordSheet, {
			props: { open: false, defaultType: 'PIN_PLATFORM', oncreated: vi.fn() }
		});
		const rerender = render(AddPasswordSheet, {
			props: { open: false, defaultType: 'API_KEY', oncreated: vi.fn() }
		}).rerender;
		await rerender({ open: true, defaultType: 'API_KEY', oncreated: vi.fn() });

		expect(typeButton('API key').getAttribute('aria-checked')).toBe('true');
	});

	it('toggles the password between hidden and shown', async () => {
		setup();

		expect(passwordField().type).toBe('password');
		await fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
		expect(passwordField().type).toBe('text');
		await fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
		expect(passwordField().type).toBe('password');
	});
});

describe('AddPasswordSheet save', () => {
	it('keeps Save disabled until there is a name and a password', async () => {
		setup();
		expect(save().disabled).toBe(true);

		await fireEvent.input(nameField(), { target: { value: 'GitHub' } });
		expect(save().disabled).toBe(true);

		await fireEvent.input(passwordField(), { target: { value: 'pw' } });
		expect(save().disabled).toBe(false);
	});

	it('keeps Save disabled for a name that is only spaces', async () => {
		setup();

		fill('   ', 'pw');

		expect(save().disabled).toBe(true);
	});

	it('shows the client check message and makes no request for a blank name', async () => {
		setup();
		fill('   ', 'pw');

		await fireEvent.submit(form());

		expect(screen.getByText('Enter a name')).toBeTruthy();
		expect(nameField().getAttribute('aria-invalid')).toBe('true');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('POSTs the trimmed name and username and the untrimmed password', async () => {
		const item = passwordItem({ name: 'GitHub' });
		fetchMock.mockImplementation(async () => json(item, 201));
		const { oncreated } = setup();
		fill('  GitHub  ', '  pw  ', '   ');

		await fireEvent.click(save());

		await waitFor(() => expect(oncreated).toHaveBeenCalledWith(item));
		expect(fetchMock).toHaveBeenCalledWith('/api/passwords', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'GitHub', username: null, password: '  pw  ', type: 'APP' })
		});
		expect(toast.success).toHaveBeenCalledWith('Password saved');
	});

	it('closes the sheet after a successful save', async () => {
		fetchMock.mockImplementation(async () => json(passwordItem(), 201));
		setup();
		fill('GitHub', 'pw');

		await fireEvent.click(save());

		await waitFor(() => expect(screen.queryByText('Add password')).toBeNull());
	});

	it('stores the selected type', async () => {
		fetchMock.mockImplementation(async () => json(passwordItem({ type: 'CREDIT_CARD' }), 201));
		setup();
		fill('Visa', 'pw');

		await fireEvent.click(typeButton('Credit card'));
		await fireEvent.click(save());

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toMatchObject({
			type: 'CREDIT_CARD'
		});
	});

	it('shows a server error under the form and stays open', async () => {
		fetchMock.mockImplementation(async () => json({ message: 'Server said no' }, 500));
		const { oncreated } = setup();
		fill('GitHub', 'pw');

		await fireEvent.click(save());

		expect(await screen.findByText('Server said no')).toBeTruthy();
		expect(screen.getByText('Add password')).toBeTruthy();
		expect(oncreated).not.toHaveBeenCalled();
		expect(toast.success).not.toHaveBeenCalled();
	});

	it('shows a generic message when the request never reaches the server', async () => {
		fetchMock.mockRejectedValue('offline');
		setup();
		fill('GitHub', 'pw');

		await fireEvent.click(save());

		expect(await screen.findByText('Something went wrong')).toBeTruthy();
	});

	it('shows the username length message under the username field', async () => {
		setup();
		fill('GitHub', 'pw', 'u'.repeat(255));

		await fireEvent.submit(form());

		expect(screen.getByText('Usernames can be up to 254 characters')).toBeTruthy();
		expect(usernameField().getAttribute('aria-invalid')).toBe('true');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('shows the password length message under the password field', async () => {
		setup();
		fill('GitHub', 'p'.repeat(1025));

		await fireEvent.submit(form());

		expect(screen.getByText('Passwords can be up to 1024 characters')).toBeTruthy();
		expect(passwordField().getAttribute('aria-invalid')).toBe('true');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('shows the empty password message under the password field', async () => {
		setup();
		fill('GitHub', '');

		await fireEvent.submit(form());

		expect(screen.getByText('Enter a password')).toBeTruthy();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('sends one request while a save is pending', async () => {
		const reply = deferred<Response>();
		fetchMock.mockReturnValue(reply.promise);
		setup();
		fill('GitHub', 'pw');

		await fireEvent.submit(form());
		await fireEvent.submit(form());

		expect(fetchMock).toHaveBeenCalledTimes(1);
		reply.resolve(json(passwordItem(), 201));
		await waitFor(() => expect(screen.queryByText('Add password')).toBeNull());
	});
});
