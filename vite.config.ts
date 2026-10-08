import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

// Dependencies don't need tsconfig. Without this, the pre-bundler walks up to any parent
// tsconfig.json (e.g. the main checkout when running from .claude/worktrees/) and fails on
// its `extends: "$app/tsconfig"`.
const optimizeDeps = { rolldownOptions: { tsconfig: false } } as const;

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter(),
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			}
		}),
		svelteTesting(),
		// Vitest's own `__vitest__` environment gets no top-level optimizeDeps, so its pre-bundle walks
		// up to the parent tsconfig and fails. Give every environment the same options.
		{ name: 'deps-without-tsconfig', configEnvironment: () => ({ optimizeDeps }) }
	],
	test: {
		include: ['test/unittest/**/*.test.ts'],
		setupFiles: ['test/unittest/setup.ts'],
		environment: 'jsdom',
		restoreMocks: true,
		unstubGlobals: true, // vi.stubGlobal(...) is undone after every test
		coverage: {
			provider: 'v8',
			include: ['src/**/*.{ts,svelte}'],
			// Not ours to test: shadcn-generated components (managed by the CLI) and the generated Prisma client.
			exclude: ['src/lib/components/ui/**', 'src/lib/server/prisma/**'],
			// The gate: `pnpm test:cov` (pre-commit hook and CI) fails below these.
			thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 }
		}
	}
});
