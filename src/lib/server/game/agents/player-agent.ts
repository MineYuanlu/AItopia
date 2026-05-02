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

			// Validate the response has required fields
			if (!data.thought || !data.action || typeof data.timeAdvanceSeconds !== 'number') {
				throw new Error('Invalid ActionIntent from LLM: missing required fields');
			}

			return data;
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
