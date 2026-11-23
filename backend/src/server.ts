// Local dev server: plain Express on a port.
// With TABLE_NAME set (docker compose) it uses DynamoDB Local; without it, an
// in-memory store, so the frontend can be worked on without Docker.
import { createApp } from "./app.js";
import { dynamoConfigFromEnv, dynamoRepo, ensureTable } from "./dynamoRepo.js";
import { memoryRepo, type DesignRepo } from "./repo.js";

let repo: DesignRepo;
if (process.env.TABLE_NAME) {
	const cfg = dynamoConfigFromEnv();
	await ensureTable(cfg);
	repo = dynamoRepo(cfg);
} else {
	console.warn("TABLE_NAME not set: using an in-memory store (data is lost on restart)");
	repo = memoryRepo();
}

const port = Number(process.env.PORT ?? 3000);
createApp(repo, "dev").listen(port, () => {
	console.log(`API listening on http://localhost:${port}`);
});
