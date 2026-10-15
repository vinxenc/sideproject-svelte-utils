import { describe, expect, it } from 'vitest';
import { otpMessage, verifyEmailMessage } from '#lib/server/mail/messages.js';

describe('otpMessage', () => {
	it('addresses the recipient and states the code and the ten-minute expiry in plain text', () => {
		const message = otpMessage('ann@example.com', '987654');

		expect(message.to).toBe('ann@example.com');
		expect(message.text).toContain('987654');
		expect(message.text).toContain('10 minutes');
		expect(message.text).toBe(
			'Your verification code is 987654.\n\nIt expires in 10 minutes. If you did not ask for it, ignore this email.'
		);
	});

	it('never puts the code in the subject', () => {
		const message = otpMessage('ann@example.com', '987654');

		expect(message.subject).toBe('Your verification code');
		expect(message.subject).not.toContain('987654');
	});
});

describe('verifyEmailMessage', () => {
	it('states the code and the ten-minute expiry in plain text', () => {
		const message = verifyEmailMessage('ann@example.com', '987654');

		expect(message.to).toBe('ann@example.com');
		expect(message.text).toBe(
			'Your code to verify your email is 987654.\n\nIt expires in 10 minutes. If you did not ask for it, ignore this email.'
		);
		expect(message.text).toContain('ignore this email');
	});

	it('has the subject "Verify your email" and never puts the code in it', () => {
		const message = verifyEmailMessage('ann@example.com', '987654');

		expect(message.subject).toBe('Verify your email');
		expect(message.subject).not.toContain('987654');
	});
});
