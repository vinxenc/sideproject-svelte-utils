import { OTP_EXPIRES_SECONDS } from '#lib/server/email-otp.js';
import type { MailMessage } from './mailer.js';

// Plain-text messages, one function per consumer.

/** The step-up code email. The code never goes in the subject, so it stays out of notification previews. */
export function otpMessage(to: string, code: string): MailMessage {
	return {
		to,
		subject: 'Your verification code',
		text: `Your verification code is ${code}.\n\nIt expires in ${OTP_EXPIRES_SECONDS / 60} minutes. If you did not ask for it, ignore this email.`
	};
}
