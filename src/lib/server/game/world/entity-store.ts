import { eq, inArray, and } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import type {
	UUID,
	Entity,
	EntityType,
	Component,
	ComponentMap,
	PositionComponent,
	StatsComponent,
	InventoryComponent,
	PersonalityComponent,
	MemoryComponent,
	RelationComponent,
	PerceptionComponent,
} from '../types';

/**
 * ECS Entity/Component storage.
 * In-memory operations backed by SQLite (via Drizzle).
 */
export class EntityStore {
	private worldId: UUID;

	// In-memory cache for fast access during tick
	private entities: Map<UUID, Entity> = new Map();
	private components: Map<UUID, Component[]> = new Map();
	private dirty: Set<UUID> = new Set(); // entities that need DB sync
	private dirtyComponents: Set<UUID> = new Set(); // entities whose components need DB sync

	constructor(worldId: UUID) {
		this.worldId = worldId;
	}

	async loadFromDB(): Promise<void> {
		// Load all entities for this world
		const rows = await db.select().from(schema.entities).where(eq(schema.entities.worldId, this.worldId));

		for (const row of rows) {
			const entity: Entity = {
				id: row.id,
				worldId: row.worldId,
				sceneId: row.sceneId,
				name: row.name,
				type: row.type as EntityType,
			};
			this.entities.set(entity.id, entity);
		}

		// Re-query properly: get components by entity IDs
		const entityIds = rows.map((r) => r.id);
		if (entityIds.length > 0) {
			const compRows = await db.select().from(schema.components).where(inArray(schema.components.entityId, entityIds));

			for (const row of compRows) {
				const comp = this.deserializeComponent(row.type, row.data);
				if (!comp) continue;
				const list = this.components.get(row.entityId) ?? [];
				list.push(comp);
				this.components.set(row.entityId, list);
			}
		}
	}

	createEntity(name: string, type: EntityType, sceneId: UUID): Entity {
		const entity: Entity = {
			id: crypto.randomUUID(),
			worldId: this.worldId,
			sceneId,
			name,
			type,
		};
		this.entities.set(entity.id, entity);
		this.components.set(entity.id, []);
		this.dirty.add(entity.id);
		this.dirtyComponents.add(entity.id);
		return entity;
	}

	getEntity(id: UUID): Entity | undefined {
		return this.entities.get(id);
	}

	removeEntity(id: UUID): void {
		this.entities.delete(id);
		this.components.delete(id);
		this.dirty.delete(id);
		this.dirtyComponents.delete(id);
		// Also remove from DB (if already synced)
		db.delete(schema.entities)
			.where(eq(schema.entities.id, id))
			.catch(() => {
				// Best-effort DB cleanup, ignore errors
			});
	}

	moveEntity(entityId: UUID, targetSceneId: UUID): void {
		const entity = this.entities.get(entityId);
		if (!entity) throw new Error(`Entity not found: ${entityId}`);
		entity.sceneId = targetSceneId;
		this.dirty.add(entityId);

		// Also update Position component if present
		const pos = this.getComponent(entityId, 'Position');
		if (pos) {
			pos.sceneId = targetSceneId;
			this.dirtyComponents.add(entityId);
		}
	}

	addComponent(entityId: UUID, component: Component): void {
		if (!this.entities.has(entityId)) throw new Error(`Entity not found: ${entityId}`);
		const list = this.components.get(entityId) ?? [];
		// Remove existing component of same type
		const filtered = list.filter((c) => c.type !== component.type);
		filtered.push(component);
		this.components.set(entityId, filtered);
		this.dirtyComponents.add(entityId);
	}

	getComponent<K extends keyof ComponentMap>(entityId: UUID, type: K): ComponentMap[K] | undefined {
		const list = this.components.get(entityId);
		if (!list) return undefined;
		return list.find((c) => c.type === type) as ComponentMap[K] | undefined;
	}

	getComponents(entityId: UUID): Component[] {
		return this.components.get(entityId) ?? [];
	}

