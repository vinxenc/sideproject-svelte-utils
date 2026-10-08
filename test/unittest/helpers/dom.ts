import { flushSync } from 'svelte';

/** Media queries that currently match; tests add e.g. '(max-width: 767px)' and clear it afterwards. */
export const matchingQueries = new Set<string>();

export function fakeMatchMedia(query: string): MediaQueryList {
	return {
		matches: matchingQueries.has(query),
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false
	} as unknown as MediaQueryList;
}

export class FakeResizeObserver {
	static instances: FakeResizeObserver[] = [];
	readonly callback: ResizeObserverCallback;
	targets: Element[] = [];

	constructor(callback: ResizeObserverCallback) {
		this.callback = callback;
		FakeResizeObserver.instances.push(this);
	}

	observe(target: Element): void {
		this.targets.push(target);
	}

	unobserve(target: Element): void {
		this.targets = this.targets.filter((t) => t !== target);
	}

	disconnect(): void {
		this.targets = [];
	}
}

/** Gives `el` a clientWidth (and offsetWidth) of `width` and fires every observer that watches it. */
export function resize(el: Element, width: number): void {
	Object.defineProperty(el, 'clientWidth', { configurable: true, value: width });
	Object.defineProperty(el, 'offsetWidth', { configurable: true, value: width });
	for (const observer of FakeResizeObserver.instances) {
		if (!observer.targets.includes(el)) continue;
		const entry = { target: el, contentRect: { width, height: 0 } };
		observer.callback(
			[entry as unknown as ResizeObserverEntry],
			observer as unknown as ResizeObserver
		);
	}
	flushSync();
}

export class FakeIntersectionObserver {
	static instances: FakeIntersectionObserver[] = [];
	readonly callback: IntersectionObserverCallback;
	readonly options?: IntersectionObserverInit;
	targets: Element[] = [];
	disconnected = false;

	constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
		this.callback = callback;
		this.options = options;
		FakeIntersectionObserver.instances.push(this);
	}

	observe(target: Element): void {
		this.targets.push(target);
	}

	unobserve(target: Element): void {
		this.targets = this.targets.filter((t) => t !== target);
	}

	disconnect(): void {
		this.disconnected = true;
		this.targets = [];
	}

	takeRecords(): IntersectionObserverEntry[] {
		return [];
	}
}

/** Fires every live observer's callback with `isIntersecting` for its targets. */
export function intersect(isIntersecting = true): void {
	for (const observer of FakeIntersectionObserver.instances) {
		if (observer.disconnected || observer.targets.length === 0) continue;
		const entries = observer.targets.map(
			(target) => ({ target, isIntersecting }) as unknown as IntersectionObserverEntry
		);
		observer.callback(entries, observer as unknown as IntersectionObserver);
	}
	flushSync();
}

/** Element.animate stand-in: returns a minimal Animation whose onfinish fires on the next macrotask. */
export function fakeAnimate(this: Element): Animation {
	const animation = {
		onfinish: null as null | (() => void),
		oncancel: null,
		finished: Promise.resolve(),
		cancel: () => {},
		finish: () => {},
		play: () => {},
		pause: () => {},
		reverse: () => {},
		addEventListener: () => {},
		removeEventListener: () => {}
	};
	setTimeout(() => animation.onfinish?.(), 0);
	return animation as unknown as Animation;
}
