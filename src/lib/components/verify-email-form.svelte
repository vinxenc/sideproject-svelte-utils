<script lang="ts">
	import * as Field from '#lib/components/ui/field/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as InputOTP from '#lib/components/ui/input-otp/index.js';
	import { REGEXP_ONLY_DIGITS } from 'bits-ui';
	import { authClient } from '#lib/auth-client.js';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { cn } from '#lib/utils.js';
	import {
		NETWORK_ERROR,
		OTP_LENGTH,
		describeResendError,
		describeVerifyError,
		forgetPending,
		maskEmail,
		readHeldPassword,
		readPending,
		rememberPending,
		secondsLeft
	} from '#lib/verify-email.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let { class: className, ...restProps }: HTMLAttributes<HTMLFormElement> = $props();

	const id = $props.id();

	let email = $state(''); // from sessionStorage, left there by sign-up or an unverified sign-in
	let loaded = $state(false); // sessionStorage read (client only)
	let password = $state(''); // held in memory by sign-up / sign-in, or typed in the field after a reload
	let hasHeldPassword = $state(false); // true → no password field
	let code = $state(''); // bound to InputOTP.Root
	let sentAt = $state<number | null>(null);
	let now = $state(Date.now());
	let verifying = $state(false);
	let resending = $state(false);
	let error = $state('');
	let notice = $state(''); // "A new code is on its way."
	let needsNewCode = $state(false); // after TOO_MANY_ATTEMPTS / OTP_EXPIRED: input disabled until a resend succeeds
	const wait = $derived(sentAt === null ? 0 : secondsLeft(sentAt, now));

	onMount(() => {
		const pending = readPending();
		if (!pending) {
			// Nothing to verify in this tab: sign-in sends a fresh code to an unverified account.
			void goto('/sign-in');
			return;
		}
		email = pending.email;
		sentAt = pending.sentAt;
		password = readHeldPassword();
		hasHeldPassword = password !== '';
		loaded = true;
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	async function verify(value: string): Promise<void> {
		if (verifying || value.length !== OTP_LENGTH) return;
		if (password === '') {
			error = 'Enter your password first.';
			return;
		}
		verifying = true;
		error = '';
		notice = '';
		try {
			// The server hook (EMAIL_VERIFICATION_HOOKS) reads the password from the raw body; the typed client
			// does not know the field.
			const result = await authClient.$fetch<{ status: boolean }>('/email-otp/verify-email', {
				method: 'POST',
				body: { email, otp: value, password }
			});
			if (result.error) {
				const view = describeVerifyError(result.error);
				error = view.message;
				needsNewCode = view.needsNewCode;
				code = '';
				return;
			}
			forgetPending();
			await goto('/dashboard', { invalidateAll: true });
		} catch {
			error = NETWORK_ERROR;
			// Clear the boxes too: a full code re-fires onComplete when the input is re-enabled, which would loop.
			code = '';
		} finally {
			verifying = false;
		}
	}

	async function resend(): Promise<void> {
		if (resending || wait > 0) return;
		resending = true;
		error = '';
		notice = '';
		try {
			const result = await authClient.emailOtp.sendVerificationOtp({
				email,
				type: 'email-verification'
			});
			if (result.error) {
				error = describeResendError(result.error);
				if (result.error.status === 429) sentAt = Date.now();
				return;
			}
			sentAt = Date.now();
			now = sentAt;
			rememberPending(email, sentAt);
			needsNewCode = false;
			code = '';
			notice = 'A new code is on its way.';
		} catch {
			error = NETWORK_ERROR;
		} finally {
			resending = false;
		}
	}

	function onsubmit(event: SubmitEvent) {
		event.preventDefault();
		void verify(code);
	}
</script>

<form class={cn('flex flex-col gap-6', className)} {onsubmit} {...restProps}>
	<Field.Group>
		<div class="flex flex-col items-center gap-1 text-center">
			<h1 class="text-2xl font-bold">Verify your email</h1>
			<p class="min-h-5 text-sm text-balance text-muted-foreground">
				{#if !loaded}
					&nbsp;
				{:else}
					We sent a 6-digit code to <span class="font-medium text-foreground"
						>{maskEmail(email)}</span
					>.
				{/if}
			</p>
		</div>
		{#if loaded && !hasHeldPassword}
			<Field.Field>
				<Field.Label for="password-{id}">Password</Field.Label>
				<Input
					id="password-{id}"
					type="password"
					autocomplete="current-password"
					required
					bind:value={password}
				/>
				<Field.Description>The password you chose when you signed up.</Field.Description>
			</Field.Field>
		{/if}
		<Field.Field>
			<Field.Label for="otp-{id}" class="sr-only">Verification code</Field.Label>
			<InputOTP.Root
				maxlength={OTP_LENGTH}
				inputId="otp-{id}"
				pattern={REGEXP_ONLY_DIGITS}
				bind:value={code}
				onComplete={(value: string) => void verify(value)}
				disabled={verifying || needsNewCode}
				class="justify-center"
			>
				{#snippet children({ cells })}
					<InputOTP.Group
						class="gap-2 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border"
					>
						{#each cells.slice(0, 3) as cell (cell)}
							<InputOTP.Slot {cell} aria-invalid={error ? true : undefined} />
						{/each}
					</InputOTP.Group>
					<InputOTP.Separator />
					<InputOTP.Group
						class="gap-2 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border"
					>
						{#each cells.slice(3, 6) as cell (cell)}
							<InputOTP.Slot {cell} aria-invalid={error ? true : undefined} />
						{/each}
					</InputOTP.Group>
				{/snippet}
			</InputOTP.Root>
			<Field.Description class="text-center">The code expires in 10 minutes.</Field.Description>
		</Field.Field>
		<Field.Field>
			<Field.Error>{error}</Field.Error>
			{#if notice}<p role="status" class="text-center text-sm text-muted-foreground">
					{notice}
				</p>{/if}
			<Button type="submit" disabled={verifying || needsNewCode || code.length !== OTP_LENGTH}>
				{verifying ? 'Verifying…' : 'Verify'}
			</Button>
			<Button type="button" variant="outline" disabled={resending || wait > 0} onclick={resend}>
				{wait > 0 ? `Resend code in ${wait}s` : resending ? 'Sending…' : 'Resend code'}
			</Button>
			<Field.Description class="text-center">
				<a href="/sign-in" class="underline underline-offset-4">Back to sign in</a>
				·
				<a href="/sign-up" class="underline underline-offset-4">Start over</a>
			</Field.Description>
		</Field.Field>
	</Field.Group>
</form>
