import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	// The backend has its own test run in backend/.
	test: { include: ["src/**/*.test.{ts,tsx}"] },
});
