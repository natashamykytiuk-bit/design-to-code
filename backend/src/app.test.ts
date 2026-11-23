import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { memoryRepo } from "./repo.js";
import type { Uploader } from "./uploads.js";

const doc = { screens: [{ id: "s1", root: { children: [] } }], themes: [], activeThemeId: "t1" };
const devApp = () => createApp(memoryRepo(), "dev");

describe("designs API", () => {
	it("creates, reads, lists, updates and deletes a design", async () => {
		const app = devApp();
		const created = await request(app).post("/designs").send({ name: "Home", doc }).expect(201);
		const id = created.body.id;

		expect((await request(app).get(`/designs/${id}`).expect(200)).body.doc).toEqual(doc);

		const list = await request(app).get("/designs").expect(200);
		expect(list.body).toHaveLength(1);
		expect(list.body[0]).not.toHaveProperty("doc");

		await request(app).put(`/designs/${id}`).send({ name: "Renamed", doc }).expect(200);
		expect((await request(app).get(`/designs/${id}`)).body.name).toBe("Renamed");

		await request(app).delete(`/designs/${id}`).expect(204);
		await request(app).get(`/designs/${id}`).expect(404);
	});

	it("keeps each user's designs private", async () => {
		const app = devApp();
		const { body } = await request(app)
			.post("/designs")
			.set("x-dev-user", "alice")
			.send({ name: "Mine", doc });

		await request(app).get(`/designs/${body.id}`).set("x-dev-user", "bob").expect(404);
		await request(app).delete(`/designs/${body.id}`).set("x-dev-user", "bob").expect(404);
		expect((await request(app).get("/designs").set("x-dev-user", "bob")).body).toEqual([]);
	});

	it("rejects invalid bodies and ids", async () => {
		const app = devApp();
		await request(app).post("/designs").send({ name: "", doc }).expect(400);
		await request(app).post("/designs").send({ name: "x", doc: { screens: [] } }).expect(400);
		await request(app).get("/designs/not-a-uuid").expect(404);
	});

	it("returns 401 when API Gateway passed no verified user", async () => {
		await request(createApp(memoryRepo(), "apigateway")).get("/designs").expect(401);
	});

	it("rejects designs with embedded data: images", async () => {
		const withImage = {
			...doc,
			screens: [
				{
					id: "s1",
					root: { children: [{ type: "Image", props: { src: "data:image/png;base64,AAAA" } }] },
				},
			],
		};
		await request(devApp()).post("/designs").send({ name: "x", doc: withImage }).expect(400);
	});

	it("issues upload tickets for images only, scoped to the user", async () => {
		const seen: string[] = [];
		const uploader: Uploader = {
			async createTicket(ownerId, contentType) {
				seen.push(`${ownerId}:${contentType}`);
				return { uploadUrl: "https://s3.example", fields: {}, url: "https://cdn.example/a.png" };
			},
		};
		const app = createApp(memoryRepo(), "dev", uploader);

		const ok = await request(app)
			.post("/uploads")
			.set("x-dev-user", "alice")
			.send({ contentType: "image/png", size: 1000 })
			.expect(201);
		expect(ok.body.url).toBe("https://cdn.example/a.png");
		expect(seen).toEqual(["alice:image/png"]);

		await request(app).post("/uploads").send({ contentType: "text/html", size: 10 }).expect(400);
		await request(app)
			.post("/uploads")
			.send({ contentType: "image/png", size: 50 * 1024 * 1024 })
			.expect(400);
	});

	it("reports uploads as unavailable when no bucket is configured", async () => {
		await request(devApp()).post("/uploads").send({ contentType: "image/png", size: 1 }).expect(501);
	});

	it("serves a health check without auth", async () => {
		await request(createApp(memoryRepo(), "apigateway")).get("/health").expect(200);
	});
});
