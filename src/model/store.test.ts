import { beforeEach, describe, expect, it } from "vitest";
import { parseDoc, useStore } from "./store";
import { findNode, findParent } from "./tree";

const st = () => useStore.getState();
const root = () => st().doc.screens[0].root;

beforeEach(() => st().reset());

describe("store", () => {
	it("adds a node with defaults and selects it", () => {
		const id = st().addNode("Button", "root")!;
		expect(findNode(root(), id)?.props.label).toBe("Button");
		expect(st().selectedId).toBe(id);
	});

	it("refuses to add into a non-container", () => {
		const text = root().children[0].id;
		expect(st().addNode("Button", text)).toBeNull();
	});

	it("moves a node within and across parents", () => {
		const [a, b, c] = root().children.map((n) => n.id);
		st().moveNode(c, "root", 0);
		expect(root().children.map((n) => n.id)).toEqual([c, a, b]);

		const stack = st().addNode("Stack", "root")!;
		st().moveNode(a, stack, 0);
		expect(findParent(root(), a)?.id).toBe(stack);
	});

	it("never moves a node into its own subtree", () => {
		const outer = st().addNode("Stack", "root")!;
		const inner = st().addNode("Stack", outer)!;
		st().moveNode(outer, inner, 0);
		expect(findParent(root(), outer)?.id).toBe("root");
	});

	it("removes a node but never the root", () => {
		const id = root().children[0].id;
		st().removeNode(id);
		st().removeNode("root");
		expect(findNode(root(), id)).toBeNull();
		expect(root().id).toBe("root");
	});

	it("undoes and redoes", () => {
		const before = st().doc;
		st().updateProps(root().children[0].id, { text: "Changed" });
		const after = st().doc;
		st().undo();
		expect(st().doc).toBe(before);
		st().redo();
		expect(st().doc).toBe(after);
	});

	it("coalesces a drag gesture into one undo step", () => {
		const id = root().children[0].id;
		const depth = st().past.length;
		for (let i = 0; i < 5; i++) st().updateStyle(id, { left: i }, "move:1");
		st().endGesture();
		expect(st().past.length).toBe(depth + 1);
		st().undo();
		expect(findNode(root(), id)?.style.left).toBeUndefined();
	});

	it("validates imported docs", () => {
		expect(parseDoc("nope")).toBeNull();
		expect(parseDoc('{"screens":[]}')).toBeNull();
		expect(parseDoc(JSON.stringify(st().doc))).not.toBeNull();
	});
});
