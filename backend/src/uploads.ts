import { randomUUID } from "node:crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
	"image/gif": "gif",
};

/** What the browser needs to upload one file straight to S3. */
export type UploadTicket = {
	/** POST a multipart form here: every entry of `fields`, then the file as "file". */
	uploadUrl: string;
	fields: Record<string, string>;
	/** Where the image is served once uploaded; this is what the design stores. */
	url: string;
};

export interface Uploader {
	createTicket(ownerId: string, contentType: string): Promise<UploadTicket>;
}

/**
 * Pre-signed POST: the API never touches the file. S3 itself enforces the size
 * limit, content type and key, and the ticket expires after 5 minutes.
 */
export function s3Uploader(bucket: string, publicBaseUrl: string): Uploader {
	const s3 = new S3Client({});
	return {
		async createTicket(ownerId, contentType) {
			const key = `uploads/${ownerId}/${randomUUID()}.${IMAGE_TYPES[contentType]}`;
			const { url, fields } = await createPresignedPost(s3, {
				Bucket: bucket,
				Key: key,
				Expires: 300,
				Fields: { "Content-Type": contentType },
				Conditions: [
					["content-length-range", 1, MAX_UPLOAD_BYTES],
					["eq", "$Content-Type", contentType],
				],
			});
			return { uploadUrl: url, fields, url: `${publicBaseUrl.replace(/\/$/, "")}/${key}` };
		},
	};
}

/** Uploads are only configured on AWS; returns null when running locally without a bucket. */
export function uploaderFromEnv(): Uploader | null {
	const bucket = process.env.UPLOAD_BUCKET;
	const base = process.env.ASSET_BASE_URL;
	return bucket && base ? s3Uploader(bucket, base) : null;
}
