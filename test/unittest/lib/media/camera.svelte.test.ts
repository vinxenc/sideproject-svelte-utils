import { toast } from 'svelte-sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Camera } from '#lib/media/camera.svelte.js';
import {
	FakeRecorder,
	FakeStream,
	FakeTrack,
	flushMicrotasks,
	installMediaDevices,
	uninstallMediaDevices
} from '../../helpers/camera.js';
import { deferred } from '../../helpers/media.js';

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), info: vi.fn() } }));

const oncapture = vi.fn();
const onclose = vi.fn();

/** A stream with both a camera and a microphone, so recording never asks for audio. */
const streamWithAudio = () => new FakeStream([new FakeTrack('video'), new FakeTrack('audio')]);

function makeVideo(width = 0, height = 0) {
	const video = document.createElement('video');
	Object.defineProperty(video, 'videoWidth', { configurable: true, value: width });
	Object.defineProperty(video, 'videoHeight', { configurable: true, value: height });
	return video;
}

/** Attaches a camera whose getUserMedia resolves to `stream`, and waits until it is live. */
async function openCamera(stream: FakeStream = streamWithAudio()) {
	const getUserMedia = installMediaDevices(vi.fn(async () => stream));
	const camera = new Camera(oncapture, onclose);
	const video = makeVideo(640, 480);
	const cleanup = camera.attach(video);
	await vi.waitFor(() => expect(camera.live).toBe(true));
	return { camera, video, cleanup, stream, getUserMedia };
}

beforeEach(() => {
	vi.clearAllMocks();
	FakeRecorder.instances = [];
	FakeRecorder.supported = '';
	vi.stubGlobal('MediaRecorder', FakeRecorder);
});

afterEach(() => {
	uninstallMediaDevices();
	vi.useRealTimers();
});

describe('Camera opening', () => {
	it('explains that https is needed when the browser has no media devices', () => {
		const camera = new Camera(oncapture, onclose);

		camera.attach(makeVideo());

		expect(toast.error).toHaveBeenCalledWith('The camera needs a secure (https) page');
		expect(onclose).toHaveBeenCalledTimes(1);
		expect(camera.live).toBe(false);
	});

	it('shows the video in the element and is live once the stream opens', async () => {
		const { camera, video, stream, getUserMedia } = await openCamera();

		expect(getUserMedia).toHaveBeenCalledWith({
			video: { facingMode: { ideal: 'environment' } },
			audio: false
		});
		expect(video.srcObject).toBe(stream);
		expect(camera.live).toBe(true);
	});

	it('stops the camera and goes offline when the attachment is cleaned up', async () => {
		const { camera, cleanup, stream } = await openCamera();

		cleanup();

		expect(stream.tracks[0].stop).toHaveBeenCalled();
		expect(stream.tracks[1].stop).toHaveBeenCalled();
		expect(camera.live).toBe(false);
	});

	it('releases a stream that arrives after the attachment was cleaned up', async () => {
		const pending = deferred<FakeStream>();
		installMediaDevices(vi.fn(() => pending.promise));
		const camera = new Camera(oncapture, onclose);
		const cleanup = camera.attach(makeVideo());

		cleanup();
		const stream = streamWithAudio();
		pending.resolve(stream);
		await flushMicrotasks();

		expect(stream.tracks[0].stop).toHaveBeenCalled();
		expect(camera.live).toBe(false);
	});

	it.each([
		['NotFoundError', 'No camera found'],
		['NotAllowedError', 'Allow camera access to take photos'],
		['OverconstrainedError', "Couldn't open the camera"]
	])('reports a %s as "%s" and closes', async (name, message) => {
		installMediaDevices(vi.fn(async () => Promise.reject(new DOMException('', name))));
		const camera = new Camera(oncapture, onclose);

		camera.attach(makeVideo());
		await vi.waitFor(() => expect(onclose).toHaveBeenCalledTimes(1));

		expect(toast.error).toHaveBeenCalledWith(message);
		expect(camera.live).toBe(false);
	});

	it('reports a non-DOM error as a generic failure', async () => {
		installMediaDevices(vi.fn(async () => Promise.reject(new Error('boom'))));
		const camera = new Camera(oncapture, onclose);

		camera.attach(makeVideo());
		await vi.waitFor(() => expect(onclose).toHaveBeenCalledTimes(1));

		expect(toast.error).toHaveBeenCalledWith("Couldn't open the camera");
	});
});

