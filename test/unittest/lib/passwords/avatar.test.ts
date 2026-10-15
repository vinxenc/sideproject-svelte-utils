import { describe, expect, it } from 'vitest';
import { AVATAR_PALETTE, avatarFor } from '#lib/passwords/avatar.js';

describe('avatarFor', () => {
	it('pins the colour for known names', () => {
		expect(avatarFor('GitHub').className).toBe('bg-amber-600');
		expect(avatarFor('Netflix').className).toBe('bg-rose-600');
		expect(avatarFor('Visa').className).toBe('bg-red-600');
		expect(avatarFor('Stripe').className).toBe('bg-emerald-600');
		expect(avatarFor('').className).toBe('bg-orange-600');
		expect(avatarFor('😀 Smile').className).toBe('bg-red-600');
	});

	it('ignores case and surrounding spaces when choosing the colour', () => {
		expect(avatarFor('github').className).toBe('bg-amber-600');
		expect(avatarFor('  GitHub  ').className).toBe('bg-amber-600');
		expect(avatarFor('  GitHub  ')).toEqual(avatarFor('GitHub'));
	});

	it('uses the uppercased first letter of the trimmed name', () => {
		expect(avatarFor('netflix').letter).toBe('N');
		expect(avatarFor('  stripe').letter).toBe('S');
	});

	it('keeps a surrogate pair whole as the letter', () => {
		expect(avatarFor('😀 Smile').letter).toBe('😀');
	});

	it('takes the first code point of the uppercased text ("ß" becomes "S")', () => {
		expect(avatarFor('ß').letter).toBe('S');
	});

	it('shows "?" for an empty or blank name', () => {
		expect(avatarFor('')).toEqual({ letter: '?', className: 'bg-orange-600' });
		expect(avatarFor('   ')).toEqual({ letter: '?', className: 'bg-orange-600' });
	});

	it('reaches every palette entry', () => {
		const seen = new Set<string>();
		for (let i = 0; i < 500; i++) seen.add(avatarFor(`name ${i}`).className);
		expect(seen).toEqual(new Set(AVATAR_PALETTE));
		expect(AVATAR_PALETTE).toHaveLength(12);
	});
});
