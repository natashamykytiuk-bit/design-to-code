import type { CSSProperties, ReactNode } from "react";
import type { StyleValue, TokenGroup } from "../model/types";

export type FieldKind = "text" | "select" | { token: TokenGroup };

export type Field = {
	key: string;
	label: string;
	kind: FieldKind;
	/** Where the value lives on the node. Defaults to "props". */
	in?: "props" | "style";
	options?: string[];
};

/** What the code generator emits for a node: a tag, attributes, and optional text content. */
export type CodeTemplate = {
	tag: string;
	attrs: Record<string, string>;
	text?: string;
};

export type EditorAttrs = Record<string, unknown>;

export type ComponentDef = {
	type: string;
	label: string;
	container: boolean;
	defaultProps: Record<string, unknown>;
	defaultStyle: Record<string, StyleValue>;
	fields: Field[];
	/** Style derived from props (e.g. Stack layout). Merged under node.style. */
	layoutStyle?: (props: Record<string, unknown>) => Record<string, StyleValue>;
	render: (p: {
		props: Record<string, unknown>;
		style: CSSProperties;
		children: ReactNode;
		editor: EditorAttrs;
	}) => ReactNode;
	code: (props: Record<string, unknown>) => CodeTemplate;
};

const str = (v: unknown) => (v == null ? "" : String(v));

const spaceToken = (v: unknown) => (v ? `$space.${v}` : 0);

const colorFields: Field[] = [
	{ key: "background", label: "Background", kind: { token: "color" }, in: "style" },
	{ key: "color", label: "Text color", kind: { token: "color" }, in: "style" },
];

const Stack: ComponentDef = {
	type: "Stack",
	label: "Stack",
	container: true,
	defaultProps: {
		layout: "auto",
		direction: "column",
		gap: "md",
		align: "stretch",
		justify: "flex-start",
		padding: "md",
	},
	defaultStyle: {},
	fields: [
		{ key: "layout", label: "Layout", kind: "select", options: ["auto", "free"] },
		{ key: "direction", label: "Direction", kind: "select", options: ["column", "row"] },
		{ key: "gap", label: "Gap", kind: { token: "space" } },
		{ key: "padding", label: "Padding", kind: { token: "space" } },
		{
			key: "align",
			label: "Align",
			kind: "select",
			options: ["stretch", "flex-start", "center", "flex-end"],
		},
		{
			key: "justify",
			label: "Justify",
			kind: "select",
			options: ["flex-start", "center", "flex-end", "space-between"],
		},
		...colorFields,
		{ key: "borderRadius", label: "Radius", kind: { token: "radius" }, in: "style" },
	],
	layoutStyle: (p): Record<string, StyleValue> =>
		p.layout === "free"
			? // Escape hatch: children are absolutely positioned inside this frame.
				{ position: "relative", minHeight: 240, padding: spaceToken(p.padding) }
			: {
					display: "flex",
					flexDirection: str(p.direction) || "column",
					gap: spaceToken(p.gap),
					padding: spaceToken(p.padding),
					alignItems: str(p.align) || "stretch",
					justifyContent: str(p.justify) || "flex-start",
				},
	render: ({ style, children, editor }) => (
		<div {...editor} style={style}>
			{children}
		</div>
	),
	code: () => ({ tag: "div", attrs: {} }),
};

const Text: ComponentDef = {
	type: "Text",
	label: "Text",
	container: false,
	defaultProps: { text: "Some text", as: "p" },
	defaultStyle: { color: "$color.text", fontSize: "$font.md", margin: 0 },
	fields: [
		{ key: "text", label: "Text", kind: "text" },
		{ key: "as", label: "Element", kind: "select", options: ["p", "h1", "h2", "h3", "span"] },
		{ key: "fontSize", label: "Size", kind: { token: "font" }, in: "style" },
		{ key: "color", label: "Color", kind: { token: "color" }, in: "style" },
	],
	render: ({ props, style, editor }) => {
		const Tag = (str(props.as) || "p") as "p";
		return (
			<Tag {...editor} style={style}>
				{str(props.text)}
			</Tag>
		);
	},
	code: (p) => ({ tag: str(p.as) || "p", attrs: {}, text: str(p.text) }),
};

