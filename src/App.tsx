import { useEffect, useState } from "react";
import {
	DndContext,
	DragOverlay,
	PointerSensor,
	pointerWithin,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragStartEvent,
} from "@dnd-kit/core";
import { parseDoc, useStore } from "./model/store";
import { findNode, findParent } from "./model/tree";
import { registry } from "./registry";
import { LeftPanel } from "./ui/LeftPanel";
import { Canvas } from "./ui/Canvas";
import { Properties } from "./ui/Properties";
import { ThemeEditor } from "./ui/ThemeEditor";
import { CodeView } from "./ui/CodeView";

type View = "design" | "code" | "theme";

export default function App() {
	const [view, setView] = useState<View>("design");
	const [dragLabel, setDragLabel] = useState<string | null>(null);
	const [status, setStatus] = useState("");
	const s = useStore();
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

	useEffect(() => {
		s.load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const typing = (e.target as HTMLElement).closest("input, textarea, select");
			const mod = e.ctrlKey || e.metaKey;
			if (mod && e.key.toLowerCase() === "z" && !typing) {
				e.preventDefault();
				e.shiftKey ? useStore.getState().redo() : useStore.getState().undo();
			} else if (mod && e.key.toLowerCase() === "y" && !typing) {
				e.preventDefault();
				useStore.getState().redo();
			} else if (mod && e.key.toLowerCase() === "s") {
				e.preventDefault();
				useStore.getState().save();
				flash("Saved");
			} else if ((e.key === "Delete" || e.key === "Backspace") && !typing) {
				const id = useStore.getState().selectedId;
				if (id) useStore.getState().removeNode(id);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const flash = (msg: string) => {
		setStatus(msg);
		setTimeout(() => setStatus(""), 1500);
	};

	const onDragStart = (e: DragStartEvent) => {
		const d = e.active.data.current as { kind: string; type?: string; nodeId?: string };
		setDragLabel(d.kind === "palette" ? d.type! : "Layer");
	};

	const onDragEnd = (e: DragEndEvent) => {
		setDragLabel(null);
		const { active, over } = e;
		if (!over) return;
		const src = active.data.current as {
			kind: "palette" | "layer";
			type?: string;
			nodeId?: string;
		};
		const dst = over.data.current as { nodeId: string; fromLayers?: boolean };
		const state = useStore.getState();
		const root = (state.doc.screens.find((x) => x.id === state.screenId) ?? state.doc.screens[0])
			.root;
		const target = findNode(root, dst.nodeId);
		if (!target) return;
		const isContainer = registry[target.type].container;

		// On a layer row: top half = before the target, bottom half = inside (Stack) or after.
		let placement: "inside" | "before" | "after" = isContainer ? "inside" : "after";
		if (dst.fromLayers && target.id !== "root") {
			const rect = active.rect.current.translated;
			const midY = rect ? rect.top + rect.height / 2 : 0;
			const overMid = over.rect.top + over.rect.height / 2;
			placement = midY < overMid ? "before" : isContainer ? "inside" : "after";
		}

		let parentId: string;
		let index: number;
		if (placement === "inside") {
			parentId = target.id;
			index = target.children.length;
		} else {
			const parent = findParent(root, target.id);
			if (!parent) return;
			parentId = parent.id;
			index =
				parent.children.findIndex((c) => c.id === target.id) + (placement === "after" ? 1 : 0);
		}

		if (src.kind === "palette") {
			state.addNode(src.type!, parentId, index);
		} else if (src.nodeId && src.nodeId !== target.id) {
			state.moveNode(src.nodeId, parentId, index);
		}
	};

	const exportJson = () => {
		const blob = new Blob([JSON.stringify(s.doc, null, "\t")], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		Object.assign(document.createElement("a"), { href: url, download: "design.json" }).click();
		URL.revokeObjectURL(url);
	};

	const importJson = async (file: File | undefined) => {
		if (!file) return;
		const doc = parseDoc(await file.text());
		if (doc) {
			s.replaceDoc(doc);
			flash("Imported");
		} else flash("Not a valid design file");
	};

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={pointerWithin}
			onDragStart={onDragStart}
			onDragEnd={onDragEnd}
		>
			<div className="app">
				<header className="topbar">
					<strong className="brand">Design → Code</strong>
					<div className="seg">
						{(["design", "code", "theme"] as View[]).map((v) => (
							<button key={v} className={view === v ? "active" : ""} onClick={() => setView(v)}>
								{v[0].toUpperCase() + v.slice(1)}
							</button>
						))}
					</div>
					<span className="spacer" />
					<label className="inline">
						Theme
						<select value={s.doc.activeThemeId} onChange={(e) => s.setActiveTheme(e.target.value)}>
							{s.doc.themes.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
								</option>
							))}
						</select>
					</label>
					<button onClick={s.undo} disabled={!s.past.length} title="Undo (Ctrl+Z)">
						Undo
					</button>
					<button onClick={s.redo} disabled={!s.future.length} title="Redo (Ctrl+Shift+Z)">
						Redo
					</button>
					<button
						onClick={() => {
							s.save();
							flash("Saved");
						}}
						title="Save to localStorage (Ctrl+S)"
					>
						Save
					</button>
					<button onClick={() => flash(s.load() ? "Loaded" : "Nothing saved yet")}>Load</button>
					<button onClick={exportJson} title="Download the design as JSON">
						Export
					</button>
					<label className="file-btn" title="Open a design JSON file">
						Import
						<input
							type="file"
							accept="application/json,.json"
							hidden
							onChange={(e) => {
								importJson(e.target.files?.[0]);
								e.target.value = "";
							}}
						/>
					</label>
					<button onClick={s.reset} title="Start over with the sample screen">
						New
					</button>
					<span className="status">{status}</span>
				</header>
				<LeftPanel />
				<main className="center">
					{view === "design" && <Canvas />}
					{view === "code" && <CodeView />}
					{view === "theme" && <ThemeEditor />}
				</main>
				<Properties />
			</div>
			<DragOverlay dropAnimation={null}>
				{dragLabel && <div className="drag-ghost">{dragLabel}</div>}
			</DragOverlay>
		</DndContext>
	);
}
