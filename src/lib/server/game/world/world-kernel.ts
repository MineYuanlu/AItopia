import { eq } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { EntityStore } from './entity-store';
import { SceneTree } from './scene-tree';
import { EventBus } from '../events/event-bus';
import { SnapshotManager } from '../persistence/snapshot-manager';
import type {
	UUID,
	Entity,
	EntityType,
	WorldEvent,
	Component,
	WorldState,
	AgentPerception,
	StatsComponent,
	MemoryChunk,
	Scene
} from '../types';

/**
 * The central authority for world state.
 * All state changes go through here.
 */
export class WorldKernel {
	readonly worldId: UUID;
	readonly entityStore: EntityStore;
	readonly sceneTree: SceneTree;
	readonly eventBus: EventBus;
	readonly snapshotManager: SnapshotManager;

	private currentTime: number = 0; // Simulation time in seconds
	private isRunning: boolean = false;

	constructor(worldId: UUID) {
		this.worldId = worldId;
		this.entityStore = new EntityStore(worldId);
		this.sceneTree = new SceneTree(worldId);
		this.eventBus = new EventBus(worldId);
		this.snapshotManager = new SnapshotManager(worldId);
	}

	static async create(worldName: string): Promise<WorldKernel> {
		// 1. Create world in DB
		const worldId = crypto.randomUUID();
		await db.insert(schema.worlds).values({
			id: worldId,
			name: worldName,
			currentTime: new Date(0)
		});

		const kernel = new WorldKernel(worldId);

		// 2. Create root scene (e.g. "青河镇")
		const rootScene = kernel.sceneTree.createScene('青河镇', 'town', null, '一个宁静的小镇');

		// 3. Create child scene "幸福小区203/客厅" under root
		kernel.sceneTree.createScene('幸福小区203-客厅', 'room', rootScene.id, '温馨的客厅');

		await kernel.flush();

		// Log world init event via eventBus
		kernel.eventBus.emit({
			type: 'WORLD_INIT',
			tickTime: 0,
			agentId: null,
			data: { worldName, initialSceneIds: [rootScene.id] }
		});

		await kernel.flush();
		return kernel;
	}

	static async load(worldId: UUID): Promise<WorldKernel> {
		// Verify world exists
		const worldRows = await db.select().from(schema.worlds).where(eq(schema.worlds.id, worldId));
		if (worldRows.length === 0) {
			throw new Error(`World not found: ${worldId}`);
		}
		const worldRow = worldRows[0];

		const kernel = new WorldKernel(worldId);
		// Restore time from DB
		kernel.currentTime = Math.floor(worldRow.currentTime.getTime() / 1000);

		await kernel.entityStore.loadFromDB();
		await kernel.sceneTree.loadFromDB();
		return kernel;
	}

	static async loadFromSnapshot(worldId: UUID, snapshotId: UUID): Promise<WorldKernel> {
		const kernel = new WorldKernel(worldId);
		const snapshot = await kernel.snapshotManager.restore(snapshotId);
		if (!snapshot) {
			throw new Error(`Snapshot not found: ${snapshotId}`);
		}

		kernel.currentTime = snapshot.currentTime;
		// Restore scenes
		for (const [id, scene] of snapshot.scenes) {
			kernel.sceneTree['scenes'].set(id, scene as Scene);
			kernel.sceneTree['dirty'].add(id);
		}
		// Restore entities
		for (const [id, entity] of snapshot.entities) {
			kernel.entityStore['entities'].set(id, entity as Entity);
			kernel.entityStore['dirty'].add(id);
		}
		// Restore components
		for (const [id, comps] of snapshot.components) {
			kernel.entityStore['components'].set(id, comps as Component[]);
			kernel.entityStore['dirtyComponents'].add(id);
		}

		await kernel.flush();
		return kernel;
	}

	getTime(): number {
		return this.currentTime;
	}

	advanceTime(seconds: number): void {
		this.currentTime += seconds;
		this.eventBus.emit({
			type: 'TIME_ADVANCE',
			tickTime: this.currentTime,
			agentId: null,
			data: { advancedBy: seconds, newTime: this.currentTime }
		});
	}

	/**
	 * The main dispatch method - ALL state changes go through here.
	 */
	dispatch(event: Omit<WorldEvent, 'id' | 'worldId' | 'createdAt'>): void {
		// 1. Validate the event
		this.validateEvent(event);

		// 2. Apply the event to state
		this.applyEvent(event);

		// 3. Emit via EventBus (handles logging + handlers)
		this.eventBus.emit(event);
	}

	// Convenience methods that build and dispatch events
	createAgent(name: string, sceneId: UUID, isPlayer: boolean = false): Entity {
		// Validate scene exists
		if (!this.sceneTree.getScene(sceneId)) {
			throw new Error(`Scene not found: ${sceneId}`);
		}

		const entityType: EntityType = isPlayer ? 'player' : 'npc';
		const entity = this.entityStore.createEntity(name, entityType, sceneId);

		// Add default Stats component
		const stats: StatsComponent = {
			type: 'Stats',
			energy: 100,
			maxEnergy: 100,
			health: 100,
			maxHealth: 100
		};
		this.entityStore.addComponent(entity.id, stats);

		this.dispatch({
			type: 'ENTITY_CREATED',
			tickTime: this.currentTime,
			agentId: isPlayer ? entity.id : null,
			data: { entityId: entity.id, name, type: entityType, sceneId }
		});

		return entity;
	}

