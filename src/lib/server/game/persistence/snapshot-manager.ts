import { eq, desc } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import type { UUID, WorldState } from '../types';

export interface Snapshot {
	id: UUID;
	worldId: UUID;
	tickTime: number;
	worldState: WorldState;
	eventCount: number;
	createdAt: number;
}

/**
 * World state snapshot management.
 * Snapshots are acceleration structures — they speed up recovery but events are the truth.
 */
export class SnapshotManager {
	private worldId: UUID;
	private lastSnapshotEventCount: number = 0;

	constructor(worldId: UUID) {
		this.worldId = worldId;
	}

	/**
	 * Save current world state as a snapshot.
	 */
	async save(worldState: WorldState, eventCount: number): Promise<Snapshot> {
		const id = crypto.randomUUID();
		const now = Date.now();

		// Serialize state: convert Maps to plain objects for JSON storage.
		const serializedState = this.serializeWorldState(worldState);

		await db.insert(schema.snapshots).values({
			id,
			worldId: this.worldId,
			tickTime: worldState.currentTime,
			worldState: serializedState,
			eventCount,
			createdAt: new Date(now)
		});

		this.lastSnapshotEventCount = eventCount;

		return {
			id,
			worldId: this.worldId,
			tickTime: worldState.currentTime,
			worldState,
			eventCount,
			createdAt: now
		};
	}

	/**
	 * Load the most recent snapshot for this world.
	 */
	async loadLatest(): Promise<Snapshot | null> {
		const rows = await db
			.select()
			.from(schema.snapshots)
			.where(eq(schema.snapshots.worldId, this.worldId))
			.orderBy(desc(schema.snapshots.tickTime))
			.limit(1);

		if (rows.length === 0) return null;

		return this.rowToSnapshot(rows[0]);
	}

	/**
	 * Load a specific snapshot by ID.
	 */
	async load(snapshotId: UUID): Promise<Snapshot | null> {
		const rows = await db
			.select()
			.from(schema.snapshots)
			.where(eq(schema.snapshots.id, snapshotId))
			.limit(1);

		if (rows.length === 0) return null;

		return this.rowToSnapshot(rows[0]);
	}

	/**
	 * Get all snapshots for this world, ordered by tick time descending.
	 */
	async list(): Promise<Array<{ id: UUID; tickTime: number; createdAt: number }>> {
		const rows = await db
			.select({
				id: schema.snapshots.id,
				tickTime: schema.snapshots.tickTime,
				createdAt: schema.snapshots.createdAt
			})
			.from(schema.snapshots)
			.where(eq(schema.snapshots.worldId, this.worldId))
			.orderBy(desc(schema.snapshots.tickTime));

		return rows.map((row) => ({
			id: row.id,
			tickTime: row.tickTime,
			createdAt: row.createdAt.getTime()
		}));
	}

	/**
	 * Delete a snapshot.
	 */
	async delete(snapshotId: UUID): Promise<void> {
		await db.delete(schema.snapshots).where(eq(schema.snapshots.id, snapshotId));
	}

	/**
	 * Restore world state from a snapshot.
	 */
	async restore(snapshotId: UUID): Promise<WorldState | null> {
		const snapshot = await this.load(snapshotId);
		if (!snapshot) return null;

		return this.deserializeWorldState(snapshot.worldState as unknown as Record<string, unknown>);
	}

	/**
	 * Auto-save: save a snapshot only if enough events have passed since the last snapshot.
	 * Returns the saved snapshot or null if the interval wasn't met.
	 */
	async autoSave(
		worldState: WorldState,
		currentEventCount: number,
		interval: number = 100
	): Promise<Snapshot | null> {
		const eventsSinceLastSnapshot = currentEventCount - this.lastSnapshotEventCount;
		if (eventsSinceLastSnapshot < interval) return null;

		return this.save(worldState, currentEventCount);
	}

	private serializeWorldState(state: WorldState): Record<string, unknown> {
		return {
			...state,
			scenes: Array.from(state.scenes.entries()),
			entities: Array.from(state.entities.entries()),
			components: Array.from(state.components.entries())
		};
	}

	private deserializeWorldState(data: Record<string, unknown>): WorldState {
		return {
			id: data.id as UUID,
			currentTime: data.currentTime as number,
			scenes: new Map(data.scenes as [UUID, unknown][]),
			entities: new Map(data.entities as [UUID, unknown][]),
			components: new Map(data.components as [UUID, unknown][])
		} as unknown as WorldState;
	}

	private rowToSnapshot(row: {
		id: string;
		worldId: string;
		tickTime: number;
		worldState: unknown;
		eventCount: number;
		createdAt: Date;
	}): Snapshot {
		const worldState = this.deserializeWorldState(row.worldState as Record<string, unknown>);

		return {
			id: row.id,
			worldId: row.worldId,
			tickTime: row.tickTime,
			worldState,
			eventCount: row.eventCount,
			createdAt: row.createdAt.getTime()
		};
	}
}
