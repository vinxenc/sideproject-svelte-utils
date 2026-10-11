<script lang="ts">
	import * as Avatar from '#lib/components/ui/avatar/index.js';
	import { avatarFor } from '#lib/passwords/avatar.js';
	import { cn } from '#lib/utils.js';

	let { name, class: className }: { name: string; class?: string } = $props();

	const avatar = $derived(avatarFor(name));
</script>

<!-- The generated avatar is a circle; the password tile is a rounded square, so the root's `after:` ring is squared off too. -->
<Avatar.Root aria-hidden="true" class={cn('size-10 rounded-lg after:rounded-lg', className)}>
	<Avatar.Fallback class={cn('rounded-lg font-semibold text-white', avatar.className)}>
		{avatar.letter}
	</Avatar.Fallback>
</Avatar.Root>
