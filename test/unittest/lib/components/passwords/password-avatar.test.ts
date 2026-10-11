import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import PasswordAvatar from '#lib/components/passwords/password-avatar.svelte';
import { avatarFor } from '#lib/passwords/avatar.js';

afterEach(() => cleanup());

describe('PasswordAvatar', () => {
	it('shows the first letter of the name', () => {
		render(PasswordAvatar, { props: { name: 'netflix' } });

		expect(screen.getByText('N')).toBeTruthy();
	});

	it('takes the colour from the name', () => {
		const { container } = render(PasswordAvatar, { props: { name: 'GitHub' } });

		const fallback = container.querySelector('[data-slot="avatar-fallback"]');
		expect(fallback?.classList).toContain(avatarFor('GitHub').className);
	});

	it('is hidden from assistive technology', () => {
		const { container } = render(PasswordAvatar, { props: { name: 'GitHub' } });

		expect(container.querySelector('[data-slot="avatar"]')?.getAttribute('aria-hidden')).toBe(
			'true'
		);
	});

	it('uses a rounded square, not the generated circle', () => {
		const { container } = render(PasswordAvatar, { props: { name: 'GitHub' } });

		const root = container.querySelector('[data-slot="avatar"]');
		const fallback = container.querySelector('[data-slot="avatar-fallback"]');
		expect(root?.classList).toContain('rounded-lg');
		expect(root?.classList).toContain('after:rounded-lg');
		expect(root?.classList).not.toContain('rounded-full');
		expect(root?.classList).not.toContain('after:rounded-full');
		expect(fallback?.classList).toContain('rounded-lg');
		expect(fallback?.classList).not.toContain('rounded-full');
	});
});