describe('Camera.snap', () => {
	it('does nothing before the camera is attached', async () => {
		const camera = new Camera(oncapture, onclose);

		await camera.snap();

		expect(oncapture).not.toHaveBeenCalled();
	});

	it('does nothing while the camera is still opening', async () => {
		installMediaDevices(vi.fn(() => new Promise(() => {})));
		const camera = new Camera(oncapture, onclose);
		camera.attach(makeVideo(640, 480));

		await camera.snap();

		expect(oncapture).not.toHaveBeenCalled();
	});

	it('does nothing when the video has no frame yet', async () => {
		const stream = streamWithAudio();
		installMediaDevices(vi.fn(async () => stream));
		const camera = new Camera(oncapture, onclose);
		camera.attach(makeVideo(0, 0));
		await vi.waitFor(() => expect(camera.live).toBe(true));

		await camera.snap();

		expect(oncapture).not.toHaveBeenCalled();
	});

	it('captures a JPEG named by the time it was taken', async () => {
		const { camera } = await openCamera();
		const getContext = vi
			.spyOn(HTMLCanvasElement.prototype, 'getContext')
			.mockImplementation(() => ({ drawImage: vi.fn() }) as unknown as CanvasRenderingContext2D);
		vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
			callback?.(new Blob(['j'], { type: 'image/jpeg' }));
		});

		await camera.snap();

		expect(getContext).toHaveBeenCalledWith('2d');
		expect(oncapture).toHaveBeenCalledTimes(1);
		const file = oncapture.mock.calls[0][0] as File;
		expect(file.name).toMatch(/^camera-\d{17}\.jpg$/);
		expect(file.type).toBe('image/jpeg');
	});

	it('captures nothing when the browser produces no image', async () => {
		const { camera } = await openCamera();
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
			() => ({ drawImage: vi.fn() }) as unknown as CanvasRenderingContext2D
		);
		vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
			callback?.(null);
		});

		await camera.snap();

		expect(oncapture).not.toHaveBeenCalled();
	});

	it('still encodes the frame when no 2D context is available', async () => {
		const { camera } = await openCamera();
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		const toBlob = vi
			.spyOn(HTMLCanvasElement.prototype, 'toBlob')
			.mockImplementation((callback) => {
				callback?.(new Blob(['j']));
			});

		await camera.snap();

		expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.92);
		expect(oncapture).toHaveBeenCalledTimes(1);
	});
});

