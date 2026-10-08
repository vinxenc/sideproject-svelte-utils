import { vi } from 'vitest';

export class FakeTrack {
	kind: 'audio' | 'video';
	stop = vi.fn();

	constructor(kind: 'audio' | 'video' = 'video') {
		this.kind = kind;
	}
}

export class FakeStream {
	tracks: FakeTrack[];

	constructor(tracks: FakeTrack[] = [new FakeTrack('video')]) {
		this.tracks = tracks;
	}

	getTracks() {
		return this.tracks;
	}

	getAudioTracks() {
		return this.tracks.filter((t) => t.kind === 'audio');
	}

	addTrack(track: FakeTrack) {
		this.tracks.push(track);
	}
}

/** MediaRecorder stand-in. `stop()` behaves like the real one: it goes inactive, then delivers the chunk and `stop`. */
export class FakeRecorder {
	static instances: FakeRecorder[] = [];
	/** The one MIME type `isTypeSupported` accepts; '' accepts none. */
	static supported = '';
	static isTypeSupported(type: string) {
		return type === FakeRecorder.supported;
	}

	state: 'inactive' | 'recording' = 'inactive';
	mimeType: string;
	options: { mimeType?: string } | undefined;
	nextChunk: Blob = new Blob(['v']);
	ondataavailable: ((event: { data: Blob }) => void) | null = null;
	onstop: (() => void) | null = null;
	start = vi.fn(() => {
		this.state = 'recording';
	});
	stop = vi.fn(() => {
		this.state = 'inactive';
		this.ondataavailable?.({ data: this.nextChunk });
		this.onstop?.();
	});

	constructor(_stream: unknown, options?: { mimeType?: string }) {
		this.options = options;
		this.mimeType = options?.mimeType ?? '';
		FakeRecorder.instances.push(this);
	}
}

/** Puts a fake `navigator.mediaDevices` in place and returns its getUserMedia mock. */
export function installMediaDevices(getUserMedia = vi.fn()) {
	Object.defineProperty(navigator, 'mediaDevices', {
		configurable: true,
		value: { getUserMedia }
	});
	return getUserMedia;
}

export function uninstallMediaDevices() {
	Reflect.deleteProperty(navigator, 'mediaDevices');
}

/** Lets pending promise callbacks run, for use under fake timers (where waitFor would hang). */
export async function flushMicrotasks() {
	for (let i = 0; i < 10; i++) await Promise.resolve();
}
