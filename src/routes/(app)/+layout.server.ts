import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Everything under (app)/ requires a session.
export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.user) redirect(303, '/sign-in');
	return { user: locals.user };
};
