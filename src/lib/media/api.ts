/** Deletes one item for good: its record, its place in every album, and its stored files. */
export async function deleteMedia(id: string): Promise<void> {
	const res = await fetch(`/api/media/${encodeURIComponent(id)}`, { method: 'DELETE' });
	if (!res.ok) {
		const error = await res.json().catch(() => null);
		throw new Error(
			typeof error?.message === 'string' ? error.message : `Request failed (${res.status})`
		);
	}
}
