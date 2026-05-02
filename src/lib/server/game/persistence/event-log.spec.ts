import { describe, it, expect, beforeEach } from 'vitest';
import { EventLog } from './event-log';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import type { UUID, EventType } from '../types';

async function cleanupWorld(worldId: UUID): Promise<void> {
	// Delete rows tied to this world only, in FK-safe order
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

describe('EventLog', () => {
	let worldId: UUID;
	let eventLog: EventLog;

	beforeEach(async () => {
		worldId = crypto.randomUUID();
		await cleanupWorld(worldId);
		// Seed a world row so FK constraints are happy
		await db.insert(schema.worlds).values({ id: worldId, name: 'Test World' });
		eventLog = new EventLog(worldId);
	});

	it('should append a single event and return full event with id/createdAt', async () => {
		const result = await eventLog.append({
			worldId,
			tickTime: 10,
			type: 'SPEAK' as EventType,
			agentId: 'agent-1' as UUID,
			data: { content: 'Hello!' }
		});

		expect(result.id).toBeDefined();
		expect(result.createdAt).toBeGreaterThan(0);
		expect(result.tickTime).toBe(10);
		expect(result.type).toBe('SPEAK');
		expect(result.agentId).toBe('agent-1');
	});

	it('should appendMany events in batch', async () => {
		const results = await eventLog.appendMany([
			{
				worldId,
				tickTime: 1,
				type: 'SPEAK' as EventType,
				agentId: 'agent-1' as UUID,
				data: { content: 'A' }
			},
			{
				worldId,
				tickTime: 2,
				type: 'MOVE' as EventType,
				agentId: 'agent-1' as UUID,
				data: { direction: 'north' }
			}
		]);

		expect(results.length).toBe(2);
		expect(results[0].tickTime).toBe(1);
		expect(results[1].tickTime).toBe(2);

		const count = await eventLog.count();
		expect(count).toBe(2);
	});

	it('should get events filtered by tick range', async () => {
		await eventLog.appendMany([
			{ worldId, tickTime: 5, type: 'SPEAK' as EventType, agentId: null, data: {} },
			{ worldId, tickTime: 10, type: 'SPEAK' as EventType, agentId: null, data: {} },
			{ worldId, tickTime: 15, type: 'SPEAK' as EventType, agentId: null, data: {} }
		]);

		const events = await eventLog.getEvents({ fromTick: 6, toTick: 14 });
		expect(events.length).toBe(1);
		expect(events[0].tickTime).toBe(10);
	});

	it('should get events filtered by agentId', async () => {
		await eventLog.appendMany([
			{ worldId, tickTime: 1, type: 'SPEAK' as EventType, agentId: 'agent-a' as UUID, data: {} },
			{ worldId, tickTime: 2, type: 'SPEAK' as EventType, agentId: 'agent-b' as UUID, data: {} }
		]);

		const events = await eventLog.getEvents({ agentId: 'agent-a' as UUID });
		expect(events.length).toBe(1);
		expect(events[0].agentId).toBe('agent-a');
	});

	it('should get agent events ordered chronologically', async () => {
		await eventLog.appendMany([
			{ worldId, tickTime: 10, type: 'SPEAK' as EventType, agentId: 'agent-1' as UUID, data: {} },
			{ worldId, tickTime: 5, type: 'SPEAK' as EventType, agentId: 'agent-1' as UUID, data: {} },
			{ worldId, tickTime: 20, type: 'SPEAK' as EventType, agentId: 'agent-1' as UUID, data: {} }
		]);

		const events = await eventLog.getAgentEvents('agent-1' as UUID, 10);
		expect(events.map((e) => e.tickTime)).toEqual([5, 10, 20]);
	});

	it('should replay events from a given tick in chronological order', async () => {
		await eventLog.appendMany([
			{ worldId, tickTime: 0, type: 'WORLD_INIT' as EventType, agentId: null, data: {} },
			{ worldId, tickTime: 5, type: 'SPEAK' as EventType, agentId: null, data: {} },
			{ worldId, tickTime: 10, type: 'MOVE' as EventType, agentId: null, data: {} }
		]);

		const replayed = await eventLog.replayEvents(5);
		expect(replayed.length).toBe(2);
		expect(replayed[0].tickTime).toBe(5);
		expect(replayed[1].tickTime).toBe(10);
	});

	it('should return latest tick', async () => {
		expect(await eventLog.getLatestTick()).toBe(0);

		await eventLog.append({
			worldId,
			tickTime: 42,
			type: 'TIME_ADVANCE' as EventType,
			agentId: null,
			data: {}
		});

		expect(await eventLog.getLatestTick()).toBe(42);
	});

	it('should count events', async () => {
		expect(await eventLog.count()).toBe(0);
		await eventLog.appendMany([
			{ worldId, tickTime: 1, type: 'SPEAK' as EventType, agentId: null, data: {} },
			{ worldId, tickTime: 2, type: 'MOVE' as EventType, agentId: null, data: {} }
		]);
		expect(await eventLog.count()).toBe(2);
	});

	it('should prune old events and return count deleted', async () => {
		await eventLog.appendMany([
			{ worldId, tickTime: 1, type: 'SPEAK' as EventType, agentId: null, data: {} },
			{ worldId, tickTime: 5, type: 'SPEAK' as EventType, agentId: null, data: {} },
			{ worldId, tickTime: 10, type: 'SPEAK' as EventType, agentId: null, data: {} }
		]);

		const deleted = await eventLog.prune(6);
		expect(deleted).toBe(2);
		expect(await eventLog.count()).toBe(1);
	});
});
