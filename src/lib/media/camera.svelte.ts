import { toast } from 'svelte-sonner';

const stamp = () => new Date().toISOString().replace(/\D/g, '').slice(0, 17);
const stopTracks = (stream: MediaStream) => stream.getTracks().forEach((track) => track.stop());

/**
 * The device camera behind the capture screen: opens the stream into a <video> (via `attach`),
 * takes photos and records clips, and hands every result to `oncapture`. `onclose` is called when the
 * camera can't be opened. Releasing the stream is the attachment's cleanup.
 */
export class Camera {
	live = $state(false);
	recording = $state(false);
	/** Seconds into the current recording. */
	seconds = $state(0);

	#video: HTMLVideoElement | undefined;
	#stream: MediaStream | undefined;
	#recorder: MediaRecorder | undefined;
	#timer: ReturnType<typeof setInterval> | undefined;
	#gone = false;
	// True while the microphone prompt is open, so a second press doesn't start a second recording.
	#asking = false;

	oncapture: (file: File) => void;
	onclose: () => void;

	constructor(oncapture: (file: File) => void, onclose: () => void) {
		this.oncapture = oncapture;
		this.onclose = onclose;
	}

	/** `{@attach camera.attach}` on the <video>. */
	attach = (video: HTMLVideoElement) => {
		this.#video = video;
		this.#gone = false;
		this.#open(video);
		return () => {
			this.#gone = true;
			clearInterval(this.#timer);
			// Leaving the camera drops a recording in progress, but not one that was just stopped: its
			// `stop` event is still queued and delivers the file.
			if (this.#recorder && this.#recorder.state !== 'inactive') {
				this.#recorder.onstop = null;
				this.#recorder.stop();
			}
			if (this.#stream) stopTracks(this.#stream);
			this.#stream = this.#recorder = this.#video = undefined;
			this.live = this.recording = false;
		};
	};

	#open(video: HTMLVideoElement) {
		// Missing on a page that isn't served over HTTPS (or in an old browser).
		if (!navigator.mediaDevices?.getUserMedia) {
			toast.error('The camera needs a secure (https) page');
			this.onclose();
			return;
		}
		navigator.mediaDevices
			.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
			.then((stream) => {
				if (this.#gone) return stopTracks(stream);
				this.#stream = stream;
				video.srcObject = stream;
				this.live = true;
			})
			.catch((e: unknown) => {
				const name = e instanceof DOMException ? e.name : '';
				toast.error(
					name === 'NotFoundError'
						? 'No camera found'
						: name === 'NotAllowedError'
							? 'Allow camera access to take photos'
							: "Couldn't open the camera"
				);
				this.onclose();
			});
	}

	async snap() {
		const video = this.#video;
		if (!video || !this.live || !video.videoWidth) return;
		const canvas = document.createElement('canvas');
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		canvas.getContext('2d')?.drawImage(video, 0, 0);
		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, 'image/jpeg', 0.92)
		);
		if (blob) this.oncapture(new File([blob], `camera-${stamp()}.jpg`, { type: 'image/jpeg' }));
	}

	async toggleRecording() {
		if (this.#recorder) return this.#recorder.stop();
		const stream = this.#stream;
		if (!stream || !this.live || this.#asking) return;
		if (!stream.getAudioTracks().length) {
			// Sound is asked for when the first recording starts, not when the camera opens.
			this.#asking = true;
			try {
				const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
				if (this.#gone) return stopTracks(audio);
				audio.getAudioTracks().forEach((track) => stream.addTrack(track));
			} catch {
				if (this.#gone) return;
				toast.info('Recording without sound');
			} finally {
				this.#asking = false;
			}
		}
		const type = ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'].find((t) =>
			MediaRecorder.isTypeSupported(t)
		);
		const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
		const chunks: Blob[] = [];
		rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
		rec.onstop = () => {
			clearInterval(this.#timer);
			this.#recorder = undefined;
			this.recording = false;
			const mime = (rec.mimeType || type || 'video/webm').split(';')[0];
			if (chunks.length)
				this.oncapture(
					new File(chunks, `camera-${stamp()}.${mime === 'video/mp4' ? 'mp4' : 'webm'}`, {
						type: mime
					})
				);
		};
		rec.start();
		this.#recorder = rec;
		this.recording = true;
		this.seconds = 0;
		this.#timer = setInterval(() => this.seconds++, 1000);
	}
}
