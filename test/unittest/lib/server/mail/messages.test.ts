import { describe, expect, it } from 'vitest';
import { otpMessage } from '#lib/server/mail/messages.js';

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
