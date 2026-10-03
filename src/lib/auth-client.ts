import { createAuthClient } from 'better-auth/svelte';

// Same-origin: talks to /api/auth/* (src/routes/api/auth/[...all]/+server.ts).
export const authClient = createAuthClient();
