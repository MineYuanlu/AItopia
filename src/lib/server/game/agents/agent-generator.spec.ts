import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentGenerator } from './agent-generator';
import type { Component } from '../../game/types';

// Create a mock LLMClient inline
function createMockLLMClient() {
	return {
		chatJSON: vi.fn()
	} as unknown as import('../../llm/client').LLMClient;
}

describe('AgentGenerator', () => {
	let mockChatJSON: ReturnType<typeof vi.fn>;
	let generator: AgentGenerator;

	beforeEach(() => {
		vi.clearAllMocks();
		const client = createMockLLMClient();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		mockChatJSON = (client as any).chatJSON;
		generator = new AgentGenerator(client);
	});

	describe('generateAgents', () => {
		it('should generate agents successfully', async () => {
			const mockAgents = [
				createMockAgent('张三'),
				createMockAgent('李四'),
				createMockAgent('王五')
			];

			mockChatJSON.mockResolvedValueOnce({
				data: {
					think: 'Testing agent generation',
					result: mockAgents,
					desc: 'Generated 3 diverse roommates'
				},
				response: {
					content: JSON.stringify({ think: '', result: mockAgents, desc: '' }),
					usage: { promptTokens: 100, completionTokens: 500, totalTokens: 600 },
					model: 'Kimi-K2.6',
					latency: 2000
				}
			});

			const agents = await generator.generateAgents(3, '合租公寓测试');

			expect(agents).toHaveLength(3);
			expect(agents[0].名称).toBe('张三');
			expect(agents[1].名称).toBe('李四');
			expect(agents[2].名称).toBe('王五');
			expect(mockChatJSON).toHaveBeenCalledTimes(1);
		});

		it('should use default count and context', async () => {
			mockChatJSON.mockResolvedValueOnce({
				data: {
					think: '',
					result: [createMockAgent('A'), createMockAgent('B'), createMockAgent('C')],
					desc: ''
				},
				response: {
					content: '',
					usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
					model: 'Kimi-K2.6',
					latency: 100
				}
			});

			await generator.generateAgents();

			const callArg = mockChatJSON.mock.calls[0][0];
			expect(callArg.temperature).toBe(2);
			expect(callArg.responseFormat).toEqual({ type: 'json_object' });
		});

		it('should throw on LLM failure', async () => {
			mockChatJSON.mockRejectedValueOnce(new Error('Network timeout'));

			await expect(generator.generateAgents(2)).rejects.toThrow('Agent generation failed');
		});

		it('should throw on invalid result structure', async () => {
			mockChatJSON.mockResolvedValueOnce({
				data: {
					think: 'bad',
					result: 'not-an-array',
					desc: 'oops'
				},
				response: {
					content: '',
					usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
					model: 'Kimi-K2.6',
					latency: 100
				}
			});

			await expect(generator.generateAgents(2)).rejects.toThrow(
				'expected "result" to be an array'
			);
		});

		it('should warn but not throw when returning fewer agents than requested', async () => {
			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			mockChatJSON.mockResolvedValueOnce({
				data: {
					think: '',
					result: [createMockAgent('Only')],
					desc: ''
				},
				response: {
					content: '',
					usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
					model: 'Kimi-K2.6',
					latency: 100
				}
			});

			const agents = await generator.generateAgents(5);

			expect(agents).toHaveLength(1);
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('instead of requested 5')
			);

			consoleWarnSpy.mockRestore();
		});
	});

	describe('toComponents', () => {
		it('should convert a generated agent to ECS components', () => {
			const agent = createMockAgent('测试');
			const components = AgentGenerator.toComponents(agent);

			// Should have Stats, Personality, Memory components
			const stats = components.find((c) => c.type === 'Stats');
			const personality = components.find((c) => c.type === 'Personality');
			const memory = components.find((c) => c.type === 'Memory');
			const relation = components.find((c) => c.type === 'Relation');

			expect(stats).toBeDefined();
			expect(personality).toBeDefined();
			expect(memory).toBeDefined();
			expect(relation).toBeDefined();

			// Stats
			if (stats?.type === 'Stats') {
				expect(stats.energy).toBe(80);
				expect(stats.maxEnergy).toBe(100);
				expect(stats.health).toBe(100);
				expect(stats.maxHealth).toBe(100);
			}

			// Personality
			if (personality?.type === 'Personality') {
				expect(personality.traits).toEqual({ 开朗: 50, 细心: 50 });
				expect(personality.background).toBe('测试身世');
				expect(personality.voice).toContain('程序员');
				expect(personality.voice).toContain('平静');
			}

			// Memory
			if (memory?.type === 'Memory') {
				expect(memory.longTerm).toHaveLength(1);
				expect(memory.longTerm[0].content).toBe('大学毕业');
				expect(memory.longTerm[0].importance).toBe(8);
				expect(memory.shortTerm).toHaveLength(1);
				expect(memory.shortTerm[0].content).toBe('今天搬家');
				expect(memory.shortTerm[0].importance).toBe(4);
			}

			// Relation
			if (relation?.type === 'Relation') {
				expect(relation.targets).toHaveLength(1);
				expect(relation.targets[0].targetId).toBe('李四');
				expect(relation.targets[0].relationType).toBe('好友');
				expect(relation.targets[0].affinity).toBe(50);
			}
		});

		it('should handle agents with no relations', () => {
			const agent = createMockAgent('无关系人');
			agent.关系 = [];

			const components = AgentGenerator.toComponents(agent);
			const relation = components.find((c) => c.type === 'Relation');

			expect(relation).toBeUndefined();
		});

		it('should handle agents with empty arrays', () => {
			const agent = createMockAgent('极简');
			agent.性格 = [];
			agent.爱好 = [];
			agent.技能 = [];
			agent.大记忆 = [];
			agent.小记忆 = [];
			agent.关系 = [];

			const components = AgentGenerator.toComponents(agent);

			const personality = components.find((c: Component) => c.type === 'Personality');
			if (personality?.type === 'Personality') {
				expect(Object.keys(personality.traits)).toHaveLength(0);
			}

			const memory = components.find((c: Component) => c.type === 'Memory');
			if (memory?.type === 'Memory') {
				expect(memory.longTerm).toHaveLength(0);
				expect(memory.shortTerm).toHaveLength(0);
			}
		});

		it('should handle missing optional fields gracefully', () => {
			const minimalAgent = {
				名称: '极简',
				性别: '男',
				生日: '2000-01-01',
				身高: 170,
				体重: 65,
				智商: 80,
				体力: 60,
				智慧: 70,
				幸运: 50,
				性格: [],
				职业: '',
				爱好: [],
				技能: [],
				身世: '',
				大记忆: [],
				小记忆: [],
				情绪: '',
				关系: []
			};

			const components = AgentGenerator.toComponents(minimalAgent);
			expect(components).toHaveLength(3); // Stats, Personality, Memory (no Relation)
		});
	});
});

function createMockAgent(name: string) {
	return {
		名称: name,
		性别: '男',
		生日: '1998-05-20',
		身高: 175,
		体重: 70,
		智商: 85,
		体力: 80,
		智慧: 75,
		幸运: 60,
		性格: ['开朗', '细心'],
		职业: '程序员',
		爱好: ['编程', '游戏'],
		技能: ['JavaScript', '设计'],
		身世: '测试身世',
		大记忆: ['大学毕业'],
		小记忆: ['今天搬家'],
		情绪: '平静',
		关系: [
			{
				name: '李四',
				rel: '好友',
				desc: '大学同学',
				stat: '一起合租'
			}
		]
	};
}
