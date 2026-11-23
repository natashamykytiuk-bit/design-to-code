import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { DesignRepo } from "./repo.js";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, type Uploader } from "./uploads.js";

const uploadSchema = z.object({
	contentType: z.enum(Object.keys(IMAGE_TYPES) as [string, ...string[]]),
	/** Checked here for a friendly error; S3 enforces it regardless. */
	size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

/** Same minimal shape the frontend's parseDoc() accepts. */
const docSchema = z
	.object({
		screens: z
			.array(
				z.object({ root: z.object({ children: z.array(z.unknown()) }).passthrough() }).passthrough(),
			)
			.min(1),
		themes: z.array(z.unknown()),
		activeThemeId: z.string(),
	})
	.passthrough()
	// Images must be uploaded (POST /uploads) and referenced by URL, not pasted
	// in as data: URLs, which would bloat the design past DynamoDB's item limit.
	.refine((doc) => !/"\s*data:/i.test(JSON.stringify(doc)), {
		message: "Embedded data: URLs are not allowed; upload the image instead",
	});
const bodySchema = z.object({ name: z.string().trim().min(1).max(200), doc: docSchema });
const idSchema = z.string().uuid();

/**
 * "apigateway": API Gateway has already verified the Cognito token; read the user from its claims.
 * "dev": local only; an optional x-dev-user header stands in for sign-in.
 */
export type AuthMode = "apigateway" | "dev";

function userId(req: Request, mode: AuthMode): string | null {
	if (mode === "dev") return req.header("x-dev-user") ?? "dev-user";
	// Attached to the request by @codegenie/serverless-express.
	const event = (req as unknown as { apiGateway?: { event?: any } }).apiGateway?.event;
	const sub = event?.requestContext?.authorizer?.jwt?.claims?.sub;
	return typeof sub === "string" ? sub : null;
}

const wrap =
	(fn: (req: Request, res: Response) => Promise<unknown>) =>
	(req: Request, res: Response, next: NextFunction) =>
		fn(req, res).catch(next);

export function createApp(repo: DesignRepo, authMode: AuthMode, uploader: Uploader | null = null) {
	const app = express();
	// DynamoDB items max out at 400 KB; stay safely under it.
	app.use(express.json({ limit: "350kb" }));

	app.get("/health", (_req, res) => {
		res.json({ ok: true });
	});

	const requireUser = (req: Request, res: Response, next: NextFunction) => {
		const uid = userId(req, authMode);
		if (!uid) {
			res.status(401).json({ error: "unauthorized" });
			return;
		}
		res.locals.uid = uid;
		next();
	};

	app.post(
		"/uploads",
		requireUser,
		wrap(async (req, res) => {
			if (!uploader) return res.status(501).json({ error: "uploads are not configured" });
			const body = uploadSchema.safeParse(req.body);
			if (!body.success) return res.status(400).json({ error: body.error.flatten() });
			res.status(201).json(await uploader.createTicket(res.locals.uid, body.data.contentType));
		}),
	);

	const designs = express.Router();
	designs.use(requireUser);

	// Unknown or malformed ids look the same as someone else's design: 404.
	designs.param("id", (req, res, next, id) => {
		if (!idSchema.safeParse(id).success) {
			res.status(404).json({ error: "not found" });
			return;
		}
		next();
	});

	designs.get(
		"/",
		wrap(async (_req, res) => res.json(await repo.list(res.locals.uid))),
	);

	designs.post(
		"/",
		wrap(async (req, res) => {
			const body = bodySchema.safeParse(req.body);
			if (!body.success) return res.status(400).json({ error: body.error.flatten() });
			res.status(201).json(await repo.create(res.locals.uid, body.data.name, body.data.doc));
		}),
	);

	designs.get(
		"/:id",
		wrap(async (req, res) => {
			const d = await repo.get(res.locals.uid, req.params.id);
			return d ? res.json(d) : res.status(404).json({ error: "not found" });
		}),
	);

	designs.put(
		"/:id",
		wrap(async (req, res) => {
			const body = bodySchema.safeParse(req.body);
			if (!body.success) return res.status(400).json({ error: body.error.flatten() });
			const d = await repo.update(res.locals.uid, req.params.id, body.data.name, body.data.doc);
			return d ? res.json(d) : res.status(404).json({ error: "not found" });
		}),
	);

	designs.delete(
		"/:id",
		wrap(async (req, res) => {
			const ok = await repo.remove(res.locals.uid, req.params.id);
			return ok ? res.status(204).end() : res.status(404).json({ error: "not found" });
		}),
	);

	app.use("/designs", designs);

	app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
		console.error(err);
		res.status(500).json({ error: "internal error" });
	});

	return app;
}
