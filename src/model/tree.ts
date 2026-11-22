import type { Node } from "./types";

let counter = 0;
export const newId = () => `n${Date.now().toString(36)}${(counter++).toString(36)}`;

export function findNode(root: Node, id: string): Node | null {
	if (root.id === id) return root;
	for (const c of root.children) {
		const hit = findNode(c, id);
		if (hit) return hit;
	}
	return null;
}

export function findParent(root: Node, id: string): Node | null {
	for (const c of root.children) {
		if (c.id === id) return root;
		const hit = findParent(c, id);
		if (hit) return hit;
	}
	return null;
}

export function isDescendant(root: Node, ancestorId: string, id: string): boolean {
	const ancestor = findNode(root, ancestorId);
	return !!ancestor && !!findNode(ancestor, id);
}
