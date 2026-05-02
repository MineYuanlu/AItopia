import { describe, it, expect } from 'vitest';
import { PromptBuilder } from './prompt-builder';
import type { AgentPerception, Scene, StatsComponent } from '../game/types';

describe('PromptBuilder', () => {
	describe('buildAgentGenerationPrompt', () => {
		it('should return a valid LLMRequest with correct defaults', () => {
			const prompt = PromptBuilder.buildAgentGenerationPrompt();

			expect(prompt.temperature).toBe(2);
			expect(prompt.responseFormat).toEqual({ type: 'json_object' });
			expect(prompt.messages).toHaveLength(2);
			expect(prompt.messages[0].role).toBe('system');
			expect(prompt.messages[1].role).toBe('user');

			const systemContent = prompt.messages[0].content;
			expect(systemContent).toContain('《模拟人生》');
			expect(systemContent).toContain('[3套]');
			expect(systemContent).toContain('刚搬入合租公寓的年轻人');
			expect(systemContent).toContain('搬入新的合租房间');
			expect(systemContent).toContain('字段: 名称');
			expect(systemContent).toContain('字段: 性格');
			expect(systemContent).toContain('字段: 关系');
		});

		it('should allow customizing count and context', () => {
			const prompt = PromptBuilder.buildAgentGenerationPrompt(5, '大学宿舍新生');

			expect(prompt.messages[0].content).toContain('[5套]');
			expect(prompt.messages[0].content).toContain('大学宿舍新生');
		});

		it('should contain field descriptors for all attributes', () => {
			const prompt = PromptBuilder.buildAgentGenerationPrompt();
			const systemContent = prompt.messages[0].content;

			const requiredFields = ['名称', '性别', '生日', '身高', '体重', '智商', '体力', '智慧', '幸运', '性格', '职业', '爱好', '技能', '身世', '大记忆', '小记忆', '情绪', '关系'];
			for (const field of requiredFields) {
				expect(systemContent).toContain(`字段: ${field}`);
			}
		});
	});

	describe('buildAgentDecisionPrompt', () => {
		it('should return a valid decision prompt', () => {
			const scene: Scene = {
				id: 'scene-1',
				worldId: 'world-1',
				parentId: null,
				name: '客厅',
				type: 'room',
				description: '温馨的客厅',
				properties: {},
				exits: []
			};

			const stats: StatsComponent = {
				type: 'Stats',
				energy: 80,
				maxEnergy: 100,
				health: 100,
				maxHealth: 100
			};

			const perception: AgentPerception = {
				currentScene: scene,
				visibleAgents: [{ id: 'agent-b', name: '李四', type: 'npc' }],
				visibleItems: [{ id: 'item-1', name: '沙发' }],
				recentEvents: [],
				selfState: {
					name: '张三',
					stats,
					memory: []
				}
			};

			const prompt = PromptBuilder.buildAgentDecisionPrompt('张三', perception, ['有点累了', '想休息']);

			expect(prompt.temperature).toBe(0.8);
			expect(prompt.responseFormat).toEqual({ type: 'json_object' });
			expect(prompt.messages).toHaveLength(2);

			const systemContent = prompt.messages[0].content;
			expect(systemContent).toContain('张三');
			expect(systemContent).toContain('《模拟人生》');

			const userContent = prompt.messages[1].content;
			expect(userContent).toContain('客厅');
			expect(userContent).toContain('李四');
			expect(userContent).toContain('沙发');
			expect(userContent).toContain('有点累了');
			expect(userContent).toContain('thought');
			expect(userContent).toContain('action');
			expect(userContent).toContain('timeAdvanceSeconds');
		});

		it('should handle empty thoughts gracefully', () => {
			const scene: Scene = {
				id: 'scene-1',
				worldId: 'world-1',
				parentId: null,
				name: '卧室',
				type: 'room',
				description: '安静的卧室',
				properties: {},
				exits: []
			};

			const stats: StatsComponent = {
				type: 'Stats',
				energy: 100,
				maxEnergy: 100,
				health: 100,
				maxHealth: 100
			};

			const perception: AgentPerception = {
				currentScene: scene,
				visibleAgents: [],
				visibleItems: [],
				recentEvents: [],
				selfState: {
					name: '王五',
					stats,
					memory: []
				}
			};

			const prompt = PromptBuilder.buildAgentDecisionPrompt('王五', perception);

			expect(prompt.messages[1].content).toContain('（暂无近期思考）');
		});
	});

	describe('formatPerception', () => {
		it('should format full perception correctly', () => {
			const scene: Scene = {
				id: 'scene-1',
				worldId: 'world-1',
				parentId: null,
				name: '厨房',
				type: 'room',
				description: '设备齐全的厨房',
				properties: {},
				exits: []
			};

			const stats: StatsComponent = {
				type: 'Stats',
				energy: 75,
				maxEnergy: 100,
				health: 100,
				maxHealth: 100
			};

			const perception: AgentPerception = {
				currentScene: scene,
				visibleAgents: [{ id: 'a2', name: '赵六', type: 'player' }],
				visibleItems: [{ id: 'i1', name: '冰箱' }],
				recentEvents: [
					{
						id: 'e1',
						worldId: 'w1',
						tickTime: 100,
						type: 'SPEAK',
						agentId: 'a2',
						data: { agentId: 'a2', content: '晚上吃什么？' },
						createdAt: Date.now()
					}
				],
				selfState: {
					name: '钱七',
					stats,
					memory: [
						{ id: 'm1', content: '今天搬家很累', timestamp: Date.now(), importance: 7 }
					]
				}
			};

			const text = PromptBuilder.formatPerception(perception);

			expect(text).toContain('场景: 厨房');
			expect(text).toContain('设备齐全的厨房');
			expect(text).toContain('赵六');
			expect(text).toContain('冰箱');
			expect(text).toContain('晚上吃什么？');
			expect(text).toContain('钱七');
			expect(text).toContain('体力: 75/100');
			expect(text).toContain('今天搬家很累');
		});

		it('should handle empty perception gracefully', () => {
			const scene: Scene = {
				id: 'scene-1',
				worldId: 'world-1',
				parentId: null,
				name: '阳台',
				type: 'outdoor',
				description: '宽敞的阳台',
				properties: {},
				exits: []
			};

			const stats: StatsComponent = {
				type: 'Stats',
				energy: 100,
				maxEnergy: 100,
				health: 100,
				maxHealth: 100
			};

			const perception: AgentPerception = {
				currentScene: scene,
				visibleAgents: [],
				visibleItems: [],
				recentEvents: [],
				selfState: {
					name: '无名',
					stats,
					memory: []
				}
			};

			const text = PromptBuilder.formatPerception(perception);

			expect(text).toContain('在场的人: （无）');
			expect(text).toContain('可见物品: （无）');
			expect(text).toContain('最近发生的事: （无）');
			expect(text).toContain('近期记忆: （无）');
		});
	});
});
