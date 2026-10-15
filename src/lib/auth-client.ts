import { createAuthClient } from 'better-auth/svelte';
import { emailOTPClient } from 'better-auth/client/plugins';

// Same-origin: talks to /api/auth/* (src/routes/api/auth/[...all]/+server.ts).
// emailOTPClient adds authClient.emailOtp.verifyEmail / sendVerificationOtp (the only two open plugin routes).
export const authClient = createAuthClient({ plugins: [emailOTPClient()] });
