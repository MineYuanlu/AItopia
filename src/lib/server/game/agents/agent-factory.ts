/**
 * Agent Factory — creates agents from generated data and registers them in the world.
 */
import type { UUID, Component } from '../types';
import type { WorldKernel } from '../world/world-kernel';
import { LLMClient } from '../../llm/client';
import type { GeneratedAgent, AgentGenerationResult } from './agent-generator';
import { AgentGenerator } from './agent-generator';
import { PlayerAgent } from './player-agent';
import { NPCAgent } from './npc-agent';

export class AgentFactory {
	/**
	 * Create a PlayerAgent from generated data and register it in the world.
	 */
	static createPlayer(
		generated: GeneratedAgent,
		worldKernel: WorldKernel,
		sceneId: UUID,
		llm: LLMClient
	): PlayerAgent {
		// 1. Create entity in world
		const entity = worldKernel.createAgent(generated.名称, sceneId, true);
		const addedComponents: Component[] = [];

		try {
			// 2. Add components from generated data
			const components = AgentGenerator.toComponents(generated);
			for (const component of components) {
				worldKernel.entityStore.addComponent(entity.id, component);
				addedComponents.push(component);
			}

			// 3. Create PlayerAgent instance
			return new PlayerAgent({
				id: crypto.randomUUID(),
				entityId: entity.id,
				worldId: worldKernel.worldId,
				kernel: worldKernel,
				name: generated.名称,
				llm
			});
		} catch (error) {
			// Cleanup on failure: remove the created entity and any components we added
			for (const component of addedComponents) {
				try {
					worldKernel.entityStore.removeComponent(entity.id, component.type);
				} catch {
					// Best-effort cleanup
				}
			}
			try {
				worldKernel.entityStore.removeEntity(entity.id);
			} catch {
				// Best-effort cleanup
			}
			throw error;
		}
	}

	/**
	 * Create an NPCAgent from generated data and register it in the world.
	 */
	static createNPC(
		generated: GeneratedAgent,
		worldKernel: WorldKernel,
		sceneId: UUID,
		llm?: LLMClient,
		seed?: number
	): NPCAgent {
		// Similar to createPlayer but creates NPCAgent
		const entity = worldKernel.createAgent(generated.名称, sceneId, false);
		const addedComponents: Component[] = [];

		try {
			const components = AgentGenerator.toComponents(generated);
			for (const component of components) {
				worldKernel.entityStore.addComponent(entity.id, component);
				addedComponents.push(component);
			}

			return new NPCAgent({
				id: crypto.randomUUID(),
				entityId: entity.id,
				worldId: worldKernel.worldId,
				kernel: worldKernel,
				name: generated.名称,
				llm,
				seed
			});
		} catch (error) {
			for (const component of addedComponents) {
				try {
					worldKernel.entityStore.removeComponent(entity.id, component.type);
				} catch {
					// Best-effort cleanup
				}
			}
			try {
				worldKernel.entityStore.removeEntity(entity.id);
			} catch {
				// Best-effort cleanup
			}
			throw error;
		}
	}
}
