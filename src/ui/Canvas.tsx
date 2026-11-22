import { useEffect, useRef, type CSSProperties } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { Node } from "../model/types";
import { useActiveTheme, useScreen, useStore } from "../model/store";
import { registry, effectiveStyle, isFreeFrame } from "../registry";
import { resolveStyle, themeVars } from "../theme/tokens";

const MIN_Z = 0.25;
const MAX_Z = 3;
const clamp = (z: number) => Math.min(MAX_Z, Math.max(MIN_Z, z));

/** Renders a node exactly as it will look in the output. */
function CanvasNode({ node, parentFree }: { node: Node; parentFree: boolean }) {
	const def = registry[node.type];
	const select = useStore((s) => s.select);
	const hover = useStore((s) => s.hover);
	const selected = useStore((s) => s.selectedId === node.id);
	const hovered = useStore((s) => s.hoverId === node.id);
	const { setNodeRef, isOver } = useDroppable({
		id: `canvas:${node.id}`,
		data: { nodeId: node.id },
		disabled: !def?.container,
	});
	if (!def) return null;

	const free = isFreeFrame(node);
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
	const children = node.children.map((c) => <CanvasNode key={c.id} node={c} parentFree={free} />);
	if (def.container && !node.children.length) {
		children.push(
			<div key="__empty" className="empty-drop">
				{free ? "Free frame: drop components anywhere" : "Drop components here"}
			</div>,
		);
	}
	return def.render({
		props: node.props,
		style: {
			...(resolveStyle(effectiveStyle(def, node, parentFree)) as CSSProperties),
			outline,
			outlineOffset: outline ? -1 : undefined,
		},
		children,
		editor,
	});
}

export function Canvas() {
	const screen = useScreen();
	const theme = useActiveTheme();
	const select = useStore((s) => s.select);
	const hover = useStore((s) => s.hover);
	const view = useStore((s) => s.view);
	const setView = useStore((s) => s.setView);
	const viewportRef = useRef<HTMLDivElement>(null);
	const stageRef = useRef<HTMLDivElement>(null);
	const space = useRef(false);

	const fit = () => {
		const w = viewportRef.current?.clientWidth ?? 800;
		setView({ x: Math.round((w - 390) / 2), y: 32, z: 1 });
	};
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(fit, []);

	// Native listeners: wheel needs passive: false so preventDefault stops browser zoom.
	useEffect(() => {
		const vp = viewportRef.current!;
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const v = useStore.getState().view;
			if (e.ctrlKey || e.metaKey) {
				const r = vp.getBoundingClientRect();
				const cx = e.clientX - r.left;
				const cy = e.clientY - r.top;
				const z2 = clamp(v.z * Math.exp(-e.deltaY * 0.0015));
				setView({ x: cx - ((cx - v.x) * z2) / v.z, y: cy - ((cy - v.y) * z2) / v.z, z: z2 });
			} else {
				setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
			}
		};
		const onKey = (e: KeyboardEvent) => {
			if (
				e.code !== "Space" ||
				(e.target as HTMLElement).closest("input, textarea, select, button")
			)
				return;
			space.current = e.type === "keydown";
			vp.classList.toggle("panning", space.current);
			e.preventDefault();
		};
		vp.addEventListener("wheel", onWheel, { passive: false });
		window.addEventListener("keydown", onKey);
		window.addEventListener("keyup", onKey);
		return () => {
			vp.removeEventListener("wheel", onWheel);
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("keyup", onKey);
		};
	}, [setView]);

	// Pan with the middle mouse button, or space + drag.
	const onPointerDown = (e: React.PointerEvent) => {
		if (e.button !== 1 && !(e.button === 0 && space.current)) return;
		e.preventDefault();
		e.stopPropagation();
		const start = { x: e.clientX, y: e.clientY, v: useStore.getState().view };
		const onMove = (ev: PointerEvent) =>
			setView({
				...start.v,
				x: start.v.x + ev.clientX - start.x,
				y: start.v.y + ev.clientY - start.y,
			});
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	};

	const zoomBy = (f: number) => {
		const vp = viewportRef.current!;
		const cx = vp.clientWidth / 2;
		const cy = vp.clientHeight / 2;
		const z2 = clamp(view.z * f);
		setView({
			x: cx - ((cx - view.x) * z2) / view.z,
			y: cy - ((cy - view.y) * z2) / view.z,
			z: z2,
		});
	};

	return (
		<div
			ref={viewportRef}
			className="viewport"
			onPointerDownCapture={onPointerDown}
			onClick={(e) => e.target === e.currentTarget && select(null)}
		>
			<div
				ref={stageRef}
				className="stage"
				style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}
			>
				<div
					className="device"
					style={themeVars(theme) as CSSProperties}
					onMouseLeave={() => hover(null)}
				>
					<CanvasNode node={screen.root} parentFree={false} />
				</div>
			</div>
			<div className="zoom-controls">
				<button onClick={() => zoomBy(1 / 1.25)} title="Zoom out (Ctrl + wheel)">
					−
				</button>
				<button onClick={fit} title="Reset view">
					{Math.round(view.z * 100)}%
				</button>
				<button onClick={() => zoomBy(1.25)} title="Zoom in (Ctrl + wheel)">
					+
				</button>
			</div>
		</div>
	);
}
