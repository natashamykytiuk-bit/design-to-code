import type { Doc, Node, Theme } from "../model/types";
import { TOKEN_GROUPS } from "../model/types";
import { registry, effectiveStyle, isFreeFrame } from "../registry";
import { cssVarName, resolveStyle } from "../theme/tokens";

export type GeneratedFile = { path: string; language: "tsx" | "css"; content: string };

export function componentName(screenName: string): string {
	const pascal = screenName
		.replace(/[^a-zA-Z0-9]+/g, " ")
		.trim()
		.split(/\s+/)
		.map((w) => w[0].toUpperCase() + w.slice(1))
		.join("");
	return /^[A-Z]/.test(pascal) ? pascal : `Screen${pascal}`;
}

function styleLiteral(style: Record<string, string | number>): string {
	const entries = Object.entries(style).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
	return entries.length ? `{{ ${entries.join(", ")} }}` : "";
}

function textChild(text: string): string {
	return /[{}<>]/.test(text) || text.trim() !== text ? `{${JSON.stringify(text)}}` : text;
}

function nodeToJsx(node: Node, depth: number, parentFree = false): string {
	const def = registry[node.type];
	const indent = "\t".repeat(depth);
	if (!def) return `${indent}{/* Unknown component: ${node.type} */}`;
	const tpl = def.code(node.props);
	const attrs = Object.entries(tpl.attrs).map(([k, v]) => `${k}=${JSON.stringify(v)}`);
	const style = styleLiteral(resolveStyle(effectiveStyle(def, node, parentFree)));
	if (style) attrs.push(`style=${style}`);
	const open = `${indent}<${tpl.tag}${attrs.length ? " " + attrs.join(" ") : ""}`;
	const inner: string[] = [];
	if (tpl.text) inner.push(`${indent}\t${textChild(tpl.text)}`);
	const free = isFreeFrame(node);
	for (const child of node.children) inner.push(nodeToJsx(child, depth + 1, free));
	if (!inner.length) return `${open} />`;
	return `${open}>\n${inner.join("\n")}\n${indent}</${tpl.tag}>`;
}

export function screenToTsx(name: string, root: Node): string {
	return [
		`import "./theme.css";`,
		``,
		`export default function ${componentName(name)}() {`,
		`\treturn (`,
		nodeToJsx(root, 2),
		`\t);`,
		`}`,
		``,
	].join("\n");
}

function themeBlock(selector: string, theme: Theme): string {
	const lines: string[] = [];
	for (const group of TOKEN_GROUPS) {
		for (const [name, value] of Object.entries(theme.tokens[group])) {
			lines.push(`\t${cssVarName(group, name)}: ${value};`);
		}
	}
	return `${selector} {\n${lines.join("\n")}\n}`;
}

/** Active theme on :root; every theme is also selectable via [data-theme="<id>"]. */
export function themeToCss(doc: Doc): string {
	const active = doc.themes.find((t) => t.id === doc.activeThemeId) ?? doc.themes[0];
	const blocks = [`/* Active theme: ${active.name} */`, themeBlock(":root", active)];
	for (const t of doc.themes) blocks.push(themeBlock(`[data-theme="${t.id}"]`, t));
	return blocks.join("\n\n") + "\n";
}

/** Pure: (doc) => files. No formatting, no I/O. */
export function generate(doc: Doc): GeneratedFile[] {
	const files: GeneratedFile[] = doc.screens.map((s) => ({
		path: `${componentName(s.name)}.tsx`,
		language: "tsx",
		content: screenToTsx(s.name, s.root),
	}));
	files.push({ path: "theme.css", language: "css", content: themeToCss(doc) });
	return files;
}
