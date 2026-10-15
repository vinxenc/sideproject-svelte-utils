import { describe, expect, it, vi } from 'vitest';
import { mailer } from '#lib/server/mail/index.js';
import { SmtpMailer } from '#lib/server/mail/smtp-mailer.js';

const nodemailer = vi.hoisted(() => ({
	createTransport: vi.fn(() => ({ sendMail: vi.fn() }))
}));
vi.mock('nodemailer', () => ({ default: { createTransport: nodemailer.createTransport } }));

describe('mail', () => {
	it('exports an SmtpMailer as the app mailer', () => {
		expect(mailer).toBeInstanceOf(SmtpMailer);
	});

	it('does not open a connection on import', () => {
		expect(nodemailer.createTransport).not.toHaveBeenCalled();
	});
});
