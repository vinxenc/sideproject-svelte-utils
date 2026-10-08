import { vi } from 'vitest';
import {
	FakeIntersectionObserver,
	FakeResizeObserver,
	fakeAnimate,
	fakeMatchMedia
} from './helpers/dom.js';

// Unit tests never read the real environment, so they pass without a .env (e.g. in the pre-commit hook).
vi.mock('$app/env/private', () => ({
	DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
	BETTER_AUTH_SECRET: 'test-secret',
	S3_ENDPOINT: 'http://s3.test',
	S3_REGION: 'us-east-1',
	S3_BUCKET: 'media',
	S3_ACCESS_KEY_ID: 'test-key',
	S3_SECRET_ACCESS_KEY: 'test-secret-key'
}));

// Browser APIs jsdom doesn't implement, used by bits-ui/Sidebar, mode-watcher, bind:clientWidth,
// the gallery's infinite scroll and Svelte transitions.
window.matchMedia = fakeMatchMedia;
globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver =
	FakeIntersectionObserver as unknown as typeof IntersectionObserver;
Element.prototype.animate = fakeAnimate;