const Button: ComponentDef = {
	type: "Button",
	label: "Button",
	container: false,
	defaultProps: { label: "Button" },
	defaultStyle: {
		background: "$color.primary",
		color: "$color.onPrimary",
		padding: "$space.sm",
		borderRadius: "$radius.md",
		border: "none",
		fontSize: "$font.md",
		cursor: "pointer",
	},
	fields: [
		{ key: "label", label: "Label", kind: "text" },
		...colorFields,
		{ key: "borderRadius", label: "Radius", kind: { token: "radius" }, in: "style" },
		{ key: "padding", label: "Padding", kind: { token: "space" }, in: "style" },
	],
	render: ({ props, style, editor }) => (
		<button type="button" {...editor} style={style}>
			{str(props.label)}
		</button>
	),
	code: (p) => ({ tag: "button", attrs: { type: "button" }, text: str(p.label) }),
};

const Image: ComponentDef = {
	type: "Image",
	label: "Image",
	container: false,
	defaultProps: { src: "https://picsum.photos/seed/design/400/240", alt: "Placeholder" },
	defaultStyle: { width: "100%", borderRadius: "$radius.md", display: "block" },
	fields: [
		{ key: "src", label: "Source URL", kind: "text" },
		{ key: "alt", label: "Alt text", kind: "text" },
		{ key: "borderRadius", label: "Radius", kind: { token: "radius" }, in: "style" },
	],
	render: ({ props, style, editor }) => (
		<img {...editor} src={str(props.src)} alt={str(props.alt)} style={style} draggable={false} />
	),
	code: (p) => ({ tag: "img", attrs: { src: str(p.src), alt: str(p.alt) } }),
};

const Input: ComponentDef = {
	type: "Input",
	label: "Input",
	container: false,
	defaultProps: { placeholder: "Type here…", inputType: "text" },
	defaultStyle: {
		padding: "$space.sm",
		borderRadius: "$radius.sm",
		border: "1px solid var(--color-border)",
		background: "$color.bg",
		color: "$color.text",
		fontSize: "$font.md",
	},
	fields: [
		{ key: "placeholder", label: "Placeholder", kind: "text" },
		{
			key: "inputType",
			label: "Type",
			kind: "select",
			options: ["text", "email", "password", "number"],
		},
		...colorFields,
		{ key: "borderRadius", label: "Radius", kind: { token: "radius" }, in: "style" },
	],
	render: ({ props, style, editor }) => (
		<input
			{...editor}
			type={str(props.inputType) || "text"}
			placeholder={str(props.placeholder)}
			style={style}
			readOnly
		/>
	),
	code: (p) => ({
		tag: "input",
		attrs: { type: str(p.inputType) || "text", placeholder: str(p.placeholder) },
	}),
};

export const registry: Record<string, ComponentDef> = { Stack, Text, Button, Image, Input };
export const paletteOrder = ["Stack", "Text", "Button", "Image", "Input"];

export const isFreeFrame = (node: { type: string; props: Record<string, unknown> }) =>
	!!registry[node.type]?.container && node.props.layout === "free";

/**
 * Full token-referencing style for a node: layout derived from props, then explicit style.
 * left/top only apply when the parent is a free frame; there the node is absolutely positioned.
 */
export function effectiveStyle(
	def: ComponentDef,
	node: { props: Record<string, unknown>; style: Record<string, StyleValue> },
	parentFree = false,
): Record<string, StyleValue> {
	const { left, top, ...rest } = node.style;
	const base = { ...(def.layoutStyle?.(node.props) ?? {}), ...rest };
	if (!parentFree) return base;
	return { ...base, position: "absolute", left: left ?? 0, top: top ?? 0 };
}
