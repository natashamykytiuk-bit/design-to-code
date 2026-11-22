import { useActiveTheme, useScreen, useStore } from "../model/store";
import { findNode } from "../model/tree";
import { registry, type Field } from "../registry";
import { parseTokenRef } from "../theme/tokens";

export function Properties() {
	const screen = useScreen();
	const theme = useActiveTheme();
	const selectedId = useStore((s) => s.selectedId);
	const updateProps = useStore((s) => s.updateProps);
	const updateStyle = useStore((s) => s.updateStyle);
	const removeNode = useStore((s) => s.removeNode);
	const node = selectedId ? findNode(screen.root, selectedId) : null;

	if (!node) {
		return (
			<aside className="panel right">
				<h3>Properties</h3>
				<p className="hint">Select a component on the canvas or in the layers tree.</p>
			</aside>
		);
	}
	const def = registry[node.type];

	const renderField = (f: Field) => {
		const inStyle = f.in === "style";
		const raw = inStyle ? node.style[f.key] : node.props[f.key];
		const set = (v: string) => (inStyle ? updateStyle(node.id, { [f.key]: v }) : updateProps(node.id, { [f.key]: v }));

		if (f.kind === "text") {
			return <input value={String(raw ?? "")} onChange={(e) => set(e.target.value)} />;
		}
		if (f.kind === "select") {
			return (
				<select value={String(raw ?? "")} onChange={(e) => set(e.target.value)}>
					{f.options!.map((o) => (
						<option key={o}>{o}</option>
					))}
				</select>
			);
		}
		// Token picker. Style fields store "$group.name"; layout props store the bare token name.
		const group = f.kind.token;
		const current = inStyle ? (parseTokenRef((raw ?? "") as string)?.name ?? "") : String(raw ?? "");
		const names = Object.keys(theme.tokens[group]);
		return (
			<div className="token-picker">
				{group === "color" && current && (
					<span className="swatch" style={{ background: theme.tokens.color[current] }} />
				)}
				<select
					value={current}
					onChange={(e) => set(e.target.value ? (inStyle ? `$${group}.${e.target.value}` : e.target.value) : "")}
				>
					<option value="">{inStyle ? "— none —" : "0"}</option>
					{names.map((n) => (
						<option key={n} value={n}>
							{group}.{n} ({theme.tokens[group][n]})
						</option>
					))}
				</select>
			</div>
		);
	};

	return (
		<aside className="panel right">
			<h3>
				{def.label} <span className="muted">#{node.id}</span>
			</h3>
			{def.fields.map((f) => (
				<label key={f.key} className="field">
					<span>{f.label}</span>
					{renderField(f)}
				</label>
			))}
			{node.id !== "root" && (
				<button className="danger" onClick={() => removeNode(node.id)}>
					Delete component
				</button>
			)}
		</aside>
	);
}
