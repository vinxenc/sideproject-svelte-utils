import type { PasswordItem, PasswordType } from '#lib/passwords/types.js';

/** A password entry as the page data and the API return it: no password, created on 2024-05-01. */
export function passwordItem(overrides: Partial<PasswordItem> = {}): PasswordItem {
	return {
		id: 'p1',
		name: 'GitHub',
		username: 'ada@example.com',
		type: 'APP',
		createdAt: '2024-05-01T10:00:00.000Z',
		...overrides
	};
}

/** The Prisma row shape `password.findMany` returns with itemSelect (no password column). */
export function passwordRow(
	overrides: Partial<{
		id: string;
		name: string;
		username: string | null;
		type: PasswordType;
		createdAt: Date;
	}> = {}
) {
	return {
		id: 'p1',
		name: 'GitHub',
		username: 'ada@example.com' as string | null,
		type: 'APP' as PasswordType,
		createdAt: new Date('2024-05-01T10:00:00.000Z'),
		...overrides
	};
}
