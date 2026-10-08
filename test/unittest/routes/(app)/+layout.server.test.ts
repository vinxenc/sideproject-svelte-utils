import { describe, expect, it } from 'vitest';
import { load } from '../../../../src/routes/(app)/+layout.server.js';
import { thrown } from '../../helpers/thrown.js';

type Ev = Parameters<typeof load>[0];
const event = (user: unknown) => ({ locals: { user } }) as unknown as Ev;

describe('(app) layout load', () => {
	it('sends signed-out visitors to sign-in', () => {
		expect(thrown(() => load(event(null)))).toMatchObject({ status: 303, location: '/sign-in' });
	});

	it('passes the signed-in user to the pages', () => {
		const user = { id: 'u1', name: 'Ann', email: 'ann@example.com' };

		expect(load(event(user))).toEqual({ user });
	});
});
