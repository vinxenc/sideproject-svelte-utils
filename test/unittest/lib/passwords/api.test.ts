import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createPassword, deletePassword, revealPassword } from '#lib/passwords/api.js';
import type { PasswordInput } from '#lib/passwords/types.js';
import { passwordItem } from '../../helpers/passwords.js';

const fetchMock = vi.fn();

function reply(body: unknown, status = 200) {
	return new Response(body === undefined ? null : JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('createPassword', () => {
	const input: PasswordInput = {
		name: 'GitHub',
		username: null,
		password: 'hunter2',
		type: 'APP'
	};

	it('POSTs the input as JSON and returns the created item', async () => {
		const item = passwordItem();
		fetchMock.mockResolvedValue(reply(item, 201));

		expect(await createPassword(input)).toEqual(item);
		expect(fetchMock).toHaveBeenCalledWith('/api/passwords', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(input)
		});
	});

	it('throws an ApiError with the server message and status', async () => {
		fetchMock.mockResolvedValue(reply({ message: 'Enter a name' }, 400));

		const error = await createPassword(input).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({ message: 'Enter a name', status: 400 });
	});

	it('falls back to the status when the failure has no JSON body', async () => {
		fetchMock.mockResolvedValue(new Response('oops', { status: 500 }));

		await expect(createPassword(input)).rejects.toMatchObject({
			message: 'Request failed (500)',
			status: 500
		});
	});

	it('falls back to the status when the JSON has no string message', async () => {
		fetchMock.mockResolvedValue(reply({ message: 42 }, 400));

		await expect(createPassword(input)).rejects.toMatchObject({
			message: 'Request failed (400)'
		});
	});

	it('lets a network failure propagate unchanged', async () => {
		const network = new TypeError('Failed to fetch');
		fetchMock.mockRejectedValue(network);

		await expect(createPassword(input)).rejects.toBe(network);
	});
});

describe('deletePassword', () => {
	it('DELETEs the id, encoded, and resolves with nothing', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

		await expect(deletePassword('a/b c')).resolves.toBeUndefined();
		expect(fetchMock).toHaveBeenCalledWith('/api/passwords/a%2Fb%20c', { method: 'DELETE' });
	});

	it('throws an ApiError carrying 404 so callers can treat it as already gone', async () => {
		fetchMock.mockResolvedValue(reply({ message: 'Not found' }, 404));

		await expect(deletePassword('p1')).rejects.toMatchObject({
			message: 'Not found',
			status: 404
		});
	});
});

describe('revealPassword', () => {
	it('POSTs to the reveal endpoint and returns the password', async () => {
		fetchMock.mockResolvedValue(reply({ password: '  pw  ' }));

		expect(await revealPassword('p1')).toBe('  pw  ');
		expect(fetchMock).toHaveBeenCalledWith('/api/passwords/p1/reveal', { method: 'POST' });
	});

	it('encodes the id in the URL', async () => {
		fetchMock.mockResolvedValue(reply({ password: 'x' }));

		await revealPassword('x?y');
		expect(fetchMock.mock.calls[0][0]).toBe('/api/passwords/x%3Fy/reveal');
	});

	it('throws an ApiError with the status on a 404', async () => {
		fetchMock.mockResolvedValue(reply({ message: 'Not found' }, 404));

		await expect(revealPassword('p1')).rejects.toMatchObject({ message: 'Not found', status: 404 });
	});

	it('lets a network failure propagate unchanged', async () => {
		const network = new TypeError('Failed to fetch');
		fetchMock.mockRejectedValue(network);

		await expect(revealPassword('p1')).rejects.toBe(network);
	});
});
