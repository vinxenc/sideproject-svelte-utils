<script lang="ts">
	let { oncapture, onclose }: { oncapture: (file: File) => void; onclose: () => void } = $props();
</script>

<button
	type="button"
	onclick={() => oncapture(new File(['x'], 'shot.jpg', { type: 'image/jpeg' }))}
>
	Stub capture
</button>
<button type="button" onclick={() => onclose()}>Stub close</button>
