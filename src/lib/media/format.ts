/** 75 -> "1:15", 3725 -> "1:02:05" */
export function formatDuration(seconds: number) {
	const total = Math.max(0, Math.round(seconds));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = String(total % 60).padStart(2, '0');
	return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** 1536 -> "1.5 KB", 52428800 -> "50 MB" */
export function formatBytes(bytes: number) {
	const unit = Math.min(3, Math.floor(Math.log2(Math.max(bytes, 1)) / 10));
	const value = bytes / 1024 ** unit;
	return `${unit > 0 && value < 10 ? value.toFixed(1) : Math.round(value)} ${['B', 'KB', 'MB', 'GB'][unit]}`;
}
