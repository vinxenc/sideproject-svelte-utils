import { describe, expect, it } from 'vitest';
import { cn } from '#lib/utils.js';

describe('cn', () => {
	it('joins conditional classes and lets the last conflicting Tailwind class win', () => {
		expect(cn('px-2 py-1', { hidden: false, 'text-sm': true }, undefined, 'px-4')).toBe(
			'py-1 text-sm px-4'
		);
	});
});
