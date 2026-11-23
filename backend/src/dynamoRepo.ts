import { randomUUID } from "node:crypto";
import {
	CreateTableCommand,
	DynamoDBClient,
	ResourceInUseException,
} from "@aws-sdk/client-dynamodb";
import {
	DeleteCommand,
	DynamoDBDocumentClient,
	GetCommand,
	PutCommand,
	QueryCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Design, DesignRepo, DesignSummary } from "./repo.js";

/**
 * Table layout (one item per design):
 *   ownerId  partition key — the signed-in user's id, so a user's designs live together
 *   id       sort key      — the design's UUID
 *   name, createdAt, updatedAt
 *   doc      the design JSON, stored as a string
 *
 * A single DynamoDB item is capped at 400 KB, so the API limits request size to match.
 */
export type DynamoConfig = { tableName: string; endpoint?: string };

export function dynamoConfigFromEnv(): DynamoConfig {
	const tableName = process.env.TABLE_NAME;
	if (!tableName) throw new Error("TABLE_NAME is not set");
	return { tableName, endpoint: process.env.DYNAMODB_ENDPOINT || undefined };
}

function createClient(cfg: DynamoConfig) {
	return new DynamoDBClient(cfg.endpoint ? { endpoint: cfg.endpoint } : {});
}

/** Local development only: create the table in DynamoDB Local if it is missing. */
export async function ensureTable(cfg: DynamoConfig): Promise<void> {
	try {
		await createClient(cfg).send(
			new CreateTableCommand({
				TableName: cfg.tableName,
				BillingMode: "PAY_PER_REQUEST",
				AttributeDefinitions: [
					{ AttributeName: "ownerId", AttributeType: "S" },
					{ AttributeName: "id", AttributeType: "S" },
				],
				KeySchema: [
					{ AttributeName: "ownerId", KeyType: "HASH" },
					{ AttributeName: "id", KeyType: "RANGE" },
				],
			}),
		);
	} catch (err) {
		if (!(err instanceof ResourceInUseException)) throw err;
	}
}

type Item = DesignSummary & { ownerId: string; doc: string };

const toDesign = (i: Item): Design => ({
	id: i.id,
	name: i.name,
	createdAt: i.createdAt,
	updatedAt: i.updatedAt,
	doc: JSON.parse(i.doc),
});

export function dynamoRepo(cfg: DynamoConfig): DesignRepo {
	const db = DynamoDBDocumentClient.from(createClient(cfg));
	const TableName = cfg.tableName;

	return {
		async list(ownerId) {
			const items: DesignSummary[] = [];
			let ExclusiveStartKey: Record<string, unknown> | undefined;
			do {
				const r = await db.send(
					new QueryCommand({
						TableName,
						KeyConditionExpression: "ownerId = :o",
						ExpressionAttributeValues: { ":o": ownerId },
						// Leave out the (large) doc; "name" is a reserved word, hence #n.
						ProjectionExpression: "id, #n, createdAt, updatedAt",
						ExpressionAttributeNames: { "#n": "name" },
						ExclusiveStartKey,
					}),
				);
				items.push(...((r.Items ?? []) as DesignSummary[]));
				ExclusiveStartKey = r.LastEvaluatedKey;
			} while (ExclusiveStartKey);
			return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
		},

		async get(ownerId, id) {
			const r = await db.send(new GetCommand({ TableName, Key: { ownerId, id } }));
			return r.Item ? toDesign(r.Item as Item) : null;
		},

		async create(ownerId, name, doc) {
			const now = new Date().toISOString();
			const item: Item = {
				ownerId,
				id: randomUUID(),
				name,
				doc: JSON.stringify(doc),
				createdAt: now,
				updatedAt: now,
			};
			await db.send(new PutCommand({ TableName, Item: item }));
			return toDesign(item);
		},

		async update(ownerId, id, name, doc) {
			try {
				const r = await db.send(
					new UpdateCommand({
						TableName,
						Key: { ownerId, id },
						UpdateExpression: "SET #n = :n, doc = :d, updatedAt = :u",
						// Only update a design that exists and belongs to this user.
						ConditionExpression: "attribute_exists(id)",
						ExpressionAttributeNames: { "#n": "name" },
						ExpressionAttributeValues: {
							":n": name,
							":d": JSON.stringify(doc),
							":u": new Date().toISOString(),
						},
						ReturnValues: "ALL_NEW",
					}),
				);
				return toDesign(r.Attributes as Item);
			} catch (err) {
				if ((err as Error).name === "ConditionalCheckFailedException") return null;
				throw err;
			}
		},

		async remove(ownerId, id) {
			const r = await db.send(
				new DeleteCommand({ TableName, Key: { ownerId, id }, ReturnValues: "ALL_OLD" }),
			);
			return Boolean(r.Attributes);
		},
	};
}
