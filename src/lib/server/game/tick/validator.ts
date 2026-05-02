import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import type { UUID } from '../types';

/** Minimal interface for EntityStore dependencies needed by Validator. */
export interface EntityStoreLike {
	getEntity(id: UUID): { id: UUID; type: string; sceneId: UUID; name: string } | undefined;
	getComponent(id: UUID, type: 'Stats'): { energy: number } | undefined;
}

/** Minimal interface for SceneTree dependencies needed by Validator. */
export interface SceneTreeLike {
	getScene(id: UUID): { id: UUID; name: string; exits: Array<{ direction: string; targetSceneId: UUID }> } | undefined;
}

export interface ValidationResult {
	valid: boolean;
	reason?: string;
}

export interface ActionIntent {
	action: {
		type: 'SPEAK' | 'MOVE' | 'INTERACT' | 'WAIT' | 'THINK';
		target?: string;
		content?: string;
	};
}

export class Validator {
	private entityStore: EntityStoreLike;
	private sceneTree: SceneTreeLike;

	constructor(entityStore: EntityStoreLike, sceneTree: SceneTreeLike) {
		this.entityStore = entityStore;
		this.sceneTree = sceneTree;
	}

	// Validate an action intent before execution
	validateAction(agentId: UUID, action: ActionIntent['action']): ValidationResult {
		// Check: does agent exist?
		const entity = this.entityStore.getEntity(agentId);
		if (!entity) {
			return { valid: false, reason: `Agent not found: ${agentId}` };
		}

		// Check: is agent an agent type (player or npc)?
		if (entity.type !== 'player' && entity.type !== 'npc') {
			return { valid: false, reason: `Entity is not an agent: ${entity.type}` };
		}

		// Action-specific validation
		switch (action.type) {
			case 'SPEAK': {
				// Check: can they speak (are they conscious?)
				const stats = this.entityStore.getComponent(agentId, 'Stats');
				if (stats && (!Number.isFinite(stats.energy) || stats.energy <= 0)) {
					return { valid: false, reason: 'Agent is unconscious (energy depleted)' };
				}

				// Check: is target valid?
				if (action.target) {
					const targetResult = this.canCommunicate(agentId, action.target as UUID);
					if (!targetResult.valid) {
						return targetResult;
					}
				}

				return { valid: true };
			}

			case 'MOVE': {
				// Check: can they move (is there an exit in that direction?)
				if (!action.target) {
					return { valid: false, reason: 'Move action requires a target direction or scene' };
				}
				return this.canMove(agentId, action.target);
			}

			case 'INTERACT': {
				// Simple MVP validation
				return { valid: true };
			}

			case 'WAIT':
			case 'THINK': {
				// Always valid for MVP
				return { valid: true };
			}

			default: {
				return { valid: false, reason: `Unknown action type: ${(action as { type: string }).type}` };
			}
		}
	}

	// Check if an agent can see/speak to another
	canCommunicate(agentId: UUID, targetId: UUID): ValidationResult {
		const agent = this.entityStore.getEntity(agentId);
		if (!agent) {
			return { valid: false, reason: `Agent not found: ${agentId}` };
		}

		const target = this.entityStore.getEntity(targetId);
		if (!target) {
			return { valid: false, reason: `Target not found: ${targetId}` };
		}

		// For MVP: agents can communicate if they are in the same scene
		if (agent.sceneId !== target.sceneId) {
			return {
				valid: false,
				reason: `Agents are not in the same scene. Agent: ${agent.sceneId}, Target: ${target.sceneId}`
			};
		}

		// Check if agent is conscious
		const stats = this.entityStore.getComponent(agentId, 'Stats');
		if (stats && (!Number.isFinite(stats.energy) || stats.energy <= 0)) {
			return { valid: false, reason: 'Agent is unconscious (energy depleted)' };
		}

		return { valid: true };
	}

	// Check if scene transition is valid
	canMove(entityId: UUID, direction: string): ValidationResult {
		const entity = this.entityStore.getEntity(entityId);
		if (!entity) {
			return { valid: false, reason: `Entity not found: ${entityId}` };
		}

		const currentScene = this.sceneTree.getScene(entity.sceneId);
		if (!currentScene) {
			return { valid: false, reason: `Current scene not found: ${entity.sceneId}` };
		}

		// Check if there's an exit in that direction
		const exit = currentScene.exits?.find((e) => e.direction === direction);
		if (!exit) {
			return {
				valid: false,
				reason: `No exit in direction "${direction}" from scene "${currentScene.name}"`
			};
		}

		// Check if target scene exists
		const targetScene = this.sceneTree.getScene(exit.targetSceneId);
		if (!targetScene) {
			return { valid: false, reason: `Target scene not found: ${exit.targetSceneId}` };
		}

		// Check if entity has energy to move
		const stats = this.entityStore.getComponent(entityId, 'Stats');
		if (stats && (!Number.isFinite(stats.energy) || stats.energy <= 0)) {
			return { valid: false, reason: 'Entity is exhausted (energy depleted)' };
		}

		return { valid: true };
	}
}
