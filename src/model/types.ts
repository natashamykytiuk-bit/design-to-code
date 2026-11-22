export type StyleValue = string | number;

export type Node = {
	id: string;
	type: string;
	props: Record<string, unknown>;
	/** Values may reference tokens, e.g. "$space.md" or "$color.primary". */
	style: Record<string, StyleValue>;
	children: Node[];
};

export type TokenGroup = "color" | "space" | "radius" | "font";
export const TOKEN_GROUPS: TokenGroup[] = ["color", "space", "radius", "font"];

export type Theme = {
	id: string;
	name: string;
	tokens: Record<TokenGroup, Record<string, string>>;
};

export type Screen = { id: string; name: string; root: Node };

export type Doc = {
	screens: Screen[];
	themes: Theme[];
	activeThemeId: string;
};
