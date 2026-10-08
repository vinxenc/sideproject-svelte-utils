import { describe, expect, it } from 'vitest';
import { load } from '../../../../src/routes/(guest)/+layout.server.js';
import { thrown } from '../../helpers/thrown.js';

type Ev = Parameters<typeof load>[0];
const event = (user: unknown) => ({ locals: { user } }) as unknown as Ev;

describe('(guest) layout load', () => {
	it('sends signed-in users to the dashboard', () => {
		expect(thrown(() => load(event({ id: 'u1' })))).toMatchObject({
			status: 303,
			location: '/dashboard'
		});
	});

	it('lets signed-out visitors through', () => {
		expect(load(event(null))).toBeUndefined();
	});
});
