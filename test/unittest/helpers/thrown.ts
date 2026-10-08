/** Runs `fn` and returns what it threw (SvelteKit's redirect() and error() throw). */
export function thrown(fn: () => unknown): unknown {
	try {
		fn();
	} catch (e) {
		return e;
	}
	throw new Error('expected the function to throw');
}
