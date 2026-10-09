<!-- The sections without content yet: the sidebar and breadcrumb come from the (app) layout. -->
{#each Array.from({ length: 10 }, (_, i) => i) as i (i)}
	<div class="aspect-video max-w-3xl rounded-xl bg-muted/50"></div>
{/each}
