import type { CSSProperties } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { Node } from "../model/types";
import { useActiveTheme, useScreen, useStore } from "../model/store";
import { registry, effectiveStyle, isFreeFrame } from "../registry";
import { resolveStyle, themeVars } from "../theme/tokens";

function CanvasNode({ node, parentFree }: { node: Node; parentFree: boolean }) {
	const def = registry[node.type];
	const selected = useStore((s) => s.selectedId === node.id);
	const hovered = useStore((s) => s.hoverId === node.id);
	const select = useStore((s) => s.select);
	const hover = useStore((s) => s.hover);
	const { setNodeRef, isOver } = useDroppable({
		id: `canvas:${node.id}`,
		data: { nodeId: node.id },
		disabled: !def?.container,
	});
	if (!def) return null;

	const style = resolveStyle(effectiveStyle(def, node, parentFree)) as CSSProperties;
	const outline = selected
		? "2px solid #3b82f6"
		: isOver
			? "2px dashed #22c55e"
			: hovered
				? "1px solid #93c5fd"
				: undefined;
	const editor = {
		ref: setNodeRef,
		"data-node-id": node.id,
		onClick: (e: React.MouseEvent) => {
			e.stopPropagation();
			select(node.id);
		},
		onMouseOver: (e: React.MouseEvent) => {
			e.stopPropagation();
			hover(node.id);
		},
	};
	const children = node.children.map((c) => (
		<CanvasNode key={c.id} node={c} parentFree={isFreeFrame(node)} />
	));
	if (def.container && !node.children.length) {
		children.push(
			<div key="__empty" className="empty-drop">
				Drop components here
			</div>,
		);
	}
	return def.render({
		props: node.props,
		style: { ...style, outline, outlineOffset: outline ? -1 : undefined },
		children,
		editor,
	});
}

export function Canvas() {
	const screen = useScreen();
	const theme = useActiveTheme();
	const select = useStore((s) => s.select);
	const hover = useStore((s) => s.hover);
	return (
		<div className="canvas-scroll" onClick={() => select(null)}>
			<div
				className="device"
				style={themeVars(theme) as CSSProperties}
				onMouseLeave={() => hover(null)}
			>
				<CanvasNode node={screen.root} parentFree={false} />
			</div>
		</div>
	);
}
