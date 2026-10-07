<script lang="ts">
	import CameraIcon from '@lucide/svelte/icons/camera';
	import VideoIcon from '@lucide/svelte/icons/video';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import { Camera } from '#lib/media/camera.svelte.js';
	import { formatDuration } from '#lib/media/format.js';
	import { cn } from '#lib/utils.js';

	let { oncapture, onclose }: { oncapture: (file: File) => void; onclose: () => void } = $props();

	let mode = $state<'photo' | 'video'>('photo');
	const camera = new Camera(
		(file) => oncapture(file),
		() => onclose()
	);
</script>

<!-- Covers the whole upload dialog. Every photo or recording goes straight to the upload dialog's list. -->
<div class="absolute inset-0 z-10 flex flex-col rounded-[inherit] bg-black text-white">
	<div class="relative min-h-0 flex-1">
		<video {@attach camera.attach} autoplay playsinline muted class="size-full object-contain"
		></video>
		{#if !camera.live}
			<span class="absolute inset-0 flex items-center justify-center"><Spinner /></span>
		{/if}
		{#if camera.recording}
			<span
				class="absolute top-3 left-3 rounded-full bg-red-600 px-2.5 py-1 text-xs font-medium tabular-nums"
			>
				{formatDuration(camera.seconds)}
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
				disabled={camera.recording}
				onclick={() => (mode = 'photo')}
			>
				<CameraIcon />
				<span class="sr-only">Photo</span>
			</Button>
			<Button
				variant={mode === 'video' ? 'secondary' : 'ghost'}
				size="icon"
				disabled={camera.recording}
				onclick={() => (mode = 'video')}
			>
				<VideoIcon />
				<span class="sr-only">Video</span>
			</Button>
		</div>

		<button
			type="button"
			disabled={!camera.live}
			class="flex size-16 items-center justify-center rounded-full border-4 border-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
			onclick={() =>
				camera.recording || mode === 'video' ? camera.toggleRecording() : camera.snap()}
		>
			<span
				class={cn(
					'block bg-white transition-all',
					mode === 'video' && 'bg-red-600',
					camera.recording ? 'size-6 rounded-sm' : 'size-11 rounded-full'
				)}
			></span>
			<span class="sr-only">
				{mode === 'photo' ? 'Take photo' : camera.recording ? 'Stop recording' : 'Start recording'}
			</span>
		</button>

		<div class="flex justify-end">
			<Button variant="secondary" disabled={camera.recording} onclick={onclose}>Done</Button>
		</div>
	</div>
</div>
