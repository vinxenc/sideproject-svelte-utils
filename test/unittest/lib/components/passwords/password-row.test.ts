import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordRow from '#lib/components/passwords/password-row.svelte';
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

function setup(
	overrides: Partial<Parameters<typeof PasswordRow>[1]> & Record<string, unknown> = {}
) {
	const onopen = vi.fn();
	const ondelete = vi.fn();
	const item = passwordItem();
	render(PasswordRow, { props: { item, onopen, ondelete, ...overrides } });
	return { item, onopen, ondelete };
}

describe('PasswordRow', () => {
	it('shows the name and the username', () => {
		setup();

		expect(screen.getByText('GitHub')).toBeTruthy();
		expect(screen.getByText('ada@example.com')).toBeTruthy();
	});

	it('falls back to the type label when there is no username', () => {
		setup({ item: passwordItem({ username: null, type: 'CREDIT_CARD' }) });

		expect(screen.getByText('Credit card')).toBeTruthy();
	});

	it('opens the entry when its main button is tapped', async () => {
		const { item, onopen } = setup();

		await fireEvent.click(screen.getByRole('button', { name: 'GitHub ada@example.com' }));

		expect(onopen).toHaveBeenCalledWith(item);
	});

	it('hands the entry to ondelete from the trash button', async () => {
		const { item, ondelete } = setup();

		await fireEvent.click(screen.getByRole('button', { name: 'Delete GitHub' }));

		expect(ondelete).toHaveBeenCalledWith(item);
	});

	it('disables the trash and shows a spinner while its delete is in flight', () => {
		setup({ deleting: true });

		const trash = screen.getByRole('button', { name: 'Delete GitHub' });
		expect(trash).toHaveProperty('disabled', true);
		expect(trash.querySelector('.animate-spin')).not.toBeNull();
	});

	it('keeps the trash enabled and free of a spinner when idle', () => {
		setup();

		const trash = screen.getByRole('button', { name: 'Delete GitHub' });
		expect(trash).toHaveProperty('disabled', false);
		expect(trash.querySelector('.animate-spin')).toBeNull();
	});

	it('has no button nested inside another button', () => {
		const { container } = render(PasswordRow, {
			props: { item: passwordItem(), onopen: vi.fn(), ondelete: vi.fn() }
		});

		const buttons = Array.from(container.querySelectorAll('button'));
		expect(buttons.length).toBeGreaterThan(1);
		expect(buttons.every((button) => !button.querySelector('button'))).toBe(true);
	});

	it('wraps the row in a contained snap scroller with a gap', () => {
		setup();

		const scroller = document.querySelector<HTMLElement>('[data-slot="password-row"]');
		expect(scroller?.className).toContain('overscroll-x-contain');
		expect(scroller?.className).toContain('snap-x');
		expect(scroller?.className).toContain('gap-2');
	});

	it('puts the open button and the eye in a 90px card, without the trash', () => {
		setup();

		const card = document.querySelector<HTMLElement>('[data-slot="password-card"]');
		expect(card).not.toBeNull();
		expect(card?.contains(screen.getByRole('button', { name: 'GitHub ada@example.com' }))).toBe(
			true
		);
		expect(card?.contains(screen.getByRole('button', { name: 'Show password for GitHub' }))).toBe(
			true
		);
		expect(card?.contains(screen.getByRole('button', { name: 'Delete GitHub' }))).toBe(false);
		expect(card?.className).toContain('bg-muted');
		expect(card?.className).toContain('min-h-[90px]');
	});

	it('renders the trash as a rounded destructive tile right after the card', () => {
		setup();

		const card = document.querySelector<HTMLElement>('[data-slot="password-card"]');
		const trash = screen.getByRole('button', { name: 'Delete GitHub' });
		expect(card?.nextElementSibling).toBe(trash);
		expect(trash.parentElement?.getAttribute('data-slot')).toBe('password-row');
		expect(trash.className).toContain('text-destructive');
		expect(trash.className).toContain('rounded-xl');
	});
});
