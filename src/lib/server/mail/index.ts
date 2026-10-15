import { MAIL_FROM, SMTP_URL } from '$app/env/private';
import type { Mailer } from './mailer.js';
import { SmtpMailer } from './smtp-mailer.js';

// The one line that picks the mail service. SMTP covers Resend, SES and Postmark; a new class is only
// needed for an HTTP-only provider.
export const mailer: Mailer = new SmtpMailer(SMTP_URL, MAIL_FROM);
export type { Mailer, MailMessage } from './mailer.js';
