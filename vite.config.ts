import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Dependencies don't need tsconfig. Without this, the pre-bundler walks up to any parent
// tsconfig.json (e.g. the main checkout when running from .claude/worktrees/) and fails on
// its `extends: "$app/tsconfig"`.
const optimizeDeps = { rolldownOptions: { tsconfig: false } } as const;

export default defineConfig({
	optimizeDeps,
	ssr: { optimizeDeps },
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			}
		})
	]
});