describe('Camera.toggleRecording', () => {
	it('does nothing before the camera is open', async () => {
		const camera = new Camera(oncapture, onclose);

		await camera.toggleRecording();

		expect(FakeRecorder.instances).toHaveLength(0);
		expect(camera.recording).toBe(false);
	});

	it('does not ask for the microphone again when the stream already has audio', async () => {
		const { camera, getUserMedia } = await openCamera(streamWithAudio());

		await camera.toggleRecording();

		expect(getUserMedia).toHaveBeenCalledTimes(1);
		expect(FakeRecorder.instances).toHaveLength(1);
	});

	it('asks for the microphone when the stream has no audio and adds its tracks', async () => {
		const video = new FakeStream([new FakeTrack('video')]);
		const mic = new FakeStream([new FakeTrack('audio')]);
		const { camera, getUserMedia, stream } = await openCamera(video);
		getUserMedia.mockResolvedValueOnce(mic);

		await camera.toggleRecording();

		expect(getUserMedia).toHaveBeenLastCalledWith({ audio: true });
		expect(stream.getAudioTracks()).toHaveLength(1);
		expect(FakeRecorder.instances).toHaveLength(1);
	});

	it('records without sound, with a notice, when the microphone is refused', async () => {
		const { camera, getUserMedia } = await openCamera(new FakeStream([new FakeTrack('video')]));
		getUserMedia.mockRejectedValueOnce(new DOMException('', 'NotAllowedError'));

		await camera.toggleRecording();

		expect(toast.info).toHaveBeenCalledWith('Recording without sound');
		expect(FakeRecorder.instances).toHaveLength(1);
		expect(camera.recording).toBe(true);
	});

	it('asks for the microphone only once when pressed twice while the prompt is open', async () => {
		const { camera, getUserMedia } = await openCamera(new FakeStream([new FakeTrack('video')]));
		const mic = deferred<FakeStream>();
		getUserMedia.mockReturnValueOnce(mic.promise);

		const first = camera.toggleRecording();
		const second = camera.toggleRecording();
		mic.resolve(new FakeStream([new FakeTrack('audio')]));
		await Promise.all([first, second]);

		expect(getUserMedia).toHaveBeenCalledTimes(2);
		expect(getUserMedia).toHaveBeenLastCalledWith({ audio: true });
		expect(FakeRecorder.instances).toHaveLength(1);
	});

	it('stops the microphone it just got if the camera closed meanwhile', async () => {
		const { camera, cleanup, getUserMedia } = await openCamera(
			new FakeStream([new FakeTrack('video')])
		);
		const mic = deferred<FakeStream>();
		getUserMedia.mockReturnValueOnce(mic.promise);

		const recording = camera.toggleRecording();
		cleanup();
		const lateMic = new FakeStream([new FakeTrack('audio')]);
		mic.resolve(lateMic);
		await recording;

		expect(lateMic.tracks[0].stop).toHaveBeenCalled();
		expect(FakeRecorder.instances).toHaveLength(0);
	});

	it('shows no notice when the microphone is refused after the camera closed', async () => {
		const { camera, cleanup, getUserMedia } = await openCamera(
			new FakeStream([new FakeTrack('video')])
		);
		const mic = deferred<FakeStream>();
		getUserMedia.mockReturnValueOnce(mic.promise);

		const recording = camera.toggleRecording();
		cleanup();
		mic.reject(new DOMException('', 'NotAllowedError'));
		await recording;

		expect(toast.info).not.toHaveBeenCalled();
		expect(FakeRecorder.instances).toHaveLength(0);
	});

	it('records WebM with the preferred codec when the browser supports it', async () => {
		FakeRecorder.supported = 'video/webm;codecs=vp9,opus';
		const { camera } = await openCamera();

		await camera.toggleRecording();

		expect(FakeRecorder.instances[0].options).toEqual({ mimeType: 'video/webm;codecs=vp9,opus' });
	});

	it('saves a WebM recording as a .webm file', async () => {
		FakeRecorder.supported = 'video/webm;codecs=vp9,opus';
		const { camera } = await openCamera();
		await camera.toggleRecording();

		await camera.toggleRecording();

		const file = oncapture.mock.calls[0][0] as File;
		expect(file.name).toMatch(/^camera-\d{17}\.webm$/);
		expect(file.type).toBe('video/webm');
	});

	it('falls back to MP4 and saves a .mp4 file', async () => {
		FakeRecorder.supported = 'video/mp4';
		const { camera } = await openCamera();
		await camera.toggleRecording();

		await camera.toggleRecording();

		expect(FakeRecorder.instances[0].options).toEqual({ mimeType: 'video/mp4' });
		const file = oncapture.mock.calls[0][0] as File;
		expect(file.name).toMatch(/^camera-\d{17}\.mp4$/);
		expect(file.type).toBe('video/mp4');
	});

	it('lets the browser pick the format when none is supported, and saves WebM', async () => {
		const { camera } = await openCamera();
		await camera.toggleRecording();

		await camera.toggleRecording();

		expect(FakeRecorder.instances[0].options).toBeUndefined();
		const file = oncapture.mock.calls[0][0] as File;
		expect(file.type).toBe('video/webm');
	});

	it('saves nothing when the recording has no data', async () => {
		const { camera } = await openCamera();
		await camera.toggleRecording();
		FakeRecorder.instances[0].nextChunk = new Blob([]);

		await camera.toggleRecording();

		expect(oncapture).not.toHaveBeenCalled();
	});

	it('counts seconds while recording, then resets and stops the counter on stop', async () => {
		vi.useFakeTimers();
		const { camera } = await openCamera();
		await camera.toggleRecording();

		expect(camera.recording).toBe(true);
		vi.advanceTimersByTime(3000);
		expect(camera.seconds).toBe(3);

		await camera.toggleRecording();
		expect(camera.recording).toBe(false);
		vi.advanceTimersByTime(5000);
		expect(camera.seconds).toBe(3);
	});
});

describe('Camera cleanup while recording', () => {
	it('stops the recorder without saving, and stops the tracks', async () => {
		const { camera, cleanup, stream } = await openCamera();
		await camera.toggleRecording();
		const recorder = FakeRecorder.instances[0];

		cleanup();

		expect(recorder.stop).toHaveBeenCalledTimes(1);
		expect(recorder.onstop).toBeNull();
		expect(oncapture).not.toHaveBeenCalled();
		expect(stream.tracks[0].stop).toHaveBeenCalled();
		expect(camera.recording).toBe(false);
	});

	it('does not stop a recorder that has already stopped', async () => {
		const { camera, cleanup } = await openCamera();
		await camera.toggleRecording();
		const recorder = FakeRecorder.instances[0];
		recorder.state = 'inactive';

		cleanup();

		expect(recorder.stop).not.toHaveBeenCalled();
	});
});
