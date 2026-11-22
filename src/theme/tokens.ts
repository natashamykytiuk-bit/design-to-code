import type { StyleValue, Theme, TokenGroup } from "../model/types";
import { TOKEN_GROUPS } from "../model/types";

const shared = {
	space: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "40px" },
	radius: { none: "0px", sm: "4px", md: "8px", lg: "16px", full: "9999px" },
	font: { sm: "14px", md: "16px", lg: "20px", xl: "32px" },
};

export const starterThemes: Theme[] = [
	{
		id: "light",
		name: "Light",
		tokens: {
			color: {
				bg: "#ffffff",
				surface: "#f3f4f6",
				text: "#111827",
				muted: "#6b7280",
				primary: "#4f46e5",
				onPrimary: "#ffffff",
				border: "#d1d5db",
			},
			...shared,
		},
	},
	{
		id: "dark",
		name: "Dark",
		tokens: {
			color: {
				bg: "#0f172a",
				surface: "#1e293b",
				text: "#f1f5f9",
				muted: "#94a3b8",
				primary: "#818cf8",
				onPrimary: "#0f172a",
				border: "#334155",
			},
			...shared,
		},
	},
];

/** "$space.md" -> { group: "space", name: "md" } */
export function parseTokenRef(value: StyleValue): { group: TokenGroup; name: string } | null {
	if (typeof value !== "string" || !value.startsWith("$")) return null;
	const [group, name] = value.slice(1).split(".");
	if (!name || !TOKEN_GROUPS.includes(group as TokenGroup)) return null;
	return { group: group as TokenGroup, name };
}

export const cssVarName = (group: TokenGroup, name: string) => `--${group}-${name}`;

/** Token refs become CSS variables, so canvas and generated code share one mechanism. */
export function resolveValue(value: StyleValue): StyleValue {
	const ref = parseTokenRef(value);
	return ref ? `var(${cssVarName(ref.group, ref.name)})` : value;
}

export function resolveStyle(style: Record<string, StyleValue>): Record<string, StyleValue> {
	const out: Record<string, StyleValue> = {};
	for (const [k, v] of Object.entries(style)) {
		if (v === "" || v === undefined) continue;
		out[k] = resolveValue(v);
	}
	return out;
}

export function themeVars(theme: Theme): Record<string, string> {
	const vars: Record<string, string> = {};
	for (const group of TOKEN_GROUPS) {
		for (const [name, v] of Object.entries(theme.tokens[group])) vars[cssVarName(group, name)] = v;
	}
	return vars;
}
