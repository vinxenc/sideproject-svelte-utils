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
		readPending,
		rememberPending,
		secondsLeft
	} from '#lib/verify-email.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let { class: className, ...restProps }: HTMLAttributes<HTMLFormElement> = $props();

	const id = $props.id();

	let email = $state(''); // from sessionStorage, or typed in the fallback field
	let hasStoredEmail = $state(false); // true → show masked email, hide the email field
	let loaded = $state(false); // sessionStorage read (client only); avoids an SSR flash of the fallback field
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
		if (pending) {
			email = pending.email;
			sentAt = pending.sentAt;
			hasStoredEmail = true;
		}
		loaded = true;
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	async function verify(value: string): Promise<void> {
		if (verifying || value.length !== OTP_LENGTH) return;
		if (email.trim() === '') {
			error = 'Enter your email first.';
			return;
		}
		verifying = true;
		error = '';
		notice = '';
		try {
			const result = await authClient.emailOtp.verifyEmail({ email: email.trim(), otp: value });
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
		if (email.trim() === '') {
			error = 'Enter your email first.';
			return;
		}
		resending = true;
		error = '';
		notice = '';
		try {
			const result = await authClient.emailOtp.sendVerificationOtp({
				email: email.trim(),
				type: 'email-verification'
			});
			if (result.error) {
				error = describeResendError(result.error);
				if (result.error.status === 429) sentAt = Date.now();
				return;
			}
			sentAt = Date.now();
			now = sentAt;
			rememberPending(email.trim(), sentAt);
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
				{:else if hasStoredEmail}
					We sent a 6-digit code to <span class="font-medium text-foreground"
						>{maskEmail(email)}</span
					>.
				{:else}
					Enter your email and the 6-digit code we sent you.
				{/if}
			</p>
		</div>
		{#if loaded && !hasStoredEmail}
			<Field.Field>
				<Field.Label for="email-{id}">Email</Field.Label>
				<Input
					id="email-{id}"
					type="email"
					placeholder="m@example.com"
					autocomplete="email"
					required
					bind:value={email}
				/>
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
			</Field.Description>
		</Field.Field>
	</Field.Group>
</form>
