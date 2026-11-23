import type { Doc } from "../model/types";
import { getIdToken } from "./auth";
import { API_URL, cloudMode } from "./config";

export type DesignSummary = { id: string; name: string; createdAt: string; updatedAt: string };
export type Design = DesignSummary & { doc: Doc };

export class ApiError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message);
	}
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	const headers: Record<string, string> = {};
	if (body !== undefined) headers["Content-Type"] = "application/json";
	if (cloudMode === "aws") {
		const token = await getIdToken();
		if (!token) throw new ApiError(401, "Please sign in again");
		headers.Authorization = `Bearer ${token}`;
	}
	const res = await fetch(`${API_URL}${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	if (res.status === 204) return undefined as T;
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		const err = data.error;
		const msg =
			typeof err === "string"
				? err
				: (err?.formErrors?.[0] ?? Object.values(err?.fieldErrors ?? {}).flat()[0] ?? res.statusText);
		throw new ApiError(res.status, res.status === 413 ? "Design is too large to save" : String(msg));
	}
	return data as T;
}

export const api = {
	listDesigns: () => request<DesignSummary[]>("GET", "/designs"),
	getDesign: (id: string) => request<Design>("GET", `/designs/${id}`),
	createDesign: (name: string, doc: Doc) => request<Design>("POST", "/designs", { name, doc }),
	updateDesign: (id: string, name: string, doc: Doc) =>
		request<Design>("PUT", `/designs/${id}`, { name, doc }),
	deleteDesign: (id: string) => request<void>("DELETE", `/designs/${id}`),

	/** Uploads an image to S3 via a pre-signed POST and returns its public URL. */
	async uploadImage(file: File): Promise<string> {
		const ticket = await request<{ uploadUrl: string; fields: Record<string, string>; url: string }>(
			"POST",
			"/uploads",
			{ contentType: file.type, size: file.size },
		);
		const form = new FormData();
		for (const [k, v] of Object.entries(ticket.fields)) form.append(k, v);
		form.append("file", file); // must come last
		const res = await fetch(ticket.uploadUrl, { method: "POST", body: form });
		if (!res.ok) throw new ApiError(res.status, "Upload failed");
		return ticket.url;
	},
};
