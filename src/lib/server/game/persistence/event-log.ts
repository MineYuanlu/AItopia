import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import type { EventType, UUID, WorldEvent } from '../types';

/**
 * Dedicated event sourcing module.
 * All events must go through EventLog to ensure the log is the source of truth.
 */
export class EventLog {
	private worldId: UUID;

	constructor(worldId: UUID) {
		this.worldId = worldId;
	}

	/**
	 * Append a single event to the log.
	 */
	async append(event: Omit<WorldEvent, 'id' | 'createdAt'>): Promise<WorldEvent> {
		const fullEvent: WorldEvent = {
			...event,
			id: crypto.randomUUID(),
			createdAt: Date.now()
		};

		await db.insert(schema.events).values({
			id: fullEvent.id,
			worldId: fullEvent.worldId,
			tickTime: fullEvent.tickTime,
			type: fullEvent.type,
			agentId: fullEvent.agentId,
			data: fullEvent.data
		});

		return fullEvent;
	}

	/**
	 * Append multiple events (batch insert).
	 */
	async appendMany(events: Omit<WorldEvent, 'id' | 'createdAt'>[]): Promise<WorldEvent[]> {
		if (events.length === 0) return [];

		const fullEvents: WorldEvent[] = events.map((event) => ({
			...event,
			id: crypto.randomUUID(),
			createdAt: Date.now()
		}));

		// SQLite via Drizzle supports batch insert via values(array)
		await db.insert(schema.events).values(
			fullEvents.map((event) => ({
				id: event.id,
				worldId: event.worldId,
				tickTime: event.tickTime,
				type: event.type,
				agentId: event.agentId,
				data: event.data
			}))
		);

		return fullEvents;
	}

	/**
	 * Get events in a time range with optional filtering.
	 */
	async getEvents(options: {
		fromTick?: number;
		toTick?: number;
		agentId?: UUID;
		types?: EventType[];
		limit?: number;
		offset?: number;
	}): Promise<WorldEvent[]> {
		const conditions = [eq(schema.events.worldId, this.worldId)];

		if (options.fromTick !== undefined) {
			conditions.push(gte(schema.events.tickTime, options.fromTick));
		}
		if (options.toTick !== undefined) {
			conditions.push(lte(schema.events.tickTime, options.toTick));
		}
		if (options.agentId !== undefined) {
			conditions.push(eq(schema.events.agentId, options.agentId));
		}
		if (options.types !== undefined && options.types.length > 0) {
			// Drizzle ORM doesn't have a native IN for enums easily;
			// use sql`IN` for the array of types.
			conditions.push(sql`${schema.events.type} IN ${options.types}`);
		}

		const limit = options.limit ?? 100;
		const offset = options.offset ?? 0;

		const rows = await db
			.select()
			.from(schema.events)
			.where(and(...conditions))
			.orderBy(asc(schema.events.tickTime))
			.limit(limit)
			.offset(offset);

		return rows.map((row) => this.rowToWorldEvent(row));
	}

	/**
	 * Get events for a specific agent, ordered by tick time descending.
	 */
	async getAgentEvents(agentId: UUID, limit: number = 50): Promise<WorldEvent[]> {
		const rows = await db
			.select()
			.from(schema.events)
			.where(and(eq(schema.events.worldId, this.worldId), eq(schema.events.agentId, agentId)))
			.orderBy(desc(schema.events.tickTime))
			.limit(limit);

		// Return in chronological order (ascending)
		return rows.reverse().map((row) => this.rowToWorldEvent(row));
	}

	/**
	 * Replay events to rebuild state (for snapshot restoration).
	 * Returns events from the given tick in chronological order.
	 */
	async replayEvents(fromTick: number = 0): Promise<WorldEvent[]> {
		const rows = await db
			.select()
			.from(schema.events)
			.where(and(eq(schema.events.worldId, this.worldId), gte(schema.events.tickTime, fromTick)))
			.orderBy(asc(schema.events.tickTime));

		return rows.map((row) => this.rowToWorldEvent(row));
	}

	/**
	 * Get the latest tick time recorded in the event log.
	 */
	async getLatestTick(): Promise<number> {
		const result = await db
			.select({ maxTick: sql<number>`MAX(${schema.events.tickTime})` })
			.from(schema.events)
			.where(eq(schema.events.worldId, this.worldId));

		return result[0]?.maxTick ?? 0;
	}

	/**
	 * Count total events for this world.
	 */
	async count(): Promise<number> {
		const result = await db
			.select({ count: sql<number>`COUNT(*)` })
			.from(schema.events)
			.where(eq(schema.events.worldId, this.worldId));

		return result[0]?.count ?? 0;
	}

	/**
	 * Prune old events before a given tick.
	 * Returns the count of deleted events.
	 */
	async prune(beforeTick: number): Promise<number> {
		const result = await db
			.delete(schema.events)
			.where(and(eq(schema.events.worldId, this.worldId), lt(schema.events.tickTime, beforeTick)));

		return result.changes ?? 0;
	}

	private rowToWorldEvent(row: {
		id: string;
		worldId: string;
		tickTime: number;
		type: string;
		agentId: string | null;
		data: unknown;
		createdAt: Date;
	}): WorldEvent {
		return {
			id: row.id,
			worldId: row.worldId,
			tickTime: row.tickTime,
			type: row.type as EventType,
			agentId: row.agentId,
			data: row.data as Record<string, unknown>,
			createdAt: row.createdAt.getTime()
		};
	}
}

// Helper needed for prune (lt was not imported above) — actually it is needed.
import { lt } from 'drizzle-orm';
