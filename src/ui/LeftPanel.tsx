import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { Node } from "../model/types";
import { useScreen, useStore } from "../model/store";
import { paletteOrder, registry } from "../registry";

function PaletteItem({ type }: { type: string }) {
	const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
		id: `palette:${type}`,
		data: { kind: "palette", type },
	});
	const addNode = useStore((s) => s.addNode);
	const selectedId = useStore((s) => s.selectedId);
	const screen = useScreen();
	const onDoubleClick = () => {
		// Double-click adds into the selected Stack, or the root.
		const target = selectedId ? findContainer(screen.root, selectedId) : "root";
		addNode(type, target ?? "root");
	};
	return (
		<button
			ref={setNodeRef}
			className="palette-item"
			style={{ opacity: isDragging ? 0.4 : 1 }}
			onDoubleClick={onDoubleClick}
			title="Drag onto the canvas or a layer, or double-click to add"
			{...attributes}
			{...listeners}
		>
			{registry[type].label}
		</button>
	);
}

function findContainer(root: Node, id: string): string | null {
	const n = find(root, id);
	return n && registry[n.type].container ? n.id : null;
}
function find(n: Node, id: string): Node | null {
	if (n.id === id) return n;
	for (const c of n.children) {
		const hit = find(c, id);
		if (hit) return hit;
	}
	return null;
}

function nodeLabel(n: Node) {
	const t = n.props.text ?? n.props.label;
	return t ? `${n.type} · ${String(t).slice(0, 18)}` : n.type;
}

function LayerRow({ node, depth }: { node: Node; depth: number }) {
	const selected = useStore((s) => s.selectedId === node.id);
	const select = useStore((s) => s.select);
	const hover = useStore((s) => s.hover);
	const removeNode = useStore((s) => s.removeNode);
	const isRoot = node.id === "root";
	const drag = useDraggable({ id: `layer:${node.id}`, data: { kind: "layer", nodeId: node.id }, disabled: isRoot });
	const drop = useDroppable({ id: `layerdrop:${node.id}`, data: { nodeId: node.id, fromLayers: true } });
	return (
		<>
			<div
				ref={(el) => {
					drag.setNodeRef(el);
					drop.setNodeRef(el);
				}}
				className={`layer-row${selected ? " selected" : ""}${drop.isOver ? " over" : ""}`}
				style={{ paddingLeft: 8 + depth * 14, opacity: drag.isDragging ? 0.4 : 1 }}
				onClick={() => select(node.id)}
				onMouseEnter={() => hover(node.id)}
				onMouseLeave={() => hover(null)}
				{...drag.attributes}
				{...drag.listeners}
			>
				<span className="layer-name">{isRoot ? "Screen (root)" : nodeLabel(node)}</span>
				{!isRoot && (
					<button
						className="icon-btn"
						title="Delete"
						onPointerDown={(e) => e.stopPropagation()}
						onClick={(e) => {
							e.stopPropagation();
							removeNode(node.id);
						}}
					>
						×
					</button>
				)}
			</div>
			{node.children.map((c) => (
				<LayerRow key={c.id} node={c} depth={depth + 1} />
			))}
		</>
	);
}

export function LeftPanel() {
	const screen = useScreen();
	return (
		<aside className="panel left">
			<h3>Components</h3>
			<div className="palette">
				{paletteOrder.map((t) => (
					<PaletteItem key={t} type={t} />
				))}
			</div>
			<h3>Layers</h3>
			<p className="hint">Drag a layer onto the top half of a row to place it before; bottom half to drop inside a Stack.</p>
			<div className="layers">
				<LayerRow node={screen.root} depth={0} />
			</div>
		</aside>
	);
}
