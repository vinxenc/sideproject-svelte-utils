// Shared by the browser and the server: the password shapes the API returns and the rules both sides enforce.

export const PASSWORD_TYPES = ['APP', 'CREDIT_CARD', 'API_KEY', 'PIN_PLATFORM'] as const;
export type PasswordType = (typeof PASSWORD_TYPES)[number];

export const TYPE_LABELS: Record<PasswordType, string> = {
	APP: 'App',
	CREDIT_CARD: 'Credit card',
	API_KEY: 'API key',
	PIN_PLATFORM: 'PIN platform'
};

export type PasswordTab = 'ALL' | PasswordType;
/** Tab order on the page: All first, then the types in PASSWORD_TYPES order. */
export const PASSWORD_TABS: { value: PasswordTab; label: string }[] = [
	{ value: 'ALL', label: 'All' },
	...PASSWORD_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }))
];

export const NAME_MAX = 100;
export const USERNAME_MAX = 254; // longest valid email address
export const PASSWORD_MAX = 1024; // room for long API keys

/** An entry as the page data and the API return it. Never carries the password. */
export type PasswordItem = {
	id: string;
	name: string;
	username: string | null;
	type: PasswordType;
	/** ISO 8601 */
	createdAt: string;
};

/** What POST /api/passwords stores, after checkPasswordInput. */
export type PasswordInput = {
	name: string;
	username: string | null;
	password: string;
	type: PasswordType;
};
export type PasswordField = keyof PasswordInput;

/** The body of POST /api/passwords/:id/reveal. */
export type RevealResult = { password: string };

export type InputCheck =
	{ ok: true; input: PasswordInput } | { ok: false; field: PasswordField | null; error: string };

export function isPasswordType(value: unknown): value is PasswordType {
	return typeof value === 'string' && (PASSWORD_TYPES as readonly string[]).includes(value);
}

function hasControlCharacter(text: string): boolean {
	// A loop rather than a regex, as in albums/types.ts: the control range reads more plainly this way.
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		if (code < 0x20 || code === 0x7f) return true;
	}
	return false;
}

/**
 * Trims name and username and checks every field in order, returning the first failure.
 * Lengths are UTF-16 units, the same unit `maxlength` uses. The password is never trimmed.
 * The password may hold any character except U+0000.
 */
export function checkPasswordInput(value: unknown): InputCheck {
	if (typeof value !== 'object' || value === null || Array.isArray(value))
		return { ok: false, field: null, error: 'Invalid request' };
	const { name, type, username, password } = value as Record<string, unknown>;

	if (typeof name !== 'string' || !name.trim())
		return { ok: false, field: 'name', error: 'Enter a name' };
	const trimmedName = name.trim();
	if (trimmedName.length > NAME_MAX)
		return { ok: false, field: 'name', error: `Names can be up to ${NAME_MAX} characters` };
	if (hasControlCharacter(trimmedName))
		return { ok: false, field: 'name', error: "Names can't contain line breaks" };

	if (!isPasswordType(type)) return { ok: false, field: 'type', error: 'Choose a type' };

	if (username !== undefined && username !== null && typeof username !== 'string')
		return { ok: false, field: 'username', error: 'Invalid username' };
	const trimmedUsername = typeof username === 'string' ? username.trim() : '';
	if (trimmedUsername.length > USERNAME_MAX)
		return {
			ok: false,
			field: 'username',
			error: `Usernames can be up to ${USERNAME_MAX} characters`
		};
	if (hasControlCharacter(trimmedUsername))
		return { ok: false, field: 'username', error: "Usernames can't contain line breaks" };

	if (typeof password !== 'string' || password.length === 0)
		return { ok: false, field: 'password', error: 'Enter a password' };
	// Postgres TEXT can't store U+0000; every other control character stays allowed in a password.
	if (password.includes('\u0000'))
		return { ok: false, field: 'password', error: "Passwords can't contain null characters" };
	if (password.length > PASSWORD_MAX)
		return {
			ok: false,
			field: 'password',
			error: `Passwords can be up to ${PASSWORD_MAX} characters`
		};

	return {
		ok: true,
		input: {
			name: trimmedName,
			username: trimmedUsername || null,
			password,
			type
		}
	};
}

/** 'ALL' returns `items` itself; otherwise the items of that type, order kept. */
export function filterByTab(items: PasswordItem[], tab: PasswordTab): PasswordItem[] {
	return tab === 'ALL' ? items : items.filter((item) => item.type === tab);
}

/** True when the trimmed, lower-cased query is a substring of the item's name or username. A blank query matches everything. Passwords are never part of an item, so they are never searched. */
export function matchesQuery(item: PasswordItem, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	return item.name.toLowerCase().includes(q) || (item.username?.toLowerCase().includes(q) ?? false);
}

/** `items` itself for a blank query; otherwise the matching items, order kept. */
export function searchItems(items: PasswordItem[], query: string): PasswordItem[] {
	const q = query.trim();
	if (!q) return items;
	return items.filter((item) => matchesQuery(item, q));
}
