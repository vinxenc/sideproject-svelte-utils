import { describe, expect, it } from 'vitest';
import { load } from '../../../src/routes/+page.server.js';
import { thrown } from '../helpers/thrown.js';

describe('/ load', () => {
	it('redirects to the dashboard', () => {
		expect(thrown(() => load())).toMatchObject({ status: 307, location: '/dashboard' });
	});
});
