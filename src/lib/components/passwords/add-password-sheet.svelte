<script lang="ts">
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { createPassword } from '#lib/passwords/api.js';
	import {
		checkPasswordInput,
		NAME_MAX,
		PASSWORD_MAX,
		PASSWORD_TYPES,
		TYPE_LABELS,
		USERNAME_MAX,
		type PasswordField,
		type PasswordItem,
		type PasswordType
	} from '#lib/passwords/types.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as InputGroup from '#lib/components/ui/input-group/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js';

	let {
		open = $bindable(false),
		defaultType,
		oncreated
	}: {
		open?: boolean;
		/** Preselected type each time the sheet opens. */
		defaultType: PasswordType;
		oncreated: (item: PasswordItem) => void;
	} = $props();

	let name = $state('');
	let username = $state('');
	let password = $state('');
	let type = $state<PasswordType>('APP');
	let show = $state(false);
	let error = $state<{ field: PasswordField | null; message: string } | null>(null);
	let pending = $state(false);

	function reset(): void {
		name = '';
		username = '';
		password = '';
		type = defaultType;
		show = false;
		error = null;
	}

	// Reset on every open. The effect depends only on `open`, so `defaultType` is read once per opening.
	$effect(() => {
		if (open) untrack(reset);
	});

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (pending) return;
		const checked = checkPasswordInput({ name, username, password, type });
		if (!checked.ok) {
			error = { field: checked.field, message: checked.error };
			return;
		}
		error = null;
		pending = true;
		try {
			const item = await createPassword(checked.input);
			open = false;
			toast.success('Password saved');
			oncreated(item);
		} catch (e) {
			// The sheet stays open, so the entry can be corrected or retried.
			error = { field: null, message: e instanceof Error ? e.message : 'Something went wrong' };
		} finally {
			pending = false;
		}
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="data-[side=right]:w-full data-[side=right]:sm:max-w-sm">
		<Sheet.Header>
			<Sheet.Title>Add password</Sheet.Title>
			<Sheet.Description>Saved to your vault. Only you can see it.</Sheet.Description>
		</Sheet.Header>

		<form novalidate onsubmit={submit} class="flex flex-1 flex-col">
			<Field.FieldGroup class="px-4">
				<Field.Field data-invalid={error?.field === 'name' ? true : undefined}>
					<Field.Label for="password-name">Name</Field.Label>
					<Input
						id="password-name"
						maxlength={NAME_MAX}
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
						bind:value={name}
						aria-invalid={error?.field === 'name'}
					/>
					{#if error?.field === 'name'}
						<Field.Error>{error.message}</Field.Error>
					{/if}
				</Field.Field>

				<Field.Field data-invalid={error?.field === 'type' ? true : undefined}>
					<Field.Label id="password-type-label">Type</Field.Label>
					<ToggleGroup.Root
						type="single"
						variant="outline"
						size="sm"
						spacing={2}
						class="flex-wrap"
						aria-labelledby="password-type-label"
						bind:value={
							() => type,
							(v) => {
								// Clicking the selected item again would set '' here; keep the selection.
								if (v) type = v as PasswordType;
							}
						}
					>
						{#each PASSWORD_TYPES as t (t)}
							<ToggleGroup.Item value={t}>{TYPE_LABELS[t]}</ToggleGroup.Item>
						{/each}
					</ToggleGroup.Root>
					{#if error?.field === 'type'}
						<Field.Error>{error.message}</Field.Error>
					{/if}
				</Field.Field>

				<Field.Field data-invalid={error?.field === 'username' ? true : undefined}>
					<Field.Label for="password-username">Username or email (optional)</Field.Label>
					<Input
						id="password-username"
						maxlength={USERNAME_MAX}
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
						bind:value={username}
						aria-invalid={error?.field === 'username'}
					/>
					{#if error?.field === 'username'}
						<Field.Error>{error.message}</Field.Error>
					{/if}
				</Field.Field>

				<Field.Field data-invalid={error?.field === 'password' ? true : undefined}>
					<Field.Label for="password-value">Password</Field.Label>
					<InputGroup.Root>
						<InputGroup.Input
							id="password-value"
							type={show ? 'text' : 'password'}
							maxlength={PASSWORD_MAX}
							autocomplete="new-password"
							autocapitalize="off"
							spellcheck="false"
							bind:value={password}
							aria-invalid={error?.field === 'password'}
						/>
						<InputGroup.Addon align="inline-end">
							<InputGroup.Button
								variant="ghost"
								size="icon-xs"
								aria-label={show ? 'Hide password' : 'Show password'}
								onclick={() => (show = !show)}
							>
								{#if show}
									<EyeOffIcon />
								{:else}
									<EyeIcon />
								{/if}
							</InputGroup.Button>
						</InputGroup.Addon>
					</InputGroup.Root>
					{#if error?.field === 'password'}
						<Field.Error>{error.message}</Field.Error>
					{/if}
				</Field.Field>

				{#if error && error.field === null}
					<Field.Error>{error.message}</Field.Error>
				{/if}
			</Field.FieldGroup>

			<Sheet.Footer>
				<Button type="submit" disabled={pending || !name.trim() || !password}>
					{#if pending}
						<Spinner data-icon="inline-start" />
					{/if}
					Save
				</Button>
				<Sheet.Close class={buttonVariants({ variant: 'outline' })}>Cancel</Sheet.Close>
			</Sheet.Footer>
		</form>
	</Sheet.Content>
</Sheet.Root>
