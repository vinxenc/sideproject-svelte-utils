import nodemailer, { type Transporter } from 'nodemailer';
import type { Mailer, MailMessage } from './mailer.js';

/** Sends mail over SMTP. The transport is created on the first send and reused after that. */
export class SmtpMailer implements Mailer {
	#url: string;
	#from: string;
	#transport?: Transporter;

	constructor(url: string, from: string) {
		this.#url = url;
		this.#from = from;
	}

	async send(message: MailMessage): Promise<void> {
		await (this.#transport ??= nodemailer.createTransport(this.#url)).sendMail({
			from: this.#from,
			...message
		});
	}
}
