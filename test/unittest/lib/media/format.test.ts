import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration } from '#lib/media/format.js';

describe('formatDuration', () => {
	it.each([
		[0, '0:00'],
		[75, '1:15'],
		[3725, '1:02:05'],
		[59.6, '1:00'],
		[-5, '0:00']
	])('%s s -> %s', (seconds, expected) => expect(formatDuration(seconds)).toBe(expected));
});

describe('formatBytes', () => {
	it.each([
		[0, '0 B'],
		[1023, '1023 B'],
		[1536, '1.5 KB'],
		[10 * 1024, '10 KB'],
		[52428800, '50 MB'],
		[3 * 1024 ** 3, '3.0 GB'],
		[2 * 1024 ** 4, '2048 GB']
	])('%s bytes -> %s', (bytes, expected) => expect(formatBytes(bytes)).toBe(expected));
});