	/** Restore internal state from a snapshot */
	restoreFromState(state: {
		entities: Map<UUID, Entity>;
		components: Map<UUID, Component[]>;
		dirtyIds?: UUID[];
		dirtyComponentIds?: UUID[];
	}): void {
		this.entities = new Map(state.entities);
		this.components = new Map(state.components);
		if (state.dirtyIds) {
			for (const id of state.dirtyIds) {
				this.dirty.add(id);
			}
		}
		if (state.dirtyComponentIds) {
			for (const id of state.dirtyComponentIds) {
				this.dirtyComponents.add(id);
			}
		}
	}

	removeComponent(entityId: UUID, type: string): void {
		const list = this.components.get(entityId);
		if (!list) return;
		const filtered = list.filter((c) => c.type !== type);
		if (filtered.length !== list.length) {
			this.components.set(entityId, filtered);
			this.dirtyComponents.add(entityId);
		}
	}

	queryByScene(sceneId: UUID): Entity[] {
		return Array.from(this.entities.values()).filter((e) => e.sceneId === sceneId);
	}

	queryByComponent<K extends keyof ComponentMap>(type: K): Array<{ entity: Entity; component: ComponentMap[K] }> {
		const results: Array<{ entity: Entity; component: ComponentMap[K] }> = [];
		for (const [entityId, list] of this.components) {
			const comp = list.find((c) => c.type === type) as ComponentMap[K] | undefined;
			if (comp) {
				const entity = this.entities.get(entityId);
				if (entity) {
					results.push({ entity, component: comp });
				}
			}
		}
		return results;
	}

	async syncToDB(): Promise<void> {
		// better-sqlite3 requires synchronous transaction callbacks
		db.transaction((tx) => {
			// Sync dirty entities
			for (const entityId of this.dirty) {
				const entity = this.entities.get(entityId);
				if (!entity) continue;

				// Upsert entity
				tx.insert(schema.entities)
					.values({
						id: entity.id,
						worldId: entity.worldId,
						sceneId: entity.sceneId,
						name: entity.name,
						type: entity.type,
					})
					.onConflictDoUpdate({
						target: schema.entities.id,
						set: {
							sceneId: entity.sceneId,
							name: entity.name,
							type: entity.type,
						},
					})
					.run();
			}

			// Sync dirty components: delete all, then re-insert
			for (const entityId of this.dirtyComponents) {
				const list = this.components.get(entityId);
				// Delete existing components for this entity
				tx.delete(schema.components).where(eq(schema.components.entityId, entityId)).run();
				if (list && list.length > 0) {
					for (const comp of list) {
						const serialized = this.serializeComponent(comp);
						tx.insert(schema.components)
							.values({
								id: crypto.randomUUID(),
								entityId,
								type: comp.type,
								data: serialized,
							})
							.run();
					}
				}
			}
		});

		this.dirty.clear();
		this.dirtyComponents.clear();
	}

	private deserializeComponent(type: string, data: unknown): Component | null {
		if (!data || typeof data !== 'object') {
			console.warn(`deserializeComponent: invalid data for type ${type}`);
			return null;
		}
		// Basic structural validation
		const d = data as Component;
		if (!('type' in d) || d.type !== type) {
			console.warn(`deserializeComponent: type mismatch (expected ${type}, got ${d.type})`);
			return null;
		}
		switch (d.type) {
			case 'Position':
				if (!('sceneId' in d)) return null;
				return d;
			case 'Stats':
				if (!('energy' in d) || !('health' in d)) return null;
				return d;
			case 'Inventory':
				if (!('items' in d)) return null;
				return d;
			case 'Personality':
				if (!('traits' in d)) return null;
				return d;
			case 'Memory':
				if (!('chunks' in d)) return null;
				return d;
			case 'Relation':
				if (!('relations' in d)) return null;
				return d;
			case 'Perception':
				if (!('visibleEntities' in d)) return null;
				return d;
			default:
				return null;
		}
	}

	private serializeComponent(component: Component): unknown {
		// Components are stored as-is (JSON)
		return component;
	}
}
