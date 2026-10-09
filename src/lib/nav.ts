// The dashboard's sections, which live in the URL (`/dashboard?section=<slug>`) so that other pages can link back to them.

import BellIcon from '@lucide/svelte/icons/bell';
import CheckIcon from '@lucide/svelte/icons/check';
import GlobeIcon from '@lucide/svelte/icons/globe';
import HouseIcon from '@lucide/svelte/icons/house';
import KeyboardIcon from '@lucide/svelte/icons/keyboard';
import LinkIcon from '@lucide/svelte/icons/link';
import LockIcon from '@lucide/svelte/icons/lock';
import MenuIcon from '@lucide/svelte/icons/menu';
import MessageCircleIcon from '@lucide/svelte/icons/message-circle';
import PaintbrushIcon from '@lucide/svelte/icons/paintbrush';
import SettingsIcon from '@lucide/svelte/icons/settings';
import VideoIcon from '@lucide/svelte/icons/video';

export type NavItem = { name: string; slug: string; icon: typeof HouseIcon };

/** sidebar-13's settings nav, in its original order. */
export const NAV: NavItem[] = [
	{ name: 'Home', slug: 'home', icon: HouseIcon },
	{ name: 'Photo & video', slug: 'photo-video', icon: VideoIcon },
	{ name: 'Notifications', slug: 'notifications', icon: BellIcon },
	{ name: 'Navigation', slug: 'navigation', icon: MenuIcon },
	{ name: 'Appearance', slug: 'appearance', icon: PaintbrushIcon },
	{ name: 'Messages & media', slug: 'messages-media', icon: MessageCircleIcon },
	{ name: 'Language & region', slug: 'language-region', icon: GlobeIcon },
	{ name: 'Accessibility', slug: 'accessibility', icon: KeyboardIcon },
	{ name: 'Mark as read', slug: 'mark-as-read', icon: CheckIcon },
	{ name: 'Connected accounts', slug: 'connected-accounts', icon: LinkIcon },
	{ name: 'Privacy & visibility', slug: 'privacy-visibility', icon: LockIcon },
	{ name: 'Advanced', slug: 'advanced', icon: SettingsIcon }
];
export const PHOTO_VIDEO = 'photo-video';
/** Photo & video has its own pages: the library, the album list and each album. */
export const PHOTO_VIDEO_HREF = '/photo-video';

/** 'home' -> '/dashboard'; 'photo-video' -> '/photo-video'; anything else -> `/dashboard?section=${slug}` */
export function sectionHref(slug: string) {
	if (slug === PHOTO_VIDEO) return PHOTO_VIDEO_HREF;
	return slug === 'home' ? '/dashboard' : `/dashboard?section=${slug}`;
}

/** What the nav needs from the page URL; `$app/state`'s readonly URL has this shape too. */
type PageUrl = { searchParams: { get(name: string): string | null } };

/** The NAV item whose slug is url.searchParams.get('section'); Home when missing or unknown. */
export function sectionOf(url: PageUrl): NavItem {
	const slug = url.searchParams.get('section');
	return NAV.find((item) => item.slug === slug) ?? NAV[0];
}

/** Highlighted slug: 'photo-video' for every page under /photo-video, otherwise sectionOf(url).slug. */
export function activeSlug(routeId: string | null, url: PageUrl): string {
	if (routeId?.startsWith('/(app)/photo-video')) return PHOTO_VIDEO;
	return sectionOf(url).slug;
}

export type Crumb = { label: string; href?: string };

/**
 * '/(app)/photo-video'              -> [{ label: 'Photo & video' }]
 * '/(app)/photo-video/albums'       -> [{ 'Photo & video', href: '/photo-video' }, { label: 'Album' }]
 * '/(app)/photo-video/albums/[id]'  -> [{ 'Photo & video', href: '/photo-video' }, { label: 'Album', href: '/photo-video/albums' }, { label: data.album?.name ?? 'Album' }]
 * anything else                     -> [{ label: sectionOf(url).name }]   (no "Settings >" crumb)
 */
export function crumbsFor(
	routeId: string | null,
	url: PageUrl,
	data: { album?: { name: string } }
): Crumb[] {
	const photoVideo = { label: 'Photo & video', href: PHOTO_VIDEO_HREF };
	if (routeId === '/(app)/photo-video') return [{ label: 'Photo & video' }];
	if (routeId === '/(app)/photo-video/albums') return [photoVideo, { label: 'Album' }];
	if (routeId === '/(app)/photo-video/albums/[id]')
		return [
			photoVideo,
			{ label: 'Album', href: `${PHOTO_VIDEO_HREF}/albums` },
			{ label: data.album?.name ?? 'Album' }
		];
	return [{ label: sectionOf(url).name }];
}
