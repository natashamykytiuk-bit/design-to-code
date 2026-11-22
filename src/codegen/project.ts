import type { Doc } from "../model/types";
import { componentName, type GeneratedFile } from "./generate";

/**
 * Pure: wraps the generated screens in a runnable Vite + React + TS project.
 * Takes the already-generated (and formatted) screen files so formatting stays out of here.
 */
export function projectFiles(
	doc: Doc,
	generated: GeneratedFile[],
): { path: string; content: string }[] {
	const first = componentName(doc.screens[0].name);
	const pkg = {
		name: "generated-app",
		private: true,
		version: "0.0.0",
		type: "module",
		scripts: { dev: "vite", build: "tsc -b && vite build" },
		dependencies: { react: "^18.3.1", "react-dom": "^18.3.1" },
		devDependencies: {
			"@types/react": "^18.3.11",
			"@types/react-dom": "^18.3.1",
			"@vitejs/plugin-react": "^4.3.2",
			typescript: "~5.6.3",
			vite: "^5.4.10",
		},
	};
	const tsconfig = {
		compilerOptions: {
			target: "ES2020",
			lib: ["ES2020", "DOM"],
			module: "ESNext",
			moduleResolution: "bundler",
			jsx: "react-jsx",
			strict: true,
			noEmit: true,
			skipLibCheck: true,
		},
		include: ["src"],
	};
	const json = (v: unknown) => JSON.stringify(v, null, "\t") + "\n";
	return [
		{ path: "package.json", content: json(pkg) },
		{ path: "tsconfig.json", content: json(tsconfig) },
		{
			path: "vite.config.ts",
			content: `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({ plugins: [react()] });\n`,
		},
		{
			path: "index.html",
			content: `<!doctype html>\n<html lang="en">\n\t<head>\n\t\t<meta charset="UTF-8" />\n\t\t<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n\t\t<title>${first}</title>\n\t\t<style>html, body, #root { margin: 0; height: 100%; }</style>\n\t</head>\n\t<body>\n\t\t<div id="root"></div>\n\t\t<script type="module" src="/src/main.tsx"></script>\n\t</body>\n</html>\n`,
		},
		{
			path: "src/main.tsx",
			content: `import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport ${first} from "./${first}";\n\ncreateRoot(document.getElementById("root")!).render(\n\t<StrictMode>\n\t\t<${first} />\n\t</StrictMode>,\n);\n`,
		},
		{ path: "design.json", content: json(doc) },
		...generated.map((f) => ({ path: `src/${f.path}`, content: f.content })),
	];
}
