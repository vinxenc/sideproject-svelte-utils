<script lang="ts">
	import AlbumStrip from '#lib/components/albums/album-strip.svelte';
	import Gallery from '#lib/components/media/gallery.svelte';

	// Bumped when an album changes, so the strip reorders and refreshes.
	let albumsVersion = $state(0);
</script>

<div class="flex flex-col gap-6">
	<AlbumStrip refreshKey={albumsVersion} />
	<Gallery heading={libraryHeading} onalbumschanged={() => albumsVersion++} />
</div>

{#snippet libraryHeading()}
	<h2 class="text-lg font-semibold">Library</h2>
{/snippet}
