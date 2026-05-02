/**
 * Player Agent — fully LLM-driven decision making.
 */
import type { UUID, AgentPerception, ActionIntent } from '../types';
import type { WorldKernel } from '../world/world-kernel';
import { LLMClient, type LLMRequest } from '../../llm/client';
import { PromptBuilder } from '../../llm/prompt-builder';
import { Agent } from './agent';

export class PlayerAgent extends Agent {
	private llm: LLMClient;
	private promptBuilder: typeof PromptBuilder;

	constructor(config: {
		id: UUID;
		entityId: UUID;
		worldId: UUID;
		kernel: WorldKernel;
		name: string;
		llm: LLMClient;
	}) {
		super({ ...config, isPlayer: true });
		this.llm = config.llm;
		this.promptBuilder = PromptBuilder;
	}

	async decide(perception: AgentPerception): Promise<ActionIntent | null> {
		// Build prompt with perception + recent thoughts
		const request = this.promptBuilder.buildAgentDecisionPrompt(
			this.name,
			perception,
			this.recentThoughts
		);

		try {
			// Call LLM
			const { data, response } = await this.llm.chatJSON<ActionIntent>(request);

			// Validate and sanitize the response
			if (!data.thought || !data.action || typeof data.timeAdvanceSeconds !== 'number') {
				throw new Error('Invalid ActionIntent from LLM: missing required fields');
			}

			// Clamp timeAdvanceSeconds to sane range [0, 3600]
			const timeAdvanceSeconds = Math.max(0, Math.min(data.timeAdvanceSeconds, 3600));

			// Validate action.type is one of the allowed actions
			const validActions = ['SPEAK', 'MOVE', 'WAIT', 'THINK'];
			if (!validActions.includes(data.action.type)) {
				throw new Error(`Invalid action type from LLM: ${data.action.type}`);
			}

			return {
				thought: String(data.thought),
				action: {
					type: data.action.type as 'SPEAK' | 'MOVE' | 'WAIT' | 'THINK',
					target: data.action.target !== undefined ? String(data.action.target) : undefined,
					content: data.action.content !== undefined ? String(data.action.content) : undefined
				},
				timeAdvanceSeconds
			};
		} catch (error) {
			console.error(`PlayerAgent ${this.name} decision failed:`, error);
			// Fallback: just wait
			return {
				thought: '我暂时不知道该做什么...',
				action: { type: 'WAIT' },
				timeAdvanceSeconds: 60
			};
		}
	}
}
