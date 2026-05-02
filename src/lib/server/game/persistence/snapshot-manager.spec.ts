import { describe, it, expect, beforeEach } from 'vitest';
import { SnapshotManager } from './snapshot-manager';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import type { UUID, WorldState } from '../types';

async function cleanupWorld(worldId: UUID): Promise<void> {
	const entitiesInWorld = await db
		.select({ id: schema.entities.id })
		.from(schema.entities)
		.where(eq(schema.entities.worldId, worldId));
	const entityIds = entitiesInWorld.map((r) => r.id);

	if (entityIds.length > 0) {
		await db.delete(schema.components).where(inArray(schema.components.entityId, entityIds));
	}
	await db.delete(schema.agentStates).where(eq(schema.agentStates.worldId, worldId));
	await db.delete(schema.entities).where(eq(schema.entities.worldId, worldId));
	await db.delete(schema.scenes).where(eq(schema.scenes.worldId, worldId));
	await db.delete(schema.events).where(eq(schema.events.worldId, worldId));
	await db.delete(schema.snapshots).where(eq(schema.snapshots.worldId, worldId));
	await db.delete(schema.worlds).where(eq(schema.worlds.id, worldId));
}

function makeDummyState(tickTime: number): WorldState {
	return {
		id: 'world-1' as UUID,
		currentTime: tickTime,
		scenes: new Map([
			[
				'scene-1' as UUID,
				{
					id: 'scene-1' as UUID,
					worldId: 'world-1' as UUID,
					parentId: null,
					name: 'Town',
					type: 'town' as const,
					description: '',
					properties: {},
					exits: []
				}
			]
		]),
		entities: new Map(),
		components: new Map()
	};
}

describe('SnapshotManager', () => {
	let worldId: UUID;
	let manager: SnapshotManager;

	beforeEach(async () => {
		worldId = crypto.randomUUID();
		await cleanupWorld(worldId);
		await db.insert(schema.worlds).values({ id: worldId, name: 'Snap Test' });
		manager = new SnapshotManager(worldId);
	});

	it('should save and load a snapshot', async () => {
		const state = makeDummyState(100);
		const saved = await manager.save(state, 10);

		expect(saved.id).toBeDefined();
		expect(saved.tickTime).toBe(100);
		expect(saved.eventCount).toBe(10);
		expect(saved.worldState.currentTime).toBe(100);

		const loaded = await manager.load(saved.id);
		expect(loaded).not.toBeNull();
		expect(loaded!.tickTime).toBe(100);
		expect(loaded!.eventCount).toBe(10);
	});

	it('should load the latest snapshot', async () => {
		await manager.save(makeDummyState(50), 5);
		await manager.save(makeDummyState(100), 12);
		await manager.save(makeDummyState(75), 8);

		const latest = await manager.loadLatest();
		expect(latest).not.toBeNull();
		expect(latest!.tickTime).toBe(100);
	});

	it('should list snapshots ordered by tickTime desc', async () => {
		await manager.save(makeDummyState(20), 2);
		await manager.save(makeDummyState(50), 5);

		const list = await manager.list();
		expect(list.length).toBe(2);
		expect(list[0].tickTime).toBe(50);
		expect(list[1].tickTime).toBe(20);
	});

	it('should delete a snapshot', async () => {
		const saved = await manager.save(makeDummyState(10), 1);
		expect(await manager.load(saved.id)).not.toBeNull();

		await manager.delete(saved.id);
		expect(await manager.load(saved.id)).toBeNull();
	});

	it('should restore world state from snapshot', async () => {
		const state = makeDummyState(123);
		const saved = await manager.save(state, 7);

		const restored = await manager.restore(saved.id);
		expect(restored).not.toBeNull();
		expect(restored!.currentTime).toBe(123);
		expect(restored!.id).toBe('world-1');
		expect(restored!.scenes.has('scene-1' as UUID)).toBe(true);
	});

	it('autoSave should only save when interval is met', async () => {
		const state = makeDummyState(0);

		// First autoSave at 0 events with interval 5 -> null (no prior snapshot, but 0 < 5)
		const first = await manager.autoSave(state, 0, 5);
		expect(first).toBeNull();

		// Manually save to set baseline
		await manager.save(state, 0);

		// 3 events since last snapshot < 5 -> null
		const second = await manager.autoSave(state, 3, 5);
		expect(second).toBeNull();

		// 7 events since last snapshot >= 5 -> save
		const third = await manager.autoSave(state, 7, 5);
		expect(third).not.toBeNull();
		expect(third!.eventCount).toBe(7);
	});

	it('loadLatest should return null when no snapshots exist', async () => {
		const latest = await manager.loadLatest();
		expect(latest).toBeNull();
	});
});
