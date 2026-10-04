<script lang="ts">
	import LoginForm from '#lib/components/login-form.svelte';
</script>

<svelte:head>
	<title>Sign in · Utilities</title>
</svelte:head>

<div class="grid flex-1 lg:grid-cols-2">
	<div class="flex flex-col gap-4 p-6 md:p-10">
		<div class="flex flex-1 items-center justify-center">
			<div class="w-full max-w-xs">
				<LoginForm />
			</div>
		</div>
	</div>
	<div class="relative hidden bg-muted lg:block">
		<img
			src="/placeholder.svg"
			alt="placeholder"
			class="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
		/>
	</div>
</div>
