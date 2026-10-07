<script lang="ts">
	import CameraIcon from '@lucide/svelte/icons/camera';
	import VideoIcon from '@lucide/svelte/icons/video';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import { formatDuration } from '#lib/media/format.js';
	import { cn } from '#lib/utils.js';

	let { oncapture, onclose }: { oncapture: (file: File) => void; onclose: () => void } = $props();

	let video: HTMLVideoElement | undefined = $state();
	let stream: MediaStream | undefined;
	let live = $state(false);
	let mode = $state<'photo' | 'video'>('photo');
	let recorder = $state<MediaRecorder>();
	let seconds = $state(0);
	let timer: ReturnType<typeof setInterval> | undefined;

	const stamp = () => new Date().toISOString().replace(/\D/g, '').slice(0, 17);

	function stop() {
		clearInterval(timer);
		// Leaving the camera drops a recording in progress, but not one that was just stopped: its
		// `stop` event is still queued and delivers the file.
		if (recorder && recorder.state !== 'inactive') {
			recorder.onstop = null;
			recorder.stop();
		}
		stream?.getTracks().forEach((track) => track.stop());
	}

	let gone = false;
	onMount(() => {
		navigator.mediaDevices
			.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
			.then((s) => {
				if (gone) return s.getTracks().forEach((track) => track.stop());
				stream = s;
				if (video) video.srcObject = s;
				live = true;
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
				onclose();
			});
		return () => {
			gone = true;
			stop();
		};
	});

	async function snap() {
		if (!video || !live || !video.videoWidth) return;
		const canvas = document.createElement('canvas');
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		canvas.getContext('2d')?.drawImage(video, 0, 0);
		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, 'image/jpeg', 0.92)
		);
		if (blob) oncapture(new File([blob], `camera-${stamp()}.jpg`, { type: 'image/jpeg' }));
	}

	// True while the microphone prompt is open, so a second press doesn't start a second recording.
	let asking = false;

	async function toggleRecording() {
		if (recorder) return recorder.stop();
		if (!stream || !live || asking) return;
		if (!stream.getAudioTracks().length) {
			// Sound is asked for when the first recording starts, not when the camera opens.
			asking = true;
			try {
				const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
				if (gone) return audio.getTracks().forEach((track) => track.stop());
				audio.getAudioTracks().forEach((track) => stream?.addTrack(track));
			} catch {
				if (gone) return;
				toast.info('Recording without sound');
			} finally {
				asking = false;
			}
		}
		const type = ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'].find((t) =>
			MediaRecorder.isTypeSupported(t)
		);
		const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
		const chunks: Blob[] = [];
		rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
		rec.onstop = () => {
			clearInterval(timer);
			recorder = undefined;
			const mime = (rec.mimeType || type || 'video/webm').split(';')[0];
			if (chunks.length)
				oncapture(
					new File(chunks, `camera-${stamp()}.${mime === 'video/mp4' ? 'mp4' : 'webm'}`, {
						type: mime
					})
				);
		};
		rec.start();
		recorder = rec;
		seconds = 0;
		timer = setInterval(() => seconds++, 1000);
	}
</script>

<!-- Covers the whole upload dialog. Every photo or recording goes straight to the upload dialog's list. -->
<div class="absolute inset-0 z-10 flex flex-col rounded-[inherit] bg-black text-white">
	<div class="relative min-h-0 flex-1">
		<video bind:this={video} autoplay playsinline muted class="size-full object-contain"></video>
		{#if !live}
			<span class="absolute inset-0 flex items-center justify-center"><Spinner /></span>
		{/if}
		{#if recorder}
			<span
				class="absolute top-3 left-3 rounded-full bg-red-600 px-2.5 py-1 text-xs font-medium tabular-nums"
			>
				{formatDuration(seconds)}
			</span>
		{/if}
	</div>

	<div
		class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-4 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]"
	>
		<div class="flex gap-1">
			<Button
				variant={mode === 'photo' ? 'secondary' : 'ghost'}
				size="icon"
				disabled={!!recorder}
				onclick={() => (mode = 'photo')}
			>
				<CameraIcon />
				<span class="sr-only">Photo</span>
			</Button>
			<Button
				variant={mode === 'video' ? 'secondary' : 'ghost'}
				size="icon"
				disabled={!!recorder}
				onclick={() => (mode = 'video')}
			>
				<VideoIcon />
				<span class="sr-only">Video</span>
			</Button>
		</div>

		<button
			type="button"
			disabled={!live}
			class="flex size-16 items-center justify-center rounded-full border-4 border-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
			onclick={() => (mode === 'photo' ? snap() : toggleRecording())}
		>
			<span
				class={cn(
					'block bg-white transition-all',
					mode === 'video' && 'bg-red-600',
					recorder ? 'size-6 rounded-sm' : 'size-11 rounded-full'
				)}
			></span>
			<span class="sr-only">
				{mode === 'photo' ? 'Take photo' : recorder ? 'Stop recording' : 'Start recording'}
			</span>
		</button>

		<div class="flex justify-end">
			<Button variant="secondary" disabled={!!recorder} onclick={onclose}>Done</Button>
		</div>
	</div>
</div>
