/**
 * Agent generator — uses LLM to create characters with rich personalities.
 */
import { LLMClient } from '../../llm/client';
import { PromptBuilder } from '../../llm/prompt-builder';
import type { Component, StatsComponent, PersonalityComponent, MemoryComponent, RelationComponent } from '../../game/types';

export interface GeneratedAgent {
	名称: string;
	性别: string;
	生日: string;
	身高: number;
	体重: number;
	智商: number;
	体力: number;
	智慧: number;
	幸运: number;
	性格: string[];
	职业: string;
	爱好: string[];
	技能: string[];
	身世: string;
	大记忆: string[];
	小记忆: string[];
	情绪: string;
	关系: Array<{
		name: string;
		rel: string;
		desc: string;
		stat: string;
	}>;
}

export interface AgentGenerationResult {
	think: string;
	result: GeneratedAgent[];
	desc: string;
}

export class AgentGenerator {
	private llm: LLMClient;

	constructor(llm?: LLMClient) {
		this.llm = llm ?? new LLMClient();
	}

	/**
	 * Generate [count] agents with random personalities.
	 *
	 * @param count   Number of agents to generate (default 3)
	 * @param context Narrative context (default: roommates)
	 */
	async generateAgents(
		count: number = 3,
		context?: string
	): Promise<GeneratedAgent[]> {
		const request = PromptBuilder.buildAgentGenerationPrompt(count, context);

		let resultData: AgentGenerationResult;
		try {
			const { data } = await this.llm.chatJSON<AgentGenerationResult>(request);
			resultData = data;
		} catch (err) {
			throw new Error(
				`Agent generation failed: ${err instanceof Error ? err.message : String(err)}\n` +
					`Context: count=${count}, context=${context ?? 'default'}`
			);
		}

		if (!Array.isArray(resultData.result)) {
			throw new Error(
				`Agent generation returned invalid result structure: ` +
					`expected "result" to be an array, got ${typeof resultData.result}`
			);
		}

		if (resultData.result.length !== count) {
			console.warn(
				`Agent generation returned ${resultData.result.length} agents ` +
					`instead of requested ${count}. Using what we got.`
			);
		}

		return resultData.result;
	}

	/**
	 * Convert a GeneratedAgent (Chinese field names) into ECS components.
	 */
	static toComponents(agent: GeneratedAgent): Component[] {
		const components: Component[] = [];

		// 1. StatsComponent — 体力/生命映射到 energy/health
		const stats: StatsComponent = {
			type: 'Stats',
			energy: agent.体力 ?? 50,
			maxEnergy: 100,
			health: 100,
			maxHealth: 100
		};
		components.push(stats);

		// 2. PersonalityComponent — 性格、身世、职业等
		// 将性格词条映射为 traits 分数（简单规则：每个词条=50分）
		const traits: Record<string, number> = {};
		for (const trait of agent.性格 ?? []) {
			traits[trait] = 50;
		}

		const voiceParts: string[] = [];
		if (agent.职业) voiceParts.push(`职业: ${agent.职业}`);
		if (agent.情绪) voiceParts.push(`情绪: ${agent.情绪}`);
		if (agent.爱好?.length) voiceParts.push(`爱好: ${agent.爱好.join('、')}`);
		if (agent.技能?.length) voiceParts.push(`技能: ${agent.技能.join('、')}`);

		const personality: PersonalityComponent = {
			type: 'Personality',
			traits,
			voice: voiceParts.join('; '),
			background: agent.身世 ?? ''
		};
		components.push(personality);

		// 3. MemoryComponent — 大记忆 -> longTerm，小记忆 -> shortTerm
		const now = Date.now();
		const longTerm = (agent.大记忆 ?? []).map((content) => ({
			id: crypto.randomUUID(),
			content,
			timestamp: now,
			importance: 8
		}));
		const shortTerm = (agent.小记忆 ?? []).map((content) => ({
			id: crypto.randomUUID(),
			content,
			timestamp: now,
			importance: 4
		}));

		const memory: MemoryComponent = {
			type: 'Memory',
			shortTerm,
			longTerm
		};
		components.push(memory);

		// 4. RelationComponent — 关系映射
		if (agent.关系 && agent.关系.length > 0) {
			const relation: RelationComponent = {
				type: 'Relation',
				targets: agent.关系.map((rel) => ({
					targetId: rel.name, // Will be resolved to actual UUID later
					relationType: rel.rel,
					description: rel.desc,
					status: rel.stat,
					affinity: 50 // Default neutral affinity
				}))
			};
			components.push(relation);
		}

		return components;
	}
}
