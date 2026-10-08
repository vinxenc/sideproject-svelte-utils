import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import CameraCapture from '#lib/components/media/camera-capture.svelte';
import {
	FakeRecorder,
	FakeStream,
	FakeTrack,
	flushMicrotasks,
	installMediaDevices,
	uninstallMediaDevices
} from '../../../helpers/camera.js';

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }));

const streamWithAudio = () => new FakeStream([new FakeTrack('video'), new FakeTrack('audio')]);

let oncapture: Mock<(file: File) => void>;
let onclose: Mock<() => void>;

beforeEach(() => {
	FakeRecorder.instances = [];
	FakeRecorder.supported = '';
	vi.stubGlobal('MediaRecorder', FakeRecorder);
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
	vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
		callback?.(new Blob(['j'], { type: 'image/jpeg' }));
	});
	oncapture = vi.fn();
	onclose = vi.fn();
});

afterEach(() => {
	cleanup();
	uninstallMediaDevices();
	vi.useRealTimers();
});

/** Renders the capture screen with a camera that opens (or stays pending) and returns its parts. */
function open(getUserMedia = vi.fn(async () => streamWithAudio())) {
	installMediaDevices(getUserMedia);
	const result = render(CameraCapture, { oncapture, onclose });
	const video = result.container.querySelector('video') as HTMLVideoElement;
	return { ...result, video, getUserMedia };
}

const shutter = () =>
	screen.getByRole('button', { name: /take photo|start recording|stop recording/i });
const spinner = (container: HTMLElement) => container.querySelector('.animate-spin');

describe('CameraCapture opening', () => {
	it('shows a spinner and a disabled shutter until the camera is live', async () => {
		const { container } = open(vi.fn(() => new Promise(() => {})));

		expect(spinner(container)).not.toBeNull();
		expect((shutter() as HTMLButtonElement).disabled).toBe(true);
	});

	it('enables the shutter once the camera is live', async () => {
		const { container, video } = open();

		await vi.waitFor(() => expect((shutter() as HTMLButtonElement).disabled).toBe(false));
		expect(spinner(container)).toBeNull();
		expect(screen.getByRole('button', { name: 'Take photo' })).toBeTruthy();
		expect(video.srcObject).toBeTruthy();
	});

	it('closes straight away when the device has no camera API', () => {
		uninstallMediaDevices();

		render(CameraCapture, { oncapture, onclose });

		expect(onclose).toHaveBeenCalledTimes(1);
	});
});

describe('CameraCapture photos', () => {
	it('takes a photo from the live frame and hands it over as a JPEG', async () => {
		const { video } = open();
		await vi.waitFor(() => expect((shutter() as HTMLButtonElement).disabled).toBe(false));
		Object.defineProperty(video, 'videoWidth', { configurable: true, value: 640 });
		Object.defineProperty(video, 'videoHeight', { configurable: true, value: 480 });

		await fireEvent.click(shutter());

		await vi.waitFor(() => expect(oncapture).toHaveBeenCalledTimes(1));
		const file = oncapture.mock.calls[0][0] as File;
		expect(file.name).toMatch(/\.jpg$/);
		expect(file.type).toBe('image/jpeg');
	});
});

describe('CameraCapture video', () => {
	it('switches the shutter to recording, shows the elapsed time, and saves on stop', async () => {
		vi.useFakeTimers();
		const { container, video } = open();
		await flushMicrotasks();
		Object.defineProperty(video, 'videoWidth', { configurable: true, value: 640 });
		await fireEvent.click(screen.getByRole('button', { name: 'Video' }));
		const red = screen.getByRole('button', { name: 'Start recording' }).querySelector('span');
		expect(red?.classList).toContain('bg-red-600');

		await fireEvent.click(shutter());
		flushSync();
		expect(screen.getByText('0:00')).toBeTruthy();
		vi.advanceTimersByTime(2000);
		flushSync();
		expect(screen.getByText('0:02')).toBeTruthy();

		for (const name of ['Photo', 'Video', 'Done']) {
			expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
		}
		expect(screen.getByRole('button', { name: 'Stop recording' })).toBeTruthy();

		await fireEvent.click(shutter());
		flushSync();

		expect(oncapture).toHaveBeenCalledTimes(1);
		expect((oncapture.mock.calls[0][0] as File).type).toBe('video/webm');
		expect(screen.queryByText('0:02')).toBeNull();
		expect(container.querySelector('.bg-red-600')).not.toBeNull();
	});

	it('returns to photo mode from video mode', async () => {
		open();
		await flushMicrotasks();

		await fireEvent.click(screen.getByRole('button', { name: 'Video' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Photo' }));

		expect(screen.getByRole('button', { name: 'Take photo' })).toBeTruthy();
	});
});

describe('CameraCapture done', () => {
	it('closes when Done is pressed', async () => {
		open();
		await flushMicrotasks();

		await fireEvent.click(screen.getByRole('button', { name: 'Done' }));

		expect(onclose).toHaveBeenCalled();
	});
});
