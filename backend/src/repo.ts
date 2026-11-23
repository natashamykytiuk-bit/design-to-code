import { randomUUID } from "node:crypto";

export type Design = {
	id: string;
	name: string;
	doc: unknown;
	createdAt: string;
	updatedAt: string;
};
export type DesignSummary = Omit<Design, "doc">;

/** Storage for designs. Every call is scoped to one owner (the signed-in user). */
export interface DesignRepo {
	list(ownerId: string): Promise<DesignSummary[]>;
	get(ownerId: string, id: string): Promise<Design | null>;
	create(ownerId: string, name: string, doc: unknown): Promise<Design>;
	update(ownerId: string, id: string, name: string, doc: unknown): Promise<Design | null>;
	remove(ownerId: string, id: string): Promise<boolean>;
}

type Row = Design & { ownerId: string };

/** In-memory repo, used by tests so they need no database. */
export function memoryRepo(): DesignRepo {
	const rows = new Map<string, Row>();
	const toDesign = ({ ownerId: _owner, ...d }: Row): Design => d;
	const owned = (ownerId: string, id: string) => {
		const r = rows.get(id);
		return r && r.ownerId === ownerId ? r : null;
	};

	return {
		async list(ownerId) {
			return [...rows.values()]
				.filter((r) => r.ownerId === ownerId)
				.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
				.map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt }));
		},
		async get(ownerId, id) {
			const r = owned(ownerId, id);
			return r && toDesign(r);
		},
		async create(ownerId, name, doc) {
			const now = new Date().toISOString();
			const r: Row = { id: randomUUID(), ownerId, name, doc, createdAt: now, updatedAt: now };
			rows.set(r.id, r);
			return toDesign(r);
		},
		async update(ownerId, id, name, doc) {
			const r = owned(ownerId, id);
			if (!r) return null;
			Object.assign(r, { name, doc, updatedAt: new Date().toISOString() });
			return toDesign(r);
		},
		async remove(ownerId, id) {
			return owned(ownerId, id) ? rows.delete(id) : false;
		},
	};
}
