/** One plain-text email. */
export type MailMessage = { to: string; subject: string; text: string };

/** The only mail API the app uses; swap the implementation in mail/index.ts. */
export interface Mailer {
	send(message: MailMessage): Promise<void>;
}
