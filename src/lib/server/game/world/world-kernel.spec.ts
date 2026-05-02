import { describe, it, expect, beforeEach } from 'vitest';
import { WorldKernel } from './world-kernel';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { UUID } from '../types';

// Since the DB module is already initialized with env.DATABASE_URL,
// we work with that database and clean specific tables between tests.

async function cleanupTables(): Promise<void> {
	// Delete in order to respect foreign key constraints
	await db.delete(schema.events);
	await db.delete(schema.snapshots);
	await db.delete(schema.agentStates);
	await db.delete(schema.components);
	await db.delete(schema.entities);
	await db.delete(schema.scenes);
	await db.delete(schema.worlds);
}

describe('WorldKernel', () => {
	beforeEach(async () => {
		await cleanupTables();
	});

	it('should create a world with root scene and a child scene', async () => {
		const kernel = await WorldKernel.create('Test World');
		expect(kernel.worldId).toBeDefined();

		// Check root scene
		const rootScene = kernel.sceneTree.getRootScene();
		expect(rootScene).toBeDefined();
		expect(rootScene!.name).toBe('青河镇');
		expect(rootScene!.type).toBe('town');

		// Check child scene
		const children = kernel.sceneTree.getChildren(rootScene!.id);
		expect(children.length).toBe(1);
		expect(children[0].name).toBe('幸福小区203-客厅');
		expect(children[0].type).toBe('room');

		// Check scene path
		const path = kernel.sceneTree.getScenePath(children[0].id);
		expect(path).toBe('青河镇/幸福小区203-客厅');
	});

	it('should create an agent entity and verify its scene', async () => {
		const kernel = await WorldKernel.create('Test World');
		const rootScene = kernel.sceneTree.getRootScene()!;
		const childScene = kernel.sceneTree.getChildren(rootScene.id)[0];

		const agent = kernel.createAgent('Alice', childScene.id, false);
		expect(agent.name).toBe('Alice');
		expect(agent.type).toBe('npc');
		expect(agent.sceneId).toBe(childScene.id);

		// Verify component added
		const stats = kernel.entityStore.getComponent(agent.id, 'Stats');
		expect(stats).toBeDefined();
		expect(stats!.health).toBe(100);
		expect(stats!.energy).toBe(100);
	});

	it('should move an agent to a different scene', async () => {
		const kernel = await WorldKernel.create('Test World');
		const rootScene = kernel.sceneTree.getRootScene()!;
		const childScene = kernel.sceneTree.getChildren(rootScene.id)[0];

		// Create another room under root
		const bedroom = kernel.sceneTree.createScene('卧室', 'room', rootScene.id, '安静的卧室');

		const agent = kernel.createAgent('Bob', childScene.id, false);
		expect(agent.sceneId).toBe(childScene.id);

		kernel.moveEntity(agent.id, bedroom.id);

		const moved = kernel.entityStore.getEntity(agent.id);
		expect(moved).toBeDefined();
		expect(moved!.sceneId).toBe(bedroom.id);
	});

	it('should get agent perception', async () => {
		const kernel = await WorldKernel.create('Test World');
		const rootScene = kernel.sceneTree.getRootScene()!;
		const livingRoom = kernel.sceneTree.getChildren(rootScene.id)[0];

		const alice = kernel.createAgent('Alice', livingRoom.id, false);
		const bob = kernel.createAgent('Bob', livingRoom.id, false);

		const perception = kernel.getAgentPerception(alice.id);
		expect(perception.currentScene.id).toBe(livingRoom.id);
		expect(perception.visibleAgents.length).toBe(1);
		expect(perception.visibleAgents[0].name).toBe('Bob');
		expect(perception.selfState.name).toBe('Alice');
	});

	it('should persist and load world state', async () => {
		const kernel = await WorldKernel.create('Persist Test');
		const rootScene = kernel.sceneTree.getRootScene()!;
		const livingRoom = kernel.sceneTree.getChildren(rootScene.id)[0];

		const agent = kernel.createAgent('Charlie', livingRoom.id, true);
		kernel.advanceTime(60);
		await kernel.flush();

		// Load the world
		const loaded = await WorldKernel.load(kernel.worldId);
		expect(loaded.getTime()).toBe(60);

		const loadedAgent = loaded.entityStore.getEntity(agent.id);
		expect(loadedAgent).toBeDefined();
		expect(loadedAgent!.name).toBe('Charlie');
		expect(loadedAgent!.sceneId).toBe(livingRoom.id);
	});

	it('should reject moving to non-existent scene', async () => {
		const kernel = await WorldKernel.create('Test World');
		const rootScene = kernel.sceneTree.getRootScene()!;
		const livingRoom = kernel.sceneTree.getChildren(rootScene.id)[0];

		const agent = kernel.createAgent('Dave', livingRoom.id, false);
		const fakeSceneId = '00000000-0000-0000-0000-000000000000' as UUID;

		expect(() => kernel.moveEntity(agent.id, fakeSceneId)).toThrow('Target scene not found');
	});
});
