import { AwsClient } from 'aws4fetch';
import { env } from '#settings/env.js';

// Object storage for media: any S3-compatible service (RustFS locally, R2/S3 in production).
// The bucket stays private; browsers only ever get short-lived presigned URLs.
let client: AwsClient | undefined;
// Created on first use, so importing this module (e.g. during `vite build`) reads no env.
const s3 = () =>
	(client ??= new AwsClient({
		accessKeyId: env.S3_ACCESS_KEY_ID,
		secretAccessKey: env.S3_SECRET_ACCESS_KEY,
		service: 's3',
		region: env.S3_REGION,
		retries: 2
	}));

// Path-style (`/bucket/key`) works on RustFS, R2 and S3 alike.
function objectUrl(key: string) {
	const path = key.split('/').map(encodeURIComponent).join('/');
	return new URL(`/${env.S3_BUCKET}/${path}`, env.S3_ENDPOINT);
}

async function presign(
	method: 'GET' | 'PUT',
	key: string,
	expiresIn: number,
	headers?: HeadersInit
) {
	const url = objectUrl(key);
	url.searchParams.set('X-Amz-Expires', String(expiresIn));
	// allHeaders: aws4fetch skips content-type by default; signing it pins the upload's type.
	const signed = await s3().sign(url, {
		method,
		headers,
		aws: { signQuery: true, allHeaders: true }
	});
	return signed.url;
}

/**
 * URL the browser can PUT one object to. The Content-Type is signed, so the upload must send
 * exactly `contentType`; S3 can't bind the size to a presigned PUT, so check it with `head` afterwards.
 */
export function presignPut(key: string, contentType: string, expiresIn = 15 * 60) {
	return presign('PUT', key, expiresIn, { 'content-type': contentType });
}

/** URL the browser can GET one object from. */
export function presignGet(key: string, expiresIn = 60 * 60) {
	return presign('GET', key, expiresIn);
}

/** Size and type of an object, or `null` if it doesn't exist. */
export async function head(key: string) {
	const res = await s3().fetch(objectUrl(key), { method: 'HEAD' });
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`S3 HEAD ${key} failed: ${res.status}`);
	return {
		size: Number(res.headers.get('content-length')),
		contentType: res.headers.get('content-type')
	};
}

/** Deletes objects; keys that don't exist are ignored. */
export async function remove(...keys: string[]) {
	await Promise.all(
		keys.map(async (key) => {
			const res = await s3().fetch(objectUrl(key), { method: 'DELETE' });
			if (!res.ok && res.status !== 404) throw new Error(`S3 DELETE ${key} failed: ${res.status}`);
		})
	);
}
