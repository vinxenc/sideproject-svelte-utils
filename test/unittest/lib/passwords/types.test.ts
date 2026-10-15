import { describe, expect, it } from 'vitest';
import {
	checkPasswordInput,
	filterByTab,
	isPasswordType,
	matchesQuery,
	NAME_MAX,
	PASSWORD_MAX,
	PASSWORD_TABS,
	searchItems,
	TYPE_LABELS,
	USERNAME_MAX
} from '#lib/passwords/types.js';
import { passwordItem } from '../../helpers/passwords.js';

const valid = { name: 'GitHub', username: 'ada@example.com', password: 'hunter2', type: 'APP' };

function failure(value: unknown) {
	const result = checkPasswordInput(value);
	if (result.ok) throw new Error('expected a failure');
	return result;
}

describe('isPasswordType', () => {
	it('accepts the four types only', () => {
		for (const type of ['APP', 'CREDIT_CARD', 'API_KEY', 'PIN_PLATFORM']) {
			expect(isPasswordType(type)).toBe(true);
		}
		expect(isPasswordType('ALL')).toBe(false);
		expect(isPasswordType('app')).toBe(false);
		expect(isPasswordType(undefined)).toBe(false);
		expect(isPasswordType(1)).toBe(false);
	});
});

describe('checkPasswordInput', () => {
	it('accepts a valid entry', () => {
		expect(checkPasswordInput(valid)).toEqual({ ok: true, input: valid });
	});

	it('rejects a non-object and returns the field-less invalid request', () => {
		for (const value of [null, undefined, 'x', 3, [valid]]) {
			expect(failure(value)).toEqual({ ok: false, field: null, error: 'Invalid request' });
		}
	});

	it('rejects a missing or blank name', () => {
		expect(failure({ ...valid, name: undefined })).toEqual({
			ok: false,
			field: 'name',
			error: 'Enter a name'
		});
		expect(failure({ ...valid, name: '   ' })).toEqual({
			ok: false,
			field: 'name',
			error: 'Enter a name'
		});
	});

	it('rejects a name over NAME_MAX after trimming', () => {
		expect(checkPasswordInput({ ...valid, name: 'a'.repeat(NAME_MAX) }).ok).toBe(true);
		expect(failure({ ...valid, name: `  ${'a'.repeat(NAME_MAX + 1)}  ` })).toEqual({
			ok: false,
			field: 'name',
			error: 'Names can be up to 100 characters'
		});
	});

	it('rejects control characters in the name', () => {
		expect(failure({ ...valid, name: 'a\nb' })).toEqual({
			ok: false,
			field: 'name',
			error: "Names can't contain line breaks"
		});
		expect(failure({ ...valid, name: 'a\u007fb' }).error).toBe("Names can't contain line breaks");
	});

	it('rejects an unknown type', () => {
		expect(failure({ ...valid, type: 'LOGIN' })).toEqual({
			ok: false,
			field: 'type',
			error: 'Choose a type'
		});
	});

	it('accepts a missing, null or string username and rejects other types', () => {
		const withoutUsername = { name: valid.name, type: valid.type, password: valid.password };
		expect(checkPasswordInput(withoutUsername)).toEqual({
			ok: true,
			input: { ...valid, username: null }
		});
		expect(checkPasswordInput({ ...valid, username: null }).ok).toBe(true);
		expect(failure({ ...valid, username: 42 })).toEqual({
			ok: false,
			field: 'username',
			error: 'Invalid username'
		});
	});

	it('trims the username and stores a blank one as null', () => {
		expect(checkPasswordInput({ ...valid, username: '  ada  ' })).toEqual({
			ok: true,
			input: { ...valid, username: 'ada' }
		});
		expect(checkPasswordInput({ ...valid, username: '   ' })).toEqual({
			ok: true,
			input: { ...valid, username: null }
		});
	});

	it('rejects a username over USERNAME_MAX after trimming', () => {
		expect(checkPasswordInput({ ...valid, username: 'u'.repeat(USERNAME_MAX) }).ok).toBe(true);
		expect(failure({ ...valid, username: 'u'.repeat(USERNAME_MAX + 1) })).toEqual({
			ok: false,
			field: 'username',
			error: 'Usernames can be up to 254 characters'
		});
	});

	it('rejects control characters in the username', () => {
		expect(failure({ ...valid, username: 'ada\rlovelace' })).toEqual({
			ok: false,
			field: 'username',
			error: "Usernames can't contain line breaks"
		});
	});

	it('rejects an empty or non-string password', () => {
		expect(failure({ ...valid, password: '' })).toEqual({
			ok: false,
			field: 'password',
			error: 'Enter a password'
		});
		expect(failure({ ...valid, password: undefined }).error).toBe('Enter a password');
		expect(failure({ ...valid, password: 12345 }).error).toBe('Enter a password');
	});

	it('rejects a password over PASSWORD_MAX', () => {
		expect(checkPasswordInput({ ...valid, password: 'p'.repeat(PASSWORD_MAX) }).ok).toBe(true);
		expect(failure({ ...valid, password: 'p'.repeat(PASSWORD_MAX + 1) })).toEqual({
			ok: false,
			field: 'password',
			error: 'Passwords can be up to 1024 characters'
		});
	});

	it('keeps the password exactly as sent, spaces and control characters included', () => {
		expect(checkPasswordInput({ ...valid, password: '  pw  ' })).toEqual({
			ok: true,
			input: { ...valid, password: '  pw  ' }
		});
		expect(checkPasswordInput({ ...valid, password: 'a\nb' })).toEqual({
			ok: true,
			input: { ...valid, password: 'a\nb' }
		});
		expect(checkPasswordInput({ ...valid, password: 'a\tb' })).toEqual({
			ok: true,
			input: { ...valid, password: 'a\tb' }
		});
	});

	it('rejects a password containing U+0000 with a field error', () => {
		expect(failure({ ...valid, password: 'a\u0000b' })).toEqual({
			ok: false,
			field: 'password',
			error: "Passwords can't contain null characters"
		});
	});

	it('checks U+0000 before the password length', () => {
		expect(failure({ ...valid, password: '\u0000' + 'p'.repeat(PASSWORD_MAX + 1) })).toEqual({
			ok: false,
			field: 'password',
			error: "Passwords can't contain null characters"
		});
	});

	it('returns the first failure when several fields are wrong', () => {
		expect(failure({ name: '', type: 'NOPE', password: '' })).toMatchObject({
			field: 'name',
			error: 'Enter a name'
		});
		expect(failure({ name: 'x', type: 'NOPE', username: 3, password: '' })).toMatchObject({
			field: 'type'
		});
		expect(failure({ name: 'x', type: 'APP', username: 3, password: '' })).toMatchObject({
			field: 'username'
		});
	});

	it('ignores extra keys', () => {
		const result = checkPasswordInput({ ...valid, id: 'x', userId: 'y' });
		expect(result).toEqual({ ok: true, input: valid });
	});
});

