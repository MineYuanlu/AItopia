/**
 * NPC Agent — rule-based behavior with optional LLM triggers.
 * For MVP, mostly rules-based with a small chance of LLM usage.
 */
import type { UUID, AgentPerception, ActionIntent } from '../types';
import type { WorldKernel } from '../world/world-kernel';
import { LLMClient } from '../../llm/client';
import { PromptBuilder } from '../../llm/prompt-builder';
import { Agent } from './agent';

export class NPCAgent extends Agent {
	// Simple rule-based behavior
	private behaviors: Array<{
		weight: number;
		action: () => ActionIntent;
	}> = [];

	private llm?: LLMClient; // Optional - for future use
	private llmTriggerChance: number = 0.1; // 10% chance to use LLM per decision
	private rng: () => number; // Random number generator

	constructor(config: {
		id: UUID;
		entityId: UUID;
		worldId: UUID;
		kernel: WorldKernel;
		name: string;
		llm?: LLMClient;
		llmTriggerChance?: number;
		seed?: number;
	}) {
		super({ ...config, isPlayer: false });
		this.llm = config.llm;
		this.llmTriggerChance = config.llmTriggerChance ?? 0.1;
		this.rng =
			config.seed !== undefined ? seededRandom(config.seed) : () => Math.random();

		this.initBehaviors();
	}

	private initBehaviors(): void {
		// Define simple rule behaviors
		this.behaviors = [
			{
				weight: 0.4,
				action: () => ({
					thought: `${this.name} 正在观察周围...`,
					action: { type: 'WAIT' },
					timeAdvanceSeconds: 120
				})
			},
			{
				weight: 0.3,
				action: () => {
					// Pick a random greeting or observation
					const phrases = [
						'今天天气不错。',
						'这个房间挺舒服的。',
						'有人吗？',
						'我在想要不要整理一下东西。',
						'搬进来真累啊。'
					];
					const phrase = phrases[Math.floor(this.rng() * phrases.length)];
					return {
						thought: `${this.name} 想说点什么。`,
						action: { type: 'SPEAK', content: phrase },
						timeAdvanceSeconds: 60
					};
				}
			},
			{
				weight: 0.2,
				action: () => ({
					thought: `${this.name} 正在思考一些事情。`,
					action: { type: 'THINK', content: '我在想新家的事情...' },
					timeAdvanceSeconds: 180
				})
			},
			{
				weight: 0.1,
				action: () => {
					// Try to move (if there are exits)
					// For MVP, target is a sceneId or direction string
					const dirs = ['north', 'south', 'east', 'west'];
					const dir = dirs[Math.floor(this.rng() * dirs.length)];
					return {
						thought: `${this.name} 想要到处看看。`,
						action: { type: 'MOVE', target: dir },
						timeAdvanceSeconds: 300
					};
				}
			}
		];
	}

	/** Adjust behavior weights dynamically based on perception. */
	private getWeightedBehaviors(perception: AgentPerception): Array<{ weight: number; action: () => ActionIntent }> {
		// If other agents are present, increase SPEAK weight to encourage social interaction
		const hasOtherAgents = perception.visibleAgents.length > 0;
		return this.behaviors.map((b, idx) => {
			// SPEAK is the second behavior (index 1)
			if (hasOtherAgents && idx === 1) {
				return { ...b, weight: b.weight * 1.5 };
			}
			return b;
		});
	}

	async decide(perception: AgentPerception): Promise<ActionIntent | null> {
		// For MVP: mostly rule-based
		// Future: if llm exists and rng < llmTriggerChance, use LLM

		if (this.llm && this.rng() < this.llmTriggerChance) {
			// Use LLM for this decision
			try {
				const request = PromptBuilder.buildAgentDecisionPrompt(
					this.name,
					perception,
					this.recentThoughts
				);
				const { data } = await this.llm.chatJSON<ActionIntent>(request);
				if (data.thought && data.action) {
					return data;
				}
			} catch (error) {
				console.warn(`NPCAgent ${this.name} LLM decision failed, falling back to rules`);
			}
		}

		// Rule-based decision
		return this.selectWeightedBehavior(perception);
	}

	private selectWeightedBehavior(perception: AgentPerception): ActionIntent {
		const behaviors = this.getWeightedBehaviors(perception);
		const totalWeight = behaviors.reduce((sum, b) => sum + b.weight, 0);
		let random = this.rng() * totalWeight;

		for (const behavior of behaviors) {
			random -= behavior.weight;
			if (random <= 0) {
				return behavior.action();
			}
		}

		return behaviors[behaviors.length - 1].action();
	}
}

// Simple seeded random generator
function seededRandom(seed: number): () => number {
	let s = seed;
	if (s === 0) s = 1;
	return () => {
		s = (s * 16807 + 0) % 2147483647;
		return (s - 1) / 2147483646;
	};
}
