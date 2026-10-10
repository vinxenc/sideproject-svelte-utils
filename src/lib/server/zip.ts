import { configure, ZipWriterStream } from '@zip.js/zip.js';

// Node has no workers to hand the work to.
configure({ useWebWorkers: false });

export type ZipEntry = {
	name: string;
	modified: Date;
	/** The file's bytes, or `null` when it is missing (the entry is then left out). */
	open: () => Promise<ReadableStream<Uint8Array> | null>;
};

/**
 * A ZIP of the entries, built as it is read: one file is in flight at a time and the consumer's pace
 * is the producer's, so a big album never sits in memory. Entries are stored, not deflated (photos and
 * videos are compressed already), and ZIP64 lets the archive pass 4 GB. A failure while reading a file
 * errors the stream, so the download fails instead of ending as a quietly truncated archive.
 */
export function zipStream(entries: ZipEntry[]): ReadableStream<Uint8Array> {
	const zip = new ZipWriterStream({ level: 0, zip64: true });
	const reader = zip.readable.getReader();
	let failure: unknown;

	void (async () => {
		for (const entry of entries) {
			const body = await entry.open();
			if (!body) continue;
			await zip.zipWriter.add(entry.name, body, { lastModDate: entry.modified });
		}
		await zip.close();
	})().catch((e) => {
		failure = e ?? new Error('Could not build the archive');
		void reader.cancel(failure);
	});

	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			const { done, value } = await reader.read();
			if (failure !== undefined) controller.error(failure);
			else if (done) controller.close();
			else controller.enqueue(value);
		},
		cancel: (reason) => reader.cancel(reason)
	});
}

/** A file name that is safe inside an archive and in a header: no separators or control characters. */
export function safeFileName(name: string, fallback = 'file') {
	const cleaned = Array.from(name, (ch) =>
		ch.charCodeAt(0) < 32 || ch === '/' || ch === '\\' ? '_' : ch
	)
		.join('')
		.trim();
	return cleaned === '' || cleaned === '.' || cleaned === '..' ? fallback : cleaned;
}

/**
 * Names with repeats numbered ("a.jpg", "a (2).jpg"), so two uploads of one name don't collide. A
 * number is taken like any other name, and names are compared lower-cased because macOS and Windows
 * extract "A.jpg" and "a.jpg" to the same file.
 */
export function uniqueNames(names: string[]) {
	const used = new Set<string>();
	return names.map((name) => {
		const dot = name.lastIndexOf('.');
		const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
		let candidate = name;
		for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${stem} (${n})${ext}`;
		used.add(candidate.toLowerCase());
		return candidate;
	});
}

/** `attachment` with an ASCII fallback name and the real one as RFC 5987 UTF-8. */
export function attachment(filename: string) {
	const ascii = filename.replace(/[^\x20-\x7e]|["%\\]/g, '_');
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