describe('filterByTab', () => {
	const items = [
		passwordItem({ id: 'a', type: 'APP' }),
		passwordItem({ id: 'b', type: 'API_KEY' }),
		passwordItem({ id: 'c', type: 'APP' })
	];

	it('returns the same array for ALL', () => {
		expect(filterByTab(items, 'ALL')).toBe(items);
	});

	it('keeps the order of the matching items', () => {
		expect(filterByTab(items, 'APP').map((i) => i.id)).toEqual(['a', 'c']);
		expect(filterByTab(items, 'CREDIT_CARD')).toEqual([]);
	});
});

describe('matchesQuery', () => {
	const item = passwordItem({ name: 'GitHub', username: 'ada@example.com', type: 'APP' });

	it('matches everything for a blank or whitespace query', () => {
		expect(matchesQuery(item, '')).toBe(true);
		expect(matchesQuery(item, '   ')).toBe(true);
	});

	it('matches the name case-insensitively', () => {
		expect(matchesQuery(item, 'git')).toBe(true);
		expect(matchesQuery(item, 'HUB')).toBe(true);
	});

	it('matches the username', () => {
		expect(matchesQuery(item, 'ADA@')).toBe(true);
	});

	it('is false for a username that is null and a name that does not match', () => {
		const noUsername = passwordItem({ name: 'Bank', username: null });
		expect(matchesQuery(noUsername, 'ada')).toBe(false);
	});

	it('trims the query', () => {
		expect(matchesQuery(item, '  git  ')).toBe(true);
	});

	it('does not match the type label of an entry whose name and username lack it', () => {
		expect(matchesQuery(passwordItem({ name: 'Bank', username: null, type: 'APP' }), 'App')).toBe(
			false
		);
	});
});

describe('searchItems', () => {
	const items = [
		passwordItem({ id: 'a', name: 'GitHub' }),
		passwordItem({ id: 'b', name: 'Stripe', username: null }),
		passwordItem({ id: 'c', name: 'GitLab', username: 'lin' })
	];

	it('returns the same array for a blank query', () => {
		expect(searchItems(items, '  ')).toBe(items);
	});

	it('returns the matches in their original order', () => {
		expect(searchItems(items, 'git').map((i) => i.id)).toEqual(['a', 'c']);
	});

	it('returns an empty list when nothing matches', () => {
		expect(searchItems(items, 'zzz')).toEqual([]);
	});
});

describe('PASSWORD_TABS and TYPE_LABELS', () => {
	it('lists All first, then the types in order, with their labels', () => {
		expect(PASSWORD_TABS).toEqual([
			{ value: 'ALL', label: 'All' },
			{ value: 'APP', label: 'App' },
			{ value: 'CREDIT_CARD', label: 'Credit card' },
			{ value: 'API_KEY', label: 'API key' },
			{ value: 'PIN_PLATFORM', label: 'PIN platform' }
		]);
		expect(TYPE_LABELS.PIN_PLATFORM).toBe('PIN platform');
	});
});
