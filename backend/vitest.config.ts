import { defineConfig } from "vitest/config";

// Without its own config, Vitest walks up and loads the frontend's
// vite.config.ts, which needs packages the backend doesn't install.
export default defineConfig({
	test: { include: ["src/**/*.test.ts"] },
});
