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
			currentTime: 0
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

	static async loadFromSnapshot(worldId: UUID, snapshotId: UUID): Promise<WorldKernel> {
		const kernel = new WorldKernel(worldId);
		const snapshot = await kernel.snapshotManager.restore(snapshotId);
		if (!snapshot) {
			throw new Error(`Snapshot not found: ${snapshotId}`);
		}

		// Helper to safely restore a Map from a potentially serialized object
		const restoreMap = <K, V>(input: unknown): Map<K, V> => {
			if (input instanceof Map) {
				return new Map(input);
			}
			if (input && typeof input === 'object') {
				return new Map(Object.entries(input as Record<string, V>)) as unknown as Map<K, V>;
			}
			return new Map<K, V>();
		};

		kernel.currentTime = snapshot.currentTime;
		// Restore scenes
		const scenesMap = restoreMap<UUID, Scene>(snapshot.scenes);
		kernel.sceneTree.restoreFromState({
			scenes: scenesMap,
			dirtyIds: Array.from(scenesMap.keys()) as UUID[]
		});
		// Restore entities
		const entitiesMap = restoreMap<UUID, Entity>(snapshot.entities);
		const componentsMap = restoreMap<UUID, Component[]>(snapshot.components);
		kernel.entityStore.restoreFromState({
			entities: entitiesMap,
			components: componentsMap,
			dirtyIds: Array.from(entitiesMap.keys()) as UUID[],
			dirtyComponentIds: Array.from(componentsMap.keys()) as UUID[]
		});

		await kernel.flush();
		return kernel;
	}

	/** Load a world from DB by ID */
	static async load(worldId: UUID): Promise<WorldKernel> {
		// Verify world exists
		const worldRows = await db.select().from(schema.worlds).where(eq(schema.worlds.id, worldId));
		if (worldRows.length === 0) {
			throw new Error(`World not found: ${worldId}`);
		}
		const worldRow = worldRows[0];

		const kernel = new WorldKernel(worldId);
		// Restore time from DB
		kernel.currentTime = worldRow.currentTime;

		await kernel.entityStore.loadFromDB();
		await kernel.sceneTree.loadFromDB();
		return kernel;
	}

	getTime(): number {
		return this.currentTime;
	}

	advanceTime(seconds: number): void {
		this.currentTime += seconds;

		// Apply natural energy decay for all agents based on elapsed time
		// Base decay: 1 energy per minute of activity
		const energyDecay = Math.floor(seconds / 60);
		if (energyDecay > 0) {
			const agents = this.entityStore.queryByComponent('Stats');
			for (const { entity, component: stats } of agents) {
				if (entity.type === 'player' || entity.type === 'npc') {
					const newEnergy = Math.max(0, stats.energy - energyDecay);
					if (newEnergy !== stats.energy) {
						stats.energy = newEnergy;
						this.entityStore.addComponent(entity.id, stats);
					}
				}
			}
		}

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

	moveEntity(entityId: UUID, targetSceneId: UUID, direction?: string): void {
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
			data: { entityId, fromSceneId, toSceneId: targetSceneId, direction: direction ?? 'unknown' }
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

	interactEntity(agentId: UUID, targetName: string, interaction?: string): void {
		const entity = this.entityStore.getEntity(agentId);
		if (!entity) throw new Error(`Entity not found: ${agentId}`);

		this.dispatch({
			type: 'AGENT_ACTION',
			tickTime: this.currentTime,
			agentId,
			data: { agentId, action: { type: 'INTERACT', target: targetName, content: interaction } }
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
			.set({ 			currentTime: this.currentTime })
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
		if (event.agentId !== null && event.agentId !== undefined) {
			const entity = this.entityStore.getEntity(event.agentId);
			if (!entity) throw new Error(`Event references unknown agent: ${event.agentId}`);
		}
		if (event.tickTime < this.currentTime) {
			throw new Error(
				`Event tickTime ${event.tickTime} is before current world time ${this.currentTime}`
			);
		}
	}

	private applyEvent(event: Omit<WorldEvent, 'id' | 'worldId' | 'createdAt'>): void {
		switch (event.type) {
		case 'SCENE_CHANGE': {
			const { sceneId, updates } = event.data as {
				sceneId: UUID;
				updates: Partial<Scene>;
			};
			const scene = this.sceneTree.getScene(sceneId);
			if (!scene) {
				throw new Error(`SCENE_CHANGE references unknown scene: ${sceneId}`);
			}
			Object.assign(scene, updates);
			this.sceneTree['dirty'].add(sceneId);
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
				// Validate target scene exists and there is an exit from current scene
				const entity = this.entityStore.getEntity(event.agentId);
				if (!entity) {
					throw new Error(`AGENT_ACTION MOVE references unknown entity: ${event.agentId}`);
				}
				const currentScene = this.sceneTree.getScene(entity.sceneId);
				if (!currentScene) {
					throw new Error(`AGENT_ACTION MOVE current scene not found: ${entity.sceneId}`);
				}
				// If target is a direction, resolve to sceneId
				let targetSceneId = action.target;
				const exit = currentScene.exits.find((e) => e.direction === action.target);
				if (exit) {
					targetSceneId = exit.targetSceneId;
				}
				const targetScene = this.sceneTree.getScene(targetSceneId);
				if (!targetScene) {
					throw new Error(`AGENT_ACTION MOVE target scene not found: ${targetSceneId}`);
				}
				const hasExit = currentScene.exits.some((e) => e.targetSceneId === targetSceneId);
				if (!hasExit) {
					throw new Error(
						`AGENT_ACTION MOVE no exit to target scene ${targetSceneId} from ${entity.sceneId}`
					);
				}
				this.moveEntity(event.agentId, targetSceneId, action.target);
			} else if (action.type === 'SPEAK' && event.agentId) {
				// SPEAK already emitted by agentSpeak convenience method; 
				// here we just ensure the speech is recorded in the agent's memory
				const memory = this.entityStore.getComponent(event.agentId, 'Memory');
				if (memory && action.content) {
					memory.shortTerm.push({
						id: crypto.randomUUID(),
						content: `我说: "${action.content}"`,
						timestamp: this.currentTime,
						importance: 4
					});
					// Keep short-term memory bounded
					if (memory.shortTerm.length > 20) {
						memory.shortTerm.shift();
					}
					this.entityStore.addComponent(event.agentId, memory);
				}
			} else if (action.type === 'INTERACT' && event.agentId) {
				// Record interaction in agent's memory
				const memory = this.entityStore.getComponent(event.agentId, 'Memory');
				if (memory && action.target) {
					memory.shortTerm.push({
						id: crypto.randomUUID(),
						content: `我与 ${action.target} 互动${action.content ? ': ' + action.content : ''}`,
						timestamp: this.currentTime,
						importance: 5
					});
					if (memory.shortTerm.length > 20) {
						memory.shortTerm.shift();
					}
					this.entityStore.addComponent(event.agentId, memory);
				}
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

