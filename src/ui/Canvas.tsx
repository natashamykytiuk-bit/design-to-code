import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useDndMonitor, useDroppable } from "@dnd-kit/core";
import type { Node } from "../model/types";
import { useActiveTheme, useScreen, useStore } from "../model/store";
import { findNode, findParent } from "../model/tree";
import { registry, effectiveStyle, isFreeFrame } from "../registry";
import { resolveStyle, themeVars } from "../theme/tokens";

const MIN_Z = 0.25;
const MAX_Z = 3;
const clamp = (z: number) => Math.min(MAX_Z, Math.max(MIN_Z, z));

/** Renders a node exactly as it will look in the output. No editor chrome here: that lives in the overlay. */
function CanvasNode({ node, parentFree }: { node: Node; parentFree: boolean }) {
	const def = registry[node.type];
	const select = useStore((s) => s.select);
	const hover = useStore((s) => s.hover);
	const { setNodeRef } = useDroppable({
		id: `canvas:${node.id}`,
		data: { nodeId: node.id },
		disabled: !def?.container,
	});
	if (!def) return null;

	const free = isFreeFrame(node);
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
		style: resolveStyle(effectiveStyle(def, node, parentFree)) as CSSProperties,
		children,
		editor,
	});
}

type Box = { left: number; top: number; width: number; height: number };

/** Selection, hover and drop-target boxes plus move/resize handles, drawn above the content. */
function Overlay({ stageRef }: { stageRef: React.RefObject<HTMLDivElement> }) {
	const screen = useScreen();
	const selectedId = useStore((s) => s.selectedId);
	const hoverId = useStore((s) => s.hoverId);
	const z = useStore((s) => s.view.z);
	const updateStyle = useStore((s) => s.updateStyle);
	const endGesture = useStore((s) => s.endGesture);
	const [overId, setOverId] = useState<string | null>(null);
	const [boxes, setBoxes] = useState<Record<string, Box | null>>({});
	const [tick, setTick] = useState(0);

	useDndMonitor({
		onDragOver: (e) => {
			const id = e.over?.id;
			setOverId(typeof id === "string" && id.startsWith("canvas:") ? id.slice(7) : null);
		},
		onDragEnd: () => setOverId(null),
		onDragCancel: () => setOverId(null),
	});

	// Re-measure when images load or the content resizes.
	useEffect(() => {
		const stage = stageRef.current;
		if (!stage) return;
		const bump = () => setTick((t) => t + 1);
		const ro = new ResizeObserver(bump);
		ro.observe(stage.firstElementChild ?? stage);
		stage.addEventListener("load", bump, true);
		return () => {
			ro.disconnect();
			stage.removeEventListener("load", bump, true);
		};
	}, [stageRef]);

	useLayoutEffect(() => {
		const stage = stageRef.current;
		if (!stage) return;
		const s = stage.getBoundingClientRect();
		const measure = (id: string | null): Box | null => {
			const el = id ? stage.querySelector(`[data-node-id="${id}"]`) : null;
			if (!el) return null;
			const r = el.getBoundingClientRect();
			return {
				left: (r.left - s.left) / z,
				top: (r.top - s.top) / z,
				width: r.width / z,
				height: r.height / z,
			};
		};
		setBoxes({ selected: measure(selectedId), hover: measure(hoverId), over: measure(overId) });
	}, [screen, selectedId, hoverId, overId, z, tick, stageRef]);

	const selected = selectedId ? findNode(screen.root, selectedId) : null;
	const parent = selectedId ? findParent(screen.root, selectedId) : null;
	const movable = !!selected && !!parent && isFreeFrame(parent);

	/** Pointer drag that writes style through one coalesced undo step. */
	const startDrag = (e: React.PointerEvent, kind: "move" | "resize") => {
		if (!selected || !boxes.selected) return;
		e.stopPropagation();
		e.preventDefault();
		const start = {
			x: e.clientX,
			y: e.clientY,
			left: Number(selected.style.left ?? 0),
			top: Number(selected.style.top ?? 0),
			width: boxes.selected.width,
			height: boxes.selected.height,
		};
		const key = `${kind}:${selected.id}:${Date.now()}`;
		const onMove = (ev: PointerEvent) => {
			const dx = (ev.clientX - start.x) / z;
			const dy = (ev.clientY - start.y) / z;
			const patch =
				kind === "move"
					? { left: Math.round(start.left + dx), top: Math.round(start.top + dy) }
					: {
							width: Math.max(8, Math.round(start.width + dx)),
							height: Math.max(8, Math.round(start.height + dy)),
						};
			updateStyle(selected.id, patch, key);
		};
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			endGesture();
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	};

	const toStyle = (b: Box): CSSProperties => ({
		left: b.left,
		top: b.top,
		width: b.width,
		height: b.height,
	});
	const inv = 1 / z; // keep editor chrome a constant on-screen size at any zoom
	return (
		<div className="overlay">
			{boxes.hover && hoverId !== selectedId && (
				<div className="ov-hover" style={{ ...toStyle(boxes.hover), borderWidth: inv }} />
			)}
			{boxes.over && (
				<div className="ov-over" style={{ ...toStyle(boxes.over), borderWidth: 2 * inv }} />
			)}
			{boxes.selected && selected && (
				<div
					className={`ov-selected${movable ? " movable" : ""}`}
					style={{ ...toStyle(boxes.selected), borderWidth: 2 * inv }}
					onPointerDown={movable ? (e) => startDrag(e, "move") : undefined}
				>
					<span className="ov-label" style={{ transform: `scale(${inv})` }}>
						{selected.type}
					</span>
					{selected.id !== "root" && (
						<div
							className="ov-handle"
							style={{ transform: `scale(${inv})` }}
							title="Drag to resize"
							onPointerDown={(e) => startDrag(e, "resize")}
						/>
					)}
				</div>
			)}
		</div>
	);
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
				<Overlay stageRef={stageRef} />
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
