// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { auth } from '#lib/server/auth.js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: (typeof auth.$Infer.Session)['user'] | null;
		}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
