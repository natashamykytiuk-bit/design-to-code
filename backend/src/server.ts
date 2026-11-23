// Local dev server: plain Express on a port, with an in-memory store.
import { createApp } from "./app.js";
import { memoryRepo } from "./repo.js";

const port = Number(process.env.PORT ?? 3000);
createApp(memoryRepo(), "dev").listen(port, () => {
	console.log(`API listening on http://localhost:${port}`);
});
