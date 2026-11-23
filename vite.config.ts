import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	server: {
		// Local dev: VITE_API_URL=/api is forwarded to the API on :3000, so no CORS setup is needed.
		proxy: {
			"/api": { target: "http://localhost:3000", rewrite: (p) => p.replace(/^\/api/, "") },
		},
	},
	// The backend has its own test run in backend/.
	test: { include: ["src/**/*.test.{ts,tsx}"] },
});
