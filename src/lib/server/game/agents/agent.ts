import type { UUID, ActionIntent, AgentPerception } from '../types';
import type { WorldKernel } from '../world/world-kernel';

/**
 * Base Agent class that all agent types extend.
 * Implements the perceive() → decide() → execute() lifecycle.
 */
export abstract class Agent {
	readonly id: UUID;
	readonly entityId: UUID;
	readonly worldId: UUID;
	readonly isPlayer: boolean;
	protected kernel: WorldKernel;
	protected name: string;

	// Recent thoughts (for context in prompts)
	protected recentThoughts: string[] = [];
	protected maxRecentThoughts: number = 5;

	constructor(config: {
		id: UUID;
		entityId: UUID;
		worldId: UUID;
		kernel: WorldKernel;
		name: string;
		isPlayer: boolean;
	}) {
		this.id = config.id;
		this.entityId = config.entityId;
		this.worldId = config.worldId;
		this.kernel = config.kernel;
		this.name = config.name;
		this.isPlayer = config.isPlayer;
	}

	// The main lifecycle method
	async tick(): Promise<ActionIntent | null> {
		// 1. Perceive the world
		const perception = this.perceive();

		// 2. Decide what to do
		const intent = await this.decide(perception);
		if (!intent) return null;

		// 3. Record thought
		this.recentThoughts.push(intent.thought);
		if (this.recentThoughts.length > this.maxRecentThoughts) {
			this.recentThoughts.shift();
		}

		// 4. Execute the action through WorldKernel
		await this.execute(intent);

		return intent;
	}

	// Perceive: build AgentPerception from world state
	perceive(): AgentPerception {
		return this.kernel.getAgentPerception(this.entityId);
	}

	// Decide: abstract - implemented by subclasses
	abstract decide(perception: AgentPerception): Promise<ActionIntent | null>;

	// Execute: apply the action through WorldKernel
	protected async execute(intent: ActionIntent): Promise<void> {
		const { action } = intent;
		let success = true;

		switch (action.type) {
			case 'SPEAK':
				if (action.content) {
					try {
						this.kernel.agentSpeak(this.entityId, action.content);
					} catch (err) {
						console.error(`Agent ${this.name} SPEAK failed:`, err);
						success = false;
					}
				}
				break;
			case 'MOVE':
				if (action.target) {
					try {
						// If target is a direction (not a UUID), resolve it via scene exits
						let targetSceneId = action.target;
						// Attempt to resolve direction to sceneId via kernel's entityStore/sceneTree
						const entityStore = (this.kernel as unknown as Record<string, unknown>)['entityStore'];
						const sceneTree = (this.kernel as unknown as Record<string, unknown>)['sceneTree'];
						if (entityStore && typeof (entityStore as { getEntity: (id: string) => unknown }).getEntity === 'function' &&
						    sceneTree && typeof (sceneTree as { getScene: (id: string) => unknown }).getScene === 'function') {
						const entity = (entityStore as { getEntity: (id: string) => { sceneId: string } | undefined }).getEntity(this.entityId);
						if (entity) {
							const currentScene = (sceneTree as { getScene: (id: string) => { exits: Array<{ direction: string; targetSceneId: string }> } | undefined }).getScene(entity.sceneId);
							if (currentScene && currentScene.exits) {
								const exit = currentScene.exits.find((e) => e.direction === action.target);
								if (exit) {
									targetSceneId = exit.targetSceneId;
								}
							}
						}
					}
					this.kernel.moveEntity(this.entityId, targetSceneId);
				} catch (err) {
					console.error(`Agent ${this.name} MOVE failed:`, err);
					success = false;
				}
			}
			break;
			case 'INTERACT':
				if (action.target) {
					try {
						this.kernel.interactEntity(this.entityId, action.target, action.content);
					} catch (err) {
						console.error(`Agent ${this.name} INTERACT failed:`, err);
						success = false;
					}
				}
				break;
			case 'WAIT':
			case 'THINK':
				// No-op or log internally
				break;
			default:
				console.warn(`Unknown action type: ${(action as Record<string, unknown>).type}`);
				success = false;
		}

		// Dispatch AGENT_ACTION event
		this.kernel.dispatch({
			type: 'AGENT_ACTION',
			tickTime: this.kernel.getTime(),
			agentId: this.entityId,
			data: {
				agentId: this.entityId,
				action: action,
				success
			}
		});
	}

	getName(): string {
		return this.name;
	}
	getEntityId(): UUID {
		return this.entityId;
	}
}
