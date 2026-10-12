import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SmtpMailer } from '#lib/server/mail/smtp-mailer.js';

const nodemailer = vi.hoisted(() => {
	const sendMail = vi.fn();
	return { sendMail, createTransport: vi.fn(() => ({ sendMail })) };
});
vi.mock('nodemailer', () => ({ default: { createTransport: nodemailer.createTransport } }));

const MESSAGE = { to: 'ann@example.com', subject: 'Hi', text: 'Hello' };

describe('SmtpMailer', () => {
	beforeEach(() => {
		nodemailer.sendMail.mockReset();
		nodemailer.sendMail.mockResolvedValue({});
		nodemailer.createTransport.mockClear();
	});

	it('does not open a transport when constructed', () => {
		new SmtpMailer('smtp://mail.test:1025', 'Utilities <no-reply@test>');

		expect(nodemailer.createTransport).not.toHaveBeenCalled();
	});

	it('creates the transport once, from the URL, and reuses it', async () => {
		const mailer = new SmtpMailer('smtp://mail.test:1025', 'Utilities <no-reply@test>');

		await mailer.send(MESSAGE);
		await mailer.send(MESSAGE);

		expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
		expect(nodemailer.createTransport).toHaveBeenCalledWith('smtp://mail.test:1025');
	});

	it('sends from the configured sender with the message fields', async () => {
		const mailer = new SmtpMailer('smtp://mail.test:1025', 'Utilities <no-reply@test>');

		await mailer.send(MESSAGE);

		expect(nodemailer.sendMail).toHaveBeenCalledWith({
			from: 'Utilities <no-reply@test>',
			to: 'ann@example.com',
			subject: 'Hi',
			text: 'Hello'
		});
	});

	it('propagates a sendMail rejection', async () => {
		nodemailer.sendMail.mockRejectedValueOnce(new Error('boom'));
		const mailer = new SmtpMailer('smtp://mail.test:1025', 'Utilities <no-reply@test>');

		await expect(mailer.send(MESSAGE)).rejects.toThrow('boom');
	});
});
