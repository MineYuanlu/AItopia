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
		this.execute(intent);

		return intent;
	}

	// Perceive: build AgentPerception from world state
	perceive(): AgentPerception {
		return this.kernel.getAgentPerception(this.entityId);
	}

	// Decide: abstract - implemented by subclasses
	abstract decide(perception: AgentPerception): Promise<ActionIntent | null>;

	// Execute: apply the action through WorldKernel
	protected execute(intent: ActionIntent): void {
		const { action } = intent;

		switch (action.type) {
			case 'SPEAK':
				if (action.content) {
					this.kernel.agentSpeak(this.entityId, action.content);
				}
				break;
			case 'MOVE':
				if (action.target) {
					// For MVP, target is a sceneId directly
					this.kernel.moveEntity(this.entityId, action.target);
				}
				break;
			case 'WAIT':
			case 'THINK':
				// No-op or log internally
				break;
			default:
				console.warn(`Unknown action type: ${(action as Record<string, unknown>).type}`);
		}

		// Dispatch AGENT_ACTION event
		this.kernel.dispatch({
			type: 'AGENT_ACTION',
			tickTime: this.kernel.getTime(),
			agentId: this.entityId,
			data: {
				agentId: this.entityId,
				action: action,
				success: true
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
