import { describe, expect, it } from 'vitest';
import { CLIENT_IP_HEADER, withClientIp } from '#lib/server/client-ip.js';

const URL_ = 'http://localhost/api/auth/get-session';

describe('withClientIp', () => {
	it('sets the header from getClientAddress()', () => {
		const copy = withClientIp({
			request: new Request(URL_),
			getClientAddress: () => '203.0.113.7'
		});

		expect(copy.headers.get(CLIENT_IP_HEADER)).toBe('203.0.113.7');
	});

	it('overwrites a header the client sent', () => {
		const copy = withClientIp({
			request: new Request(URL_, { headers: { [CLIENT_IP_HEADER]: '198.51.100.1' } }),
			getClientAddress: () => '203.0.113.7'
		});

		expect(copy.headers.get(CLIENT_IP_HEADER)).toBe('203.0.113.7');
	});

	it('removes a client-sent header when getClientAddress() throws', () => {
		const copy = withClientIp({
			request: new Request(URL_, { headers: { [CLIENT_IP_HEADER]: '198.51.100.1' } }),
			getClientAddress: () => {
				throw new Error('no address');
			}
		});

		expect(copy.headers.has(CLIENT_IP_HEADER)).toBe(false);
	});

	it('keeps the method, URL and other headers', () => {
		const copy = withClientIp({
			request: new Request(URL_, { method: 'POST', headers: { 'x-test': 'yes' } }),
			getClientAddress: () => '203.0.113.7'
		});

		expect(copy.method).toBe('POST');
		expect(copy.url).toBe(URL_);
		expect(copy.headers.get('x-test')).toBe('yes');
	});

	it('leaves a JSON body readable', async () => {
		const copy = withClientIp({
			request: new Request(URL_, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email: 'ann@example.com' })
			}),
			getClientAddress: () => '203.0.113.7'
		});

		await expect(copy.json()).resolves.toEqual({ email: 'ann@example.com' });
	});
});
