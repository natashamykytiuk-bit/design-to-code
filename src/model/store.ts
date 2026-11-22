import { create } from "zustand";
import { produce, type Draft } from "immer";
import type { Doc, Node, StyleValue, TokenGroup } from "./types";
import { findNode, findParent, isDescendant, newId } from "./tree";
import { registry } from "../registry";
import { starterThemes } from "../theme/tokens";

const STORAGE_KEY = "design-to-code:doc";
const HISTORY_LIMIT = 100;

export function createNode(type: string): Node {
	const def = registry[type];
	return {
		id: newId(),
		type,
		props: structuredClone(def.defaultProps),
		style: structuredClone(def.defaultStyle),
		children: [],
	};
}

export function initialDoc(): Doc {
	const root: Node = { ...createNode("Stack"), id: "root" };
	root.props.padding = "lg";
	root.style = { background: "$color.bg", minHeight: "100%" };
	const title = createNode("Text");
	title.props = { text: "Welcome back", as: "h1" };
	title.style = { ...title.style, fontSize: "$font.xl" };
	const input = createNode("Input");
	const button = createNode("Button");
	button.props.label = "Sign in";
	root.children = [title, input, button];
	return { screens: [{ id: "s1", name: "Screen", root }], themes: structuredClone(starterThemes), activeThemeId: "light" };
}

type State = {
	doc: Doc;
	past: Doc[];
	future: Doc[];
	selectedId: string | null;
	hoverId: string | null;
	screenId: string;

	select: (id: string | null) => void;
	hover: (id: string | null) => void;
	addNode: (type: string, parentId: string, index?: number) => void;
	removeNode: (id: string) => void;
	moveNode: (id: string, parentId: string, index: number) => void;
	updateProps: (id: string, patch: Record<string, unknown>) => void;
	updateStyle: (id: string, patch: Record<string, StyleValue | undefined>) => void;
	setToken: (group: TokenGroup, name: string, value: string) => void;
	setActiveTheme: (id: string) => void;
	undo: () => void;
	redo: () => void;
	save: () => void;
	load: () => boolean;
	reset: () => void;
};

export const useStore = create<State>((set, get) => {
	/** Every edit is a small Immer recipe on the doc; the old doc goes onto the undo stack. */
	const commit = (recipe: (doc: Draft<Doc>, root: Draft<Node>) => void) => {
		const { doc, past, screenId } = get();
		const next = produce(doc, (d) => {
			const screen = d.screens.find((s) => s.id === screenId) ?? d.screens[0];
			recipe(d, screen.root);
		});
		if (next === doc) return;
		set({ doc: next, past: [...past, doc].slice(-HISTORY_LIMIT), future: [] });
	};

	return {
		doc: initialDoc(),
		past: [],
		future: [],
		selectedId: null,
		hoverId: null,
		screenId: "s1",

		select: (id) => set({ selectedId: id }),
		hover: (id) => set({ hoverId: id }),

		addNode: (type, parentId, index) => {
			const node = createNode(type);
			commit((_, root) => {
				const parent = findNode(root as Node, parentId) as Draft<Node> | null;
				if (!parent || !registry[parent.type].container) return;
				parent.children.splice(index ?? parent.children.length, 0, node);
			});
			set({ selectedId: node.id });
		},

		removeNode: (id) => {
			if (id === "root") return;
			commit((_, root) => {
				const parent = findParent(root as Node, id) as Draft<Node> | null;
				if (parent) parent.children = parent.children.filter((c) => c.id !== id);
			});
			if (get().selectedId === id) set({ selectedId: null });
		},

		moveNode: (id, parentId, index) => {
			commit((_, root) => {
				if (id === "root" || isDescendant(root as Node, id, parentId)) return;
				const from = findParent(root as Node, id) as Draft<Node> | null;
				const to = findNode(root as Node, parentId) as Draft<Node> | null;
				if (!from || !to || !registry[to.type].container) return;
				const oldIndex = from.children.findIndex((c) => c.id === id);
				const [node] = from.children.splice(oldIndex, 1);
				const adjusted = from === to && oldIndex < index ? index - 1 : index;
				to.children.splice(Math.max(0, Math.min(adjusted, to.children.length)), 0, node);
			});
		},

		updateProps: (id, patch) =>
			commit((_, root) => {
				const n = findNode(root as Node, id) as Draft<Node> | null;
				if (n) Object.assign(n.props, patch);
			}),

		updateStyle: (id, patch) =>
			commit((_, root) => {
				const n = findNode(root as Node, id) as Draft<Node> | null;
				if (!n) return;
				for (const [k, v] of Object.entries(patch)) {
					if (v === undefined || v === "") delete n.style[k];
					else n.style[k] = v;
				}
			}),

		setToken: (group, name, value) =>
			commit((d) => {
				const theme = d.themes.find((t) => t.id === d.activeThemeId);
				if (theme) theme.tokens[group][name] = value;
			}),

		setActiveTheme: (id) =>
			commit((d) => {
				d.activeThemeId = id;
			}),

		undo: () => {
			const { past, doc, future } = get();
			if (!past.length) return;
			set({ doc: past[past.length - 1], past: past.slice(0, -1), future: [doc, ...future] });
		},

		redo: () => {
			const { past, doc, future } = get();
			if (!future.length) return;
			set({ doc: future[0], past: [...past, doc], future: future.slice(1) });
		},

		save: () => localStorage.setItem(STORAGE_KEY, JSON.stringify(get().doc)),

		load: () => {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return false;
			try {
				const doc = JSON.parse(raw) as Doc;
				set({ doc, past: [], future: [], selectedId: null, screenId: doc.screens[0].id });
				return true;
			} catch {
				return false;
			}
		},

		reset: () => set({ doc: initialDoc(), past: [], future: [], selectedId: null, screenId: "s1" }),
	};
});

export const useScreen = () =>
	useStore((s) => s.doc.screens.find((x) => x.id === s.screenId) ?? s.doc.screens[0]);
export const useActiveTheme = () =>
	useStore((s) => s.doc.themes.find((t) => t.id === s.doc.activeThemeId) ?? s.doc.themes[0]);
