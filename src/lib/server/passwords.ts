import type { PasswordInput, PasswordItem } from '#lib/passwords/types.js';
import { prisma } from './db.js';
import type { Prisma } from './prisma/client.js';

/** Every column except `password`. */
export const itemSelect = {
	id: true,
	name: true,
	username: true,
	type: true,
	createdAt: true
} satisfies Prisma.PasswordSelect;
type ItemRow = Prisma.PasswordGetPayload<{ select: typeof itemSelect }>;

export function toItem(row: ItemRow): PasswordItem {
	return {
		id: row.id,
		name: row.name,
		username: row.username,
		type: row.type,
		createdAt: row.createdAt.toISOString()
	};
}

export async function listPasswords(userId: string): Promise<PasswordItem[]> {
	// ponytail: no paging; personal vault. Add a (createdAt, id) cursor past a few hundred rows.
	const rows = await prisma.password.findMany({
		where: { userId },
		orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
		select: itemSelect
	});
	return rows.map(toItem);
}

export async function createPassword(userId: string, input: PasswordInput): Promise<PasswordItem> {
	const row = await prisma.password.create({
		data: { userId, ...input },
		select: itemSelect
	});
	return toItem(row);
}

/** The only read of the password column. null when the entry isn't the user's. */
export async function revealPassword(userId: string, id: string): Promise<string | null> {
	const row = await prisma.password.findFirst({
		where: { id, userId },
		select: { password: true }
	});
	return row?.password ?? null;
}

/** Soft-deletes the entry. false when not found / not owned. */
export async function deletePassword(userId: string, id: string): Promise<boolean> {
	const { count } = await prisma.password.deleteMany({ where: { id, userId } });
	return count > 0;
}
