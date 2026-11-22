import * as prettier from "prettier/standalone";
import type { Plugin } from "prettier";
import * as tsPlugin from "prettier/plugins/typescript";
import * as estreePlugin from "prettier/plugins/estree";
import * as postcssPlugin from "prettier/plugins/postcss";
import type { GeneratedFile } from "./generate";

export async function formatFile(file: GeneratedFile): Promise<GeneratedFile> {
	try {
		const content = await prettier.format(file.content, {
			parser: file.language === "tsx" ? "typescript" : "css",
			plugins: [tsPlugin, estreePlugin as Plugin, postcssPlugin],
			useTabs: true,
			printWidth: 100,
		});
		return { ...file, content };
	} catch {
		return file;
	}
}

export const formatFiles = (files: GeneratedFile[]) => Promise.all(files.map(formatFile));
