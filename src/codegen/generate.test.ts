import { describe, expect, it } from "vitest";
import { generate } from "./generate";
import { formatFiles } from "./format";
import type { Doc } from "../model/types";
import { starterThemes } from "../theme/tokens";

const doc: Doc = {
	activeThemeId: "light",
	themes: starterThemes,
	screens: [
		{
			id: "s1",
			name: "login screen",
			root: {
				id: "root",
				type: "Stack",
				props: {
					direction: "column",
					gap: "md",
					padding: "lg",
					align: "stretch",
					justify: "flex-start",
				},
				style: { background: "$color.bg" },
				children: [
					{
						id: "t",
						type: "Text",
						props: { text: "Hello <you>", as: "h1" },
						style: { color: "$color.text" },
						children: [],
					},
					{
						id: "b",
						type: "Button",
						props: { label: "Go" },
						style: { borderRadius: "$radius.md" },
						children: [],
					},
				],
			},
		},
	],
};

describe("generate", () => {
	it("is pure and deterministic", () => {
		expect(generate(doc)).toEqual(generate(doc));
	});

	it("emits one tsx per screen plus theme.css", async () => {
		const files = await formatFiles(generate(doc));
		expect(files.map((f) => f.path)).toEqual(["LoginScreen.tsx", "theme.css"]);
		expect(files[0].content).toContain("var(--space-md)");
		expect(files[0].content).not.toMatch(/^ +\S/m); // tabs only
		expect(files).toMatchSnapshot();
	});
});
