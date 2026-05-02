import { eq } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import type { UUID, Scene, SceneType, SceneExit, Entity } from '../types';

/**
 * Scene tree management.
 */
export class SceneTree {
	private worldId: UUID;

	// In-memory cache
	private scenes: Map<UUID, Scene> = new Map();
	private dirty: Set<UUID> = new Set();

	constructor(worldId: UUID) {
		this.worldId = worldId;
	}

	async loadFromDB(): Promise<void> {
		const rows = await db
			.select()
			.from(schema.scenes)
			.where(eq(schema.scenes.worldId, this.worldId));

		for (const row of rows) {
			const scene: Scene = {
				id: row.id,
				worldId: row.worldId,
				parentId: row.parentId,
				name: row.name,
				type: row.type as SceneType,
				description: row.description,
				properties: (row.properties ?? {}) as Record<string, unknown>,
				exits: (row.exits ?? []) as SceneExit[]
			};
			this.scenes.set(scene.id, scene);
		}
	}

	createScene(name: string, type: SceneType, parentId: UUID | null = null, description = ''): Scene {
		const scene: Scene = {
			id: crypto.randomUUID(),
			worldId: this.worldId,
			parentId,
			name,
			type,
			description,
			properties: {},
			exits: []
		};
		this.scenes.set(scene.id, scene);
		this.dirty.add(scene.id);
		return scene;
	}

	getScene(id: UUID): Scene | undefined {
		return this.scenes.get(id);
	}

	getScenePath(id: UUID): string {
		const parts: string[] = [];
		let current = this.scenes.get(id);
		while (current) {
			parts.unshift(current.name);
			if (current.parentId) {
				current = this.scenes.get(current.parentId);
			} else {
				break;
			}
		}
		return parts.join('/') || '';
	}

	getRootScene(): Scene | undefined {
		for (const scene of this.scenes.values()) {
			if (scene.parentId === null) {
				return scene;
			}
		}
		return undefined;
	}

	getChildren(parentId: UUID): Scene[] {
		return Array.from(this.scenes.values()).filter((s) => s.parentId === parentId);
	}

	getEntitiesInScene(sceneId: UUID): UUID[] {
		// This method is provided for API completeness.
		// Actual entity-to-scene queries are delegated to EntityStore via caller coordination
		// (WorldKernel passes the entityStore reference when needed).
		return [];
	}

	addExit(sceneId: UUID, exit: SceneExit): void {
		const scene = this.scenes.get(sceneId);
		if (!scene) throw new Error(`Scene not found: ${sceneId}`);
		// Remove existing exit in same direction if any
		scene.exits = scene.exits.filter((e) => e.direction !== exit.direction);
		scene.exits.push(exit);
		this.dirty.add(sceneId);
	}

	async syncToDB(): Promise<void> {
		for (const sceneId of this.dirty) {
			const scene = this.scenes.get(sceneId);
			if (!scene) continue;

			await db
				.insert(schema.scenes)
				.values({
					id: scene.id,
					worldId: scene.worldId,
					parentId: scene.parentId,
					name: scene.name,
					type: scene.type,
					description: scene.description,
					properties: scene.properties,
					exits: scene.exits
				})
				.onConflictDoUpdate({
					target: schema.scenes.id,
					set: {
						parentId: scene.parentId,
						name: scene.name,
						type: scene.type,
						description: scene.description,
						properties: scene.properties,
						exits: scene.exits
					}
				});
		}
		this.dirty.clear();
	}
}
