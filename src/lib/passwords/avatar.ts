// The letter tile's colour and letter, derived from the entry's name so each name keeps one colour.

/**
 * Literal classes so Tailwind's scanner emits them. White text on these is readable in light and dark mode.
 * This is a deliberate exception to the theme-token rule (decided in the plan).
 */
export const AVATAR_PALETTE = [
	'bg-red-600',
	'bg-orange-600',
	'bg-amber-600',
	'bg-lime-600',
	'bg-emerald-600',
	'bg-teal-600',
	'bg-sky-600',
	'bg-blue-600',
	'bg-indigo-600',
	'bg-violet-600',
	'bg-fuchsia-600',
	'bg-rose-600'
] as const;

/** 32-bit FNV-1a over UTF-16 code units. */
function fnv1a(text: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash;
}

/** The letter and colour for a name. Case and surrounding spaces don't change the colour. */
export function avatarFor(name: string): { letter: string; className: string } {
	const trimmed = name.trim();
	const key = trimmed.toLowerCase();
	const className = AVATAR_PALETTE[fnv1a(key) % AVATAR_PALETTE.length];
	// First code point, so an emoji or a surrogate pair stays whole. Uppercasing can grow the text ('ß' -> 'SS'), so take the first code point again.
	const first = [...trimmed][0];
	const letter = first ? [...first.toUpperCase()][0] : '?';
	return { letter, className };
}
