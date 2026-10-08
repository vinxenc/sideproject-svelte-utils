import { describe, expect, it } from 'vitest';
import { variables } from '../../src/env.js';

describe('env variables', () => {
	it('defines exactly the seven variables the app reads', () => {
		expect(Object.keys(variables).sort()).toEqual([
			'BETTER_AUTH_SECRET',
			'DATABASE_URL',
			'S3_ACCESS_KEY_ID',
			'S3_BUCKET',
			'S3_ENDPOINT',
			'S3_REGION',
			'S3_SECRET_ACCESS_KEY'
		]);
	});

	it('gives every variable a description', () => {
		for (const [name, def] of Object.entries(variables)) {
			expect(def.description, name).toEqual(expect.any(String));
			expect(def.description.length, name).toBeGreaterThan(0);
		}
	});
});