	moveEntity(entityId: UUID, targetSceneId: UUID): void {
		const entity = this.entityStore.getEntity(entityId);
		if (!entity) throw new Error(`Entity not found: ${entityId}`);
		if (!this.sceneTree.getScene(targetSceneId)) {
			throw new Error(`Target scene not found: ${targetSceneId}`);
		}

		const fromSceneId = entity.sceneId;
		this.entityStore.moveEntity(entityId, targetSceneId);

		this.dispatch({
			type: 'MOVE',
			tickTime: this.currentTime,
			agentId: entityId,
			data: { entityId, fromSceneId, toSceneId: targetSceneId, direction: 'unknown' }
		});
	}

	agentSpeak(agentId: UUID, content: string): void {
		const entity = this.entityStore.getEntity(agentId);
		if (!entity) throw new Error(`Entity not found: ${agentId}`);
		if (entity.type !== 'player' && entity.type !== 'npc') {
			throw new Error(`Entity is not an agent: ${agentId}`);
		}

		this.dispatch({
			type: 'SPEAK',
			tickTime: this.currentTime,
			agentId,
			data: { agentId, content }
		});
	}

	/** Get agent's perception of the world */
	getAgentPerception(agentId: UUID): AgentPerception {
		const entity = this.entityStore.getEntity(agentId);
		if (!entity) throw new Error(`Entity not found: ${agentId}`);

		const currentScene = this.sceneTree.getScene(entity.sceneId);
		if (!currentScene) throw new Error(`Scene not found: ${entity.sceneId}`);

		// Find visible entities in the same scene
		const visibleEntities = this.entityStore.queryByScene(entity.sceneId);
		const visibleAgents: { id: UUID; name: string; type: EntityType }[] = [];
		const visibleItems: { id: UUID; name: string }[] = [];

		for (const e of visibleEntities) {
			if (e.id === agentId) continue; // Skip self
			if (e.type === 'player' || e.type === 'npc') {
				visibleAgents.push({ id: e.id, name: e.name, type: e.type });
			} else if (e.type === 'item') {
				visibleItems.push({ id: e.id, name: e.name });
			}
		}

		// Get self stats
		const stats = this.entityStore.getComponent(agentId, 'Stats');
		const defaultStats = {
			type: 'Stats' as const,
			energy: 100,
			maxEnergy: 100,
			health: 100,
			maxHealth: 100
		};

		// Get recent memory chunks (simplified: from events)
		const recentEvents = this.eventBus.getRecentEvents(10);
		const memoryChunks: MemoryChunk[] = recentEvents.map((ev) => ({
			id: crypto.randomUUID(),
			content: `[${ev.type}] ${JSON.stringify(ev.data)}`,
			timestamp: ev.tickTime,
			importance: 5
		}));

		return {
			currentScene,
			visibleAgents,
			visibleItems,
			recentEvents,
			selfState: {
				name: entity.name,
				stats: stats ?? defaultStats,
				memory: memoryChunks
			}
		};
	}

	/** Get full world state for serialization */
	getState(): WorldState {
		return {
			id: this.worldId,
			currentTime: this.currentTime,
			scenes: new Map(this.sceneTree['scenes']),
			entities: new Map(this.entityStore['entities']),
			components: new Map(this.entityStore['components'])
		};
	}

	/** Save a snapshot of the current world state */
	async saveSnapshot(): Promise<import('../persistence/snapshot-manager').Snapshot> {
		const eventCount = await this.eventBus.eventLog.count();
		return this.snapshotManager.save(this.getState(), eventCount);
	}

	/** Flush in-memory buffers to DB */
	async flush(): Promise<void> {
		// Flush scenes
		await this.sceneTree.syncToDB();

		// Flush entities and components
		await this.entityStore.syncToDB();

		// Flush world time
		await db
			.update(schema.worlds)
			.set({ currentTime: new Date(this.currentTime * 1000) })
			.where(eq(schema.worlds.id, this.worldId));

		// Flush events via EventBus
		await this.eventBus.flush();
	}

	/** Flush and trigger auto-snapshot */
	async flushWithAutoSnapshot(interval: number = 100): Promise<void> {
		await this.flush();
		const eventCount = await this.eventBus.eventLog.count();
		await this.snapshotManager.autoSave(this.getState(), eventCount, interval);
	}

	private validateEvent(event: Omit<WorldEvent, 'id' | 'worldId' | 'createdAt'>): void {
		if (!event.type) throw new Error('Event type is required');
		if (event.tickTime < 0) throw new Error('Tick time cannot be negative');
	}

	private applyEvent(event: Omit<WorldEvent, 'id' | 'worldId' | 'createdAt'>): void {
		switch (event.type) {
			case 'SCENE_CHANGE': {
				const { sceneId, updates } = event.data as {
					sceneId: UUID;
					updates: Partial<Scene>;
				};
				const scene = this.sceneTree.getScene(sceneId);
				if (scene) {
					Object.assign(scene, updates);
					this.sceneTree['dirty'].add(sceneId);
				}
				break;
			}
			case 'COMPONENT_ADDED': {
				const { entityId, component } = event.data as {
					entityId: UUID;
					component: Component;
				};
				this.entityStore.addComponent(entityId, component);
				break;
			}
			case 'AGENT_ACTION': {
				const { action } = event.data as {
					action: { type: string; target?: string; content?: string };
				};
				if (action.type === 'MOVE' && action.target && event.agentId) {
					this.entityStore.moveEntity(event.agentId, action.target);
				}
				break;
			}
			case 'ENTITY_CREATED':
			case 'MOVE':
			case 'SPEAK':
			case 'TIME_ADVANCE':
			case 'WORLD_INIT':
			case 'AGENT_DECIDE':
				// These events are handled by their respective convenience methods or don't modify state directly
				break;
			default: {
				const _exhaustive: never = event.type;
				void _exhaustive;
			}
		}
	}
}

