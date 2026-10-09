import { describe, expect, it } from 'vitest';
import { activeSlug, crumbsFor, NAV, PHOTO_VIDEO, sectionHref, sectionOf } from '#lib/nav.js';

const url = (query = '') => new URL(`http://localhost/dashboard${query}`);

describe('NAV', () => {
	it('lists the 12 sections in the original order, each with a slug', () => {
		expect(NAV.map((item) => item.slug)).toEqual([
			'home',
			'photo-video',
			'notifications',
			'navigation',
			'appearance',
			'messages-media',
			'language-region',
			'accessibility',
			'mark-as-read',
			'connected-accounts',
			'privacy-visibility',
			'advanced'
		]);
		expect(NAV[1].name).toBe('Photo & video');
		expect(PHOTO_VIDEO).toBe('photo-video');
	});
});

describe('sectionHref', () => {
	it('links Home to the bare dashboard and other sections by query', () => {
		expect(sectionHref('home')).toBe('/dashboard');
		expect(sectionHref('notifications')).toBe('/dashboard?section=notifications');
	});

	it('links Photo & video to its own page', () => {
		expect(sectionHref('photo-video')).toBe('/photo-video');
	});
});

describe('sectionOf', () => {
	it('finds the section named in the query', () => {
		expect(sectionOf(url('?section=notifications')).name).toBe('Notifications');
	});

	it('falls back to Home when the section is missing or unknown', () => {
		expect(sectionOf(url()).name).toBe('Home');
		expect(sectionOf(url('?section=bogus')).name).toBe('Home');
	});
});

describe('activeSlug', () => {
	it('highlights Photo & video on every page under /photo-video', () => {
		expect(activeSlug('/(app)/photo-video', url())).toBe('photo-video');
		expect(activeSlug('/(app)/photo-video/albums', url())).toBe('photo-video');
		expect(activeSlug('/(app)/photo-video/albums/[id]', url('?section=advanced'))).toBe(
			'photo-video'
		);
	});

	it('otherwise highlights the section in the URL', () => {
		expect(activeSlug('/(app)/dashboard', url('?section=advanced'))).toBe('advanced');
		expect(activeSlug('/(app)/dashboard', url())).toBe('home');
	});
});

describe('crumbsFor', () => {
	it('shows Photo & video (linked to its page) then Album on the album list', () => {
		expect(crumbsFor('/(app)/photo-video/albums', url(), {})).toEqual([
			{ label: 'Photo & video', href: '/photo-video' },
			{ label: 'Album' }
		]);
	});

	it('shows the album name last on the album page, with Album linking back to the list', () => {
		expect(crumbsFor('/(app)/photo-video/albums/[id]', url(), { album: { name: 'Trip' } })).toEqual(
			[
				{ label: 'Photo & video', href: '/photo-video' },
				{ label: 'Album', href: '/photo-video/albums' },
				{ label: 'Trip' }
			]
		);
	});

	it('falls back to Album when the album data is missing', () => {
		expect(crumbsFor('/(app)/photo-video/albums/[id]', url(), {}).at(-1)).toEqual({
			label: 'Album'
		});
	});

	it('shows only Photo & video on its page, and only the section name elsewhere', () => {
		expect(crumbsFor('/(app)/photo-video', url(), {})).toEqual([{ label: 'Photo & video' }]);
		expect(crumbsFor('/(app)/dashboard', url('?section=notifications'), {})).toEqual([
			{ label: 'Notifications' }
		]);
		expect(crumbsFor(null, url(), {})).toEqual([{ label: 'Home' }]);
	});
});
