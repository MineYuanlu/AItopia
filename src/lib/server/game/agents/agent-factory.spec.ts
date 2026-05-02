import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentFactory } from './agent-factory';
import { PlayerAgent } from './player-agent';
import { NPCAgent } from './npc-agent';
import { AgentGenerator } from './agent-generator';
import type { GeneratedAgent } from './agent-generator';
import type { UUID, Scene, StatsComponent } from '../types';

// Mock crypto.randomUUID
const mockRandomUUID = vi.fn();
Object.defineProperty(globalThis, 'crypto', {
	value: { randomUUID: mockRandomUUID },
	writable: true
});

// Mock AgentGenerator.toComponents
vi.spyOn(AgentGenerator, 'toComponents').mockReturnValue([
	{ type: 'Stats', energy: 80, maxEnergy: 100, health: 100, maxHealth: 100 } as StatsComponent,
	{ type: 'Personality', traits: { '开朗': 50 }, voice: '说话方式', background: '背景' },
	{ type: 'Memory', shortTerm: [], longTerm: [] }
]);

describe('AgentFactory', () => {
	let mockKernel: any;
	let mockLLM: any;
	let generatedAgent: GeneratedAgent;

	beforeEach(() => {
		mockRandomUUID.mockReturnValue('mock-uuid-123');

		mockKernel = {
			worldId: 'world-1' as UUID,
			createAgent: vi.fn().mockReturnValue({
				id: 'entity-player-1',
				name: '张三',
				type: 'player',
				sceneId: 'scene-1'
			}),
			entityStore: {
				addComponent: vi.fn()
			},
			getAgentPerception: vi.fn(),
			agentSpeak: vi.fn(),
			moveEntity: vi.fn(),
			getTime: vi.fn().mockReturnValue(0),
			dispatch: vi.fn()
		};

		mockLLM = {
			chatJSON: vi.fn()
		};

		generatedAgent = {
			名称: '张三',
			性别: '男',
			生日: '2000-01-01',
			身高: 175,
			体重: 70,
			智商: 85,
			体力: 80,
			智慧: 75,
			幸运: 60,
			性格: ['开朗', '细心'],
			职业: '程序员',
			爱好: ['编程', '游戏'],
			技能: ['JavaScript', 'React'],
			身世: '来自北京',
			大记忆: ['大学毕业'],
			小记忆: ['今天天气不错'],
			情绪: '平静',
			关系: []
		};
	});

	describe('createPlayer', () => {
		it('should create a PlayerAgent and register entity in world', () => {
			const player = AgentFactory.createPlayer(
				generatedAgent,
				mockKernel,
				'scene-1' as UUID,
				mockLLM
			);

			expect(player).toBeInstanceOf(PlayerAgent);
			expect(player.isPlayer).toBe(true);
			expect(player.getName()).toBe('张三');
		});

		it('should create entity with correct parameters', () => {
			AgentFactory.createPlayer(
				generatedAgent,
				mockKernel,
				'scene-1' as UUID,
				mockLLM
			);

			expect(mockKernel.createAgent).toHaveBeenCalledWith('张三', 'scene-1', true);
		});

		it('should add components from generated data', () => {
			AgentFactory.createPlayer(
				generatedAgent,
				mockKernel,
				'scene-1' as UUID,
				mockLLM
			);

			expect(AgentGenerator.toComponents).toHaveBeenCalledWith(generatedAgent);
			expect(mockKernel.entityStore.addComponent).toHaveBeenCalledTimes(3);
		});

		it('should assign correct worldId and entityId', () => {
			const player = AgentFactory.createPlayer(
				generatedAgent,
				mockKernel,
				'scene-1' as UUID,
				mockLLM
			);

			expect(player.worldId).toBe('world-1');
			expect(player.entityId).toBe('entity-player-1');
		});
	});

	describe('createNPC', () => {
		it('should create an NPCAgent and register entity in world', () => {
			const npc = AgentFactory.createNPC(
				generatedAgent,
				mockKernel,
				'scene-1' as UUID
			);

			expect(npc).toBeInstanceOf(NPCAgent);
			expect(npc.isPlayer).toBe(false);
			expect(npc.getName()).toBe('张三');
		});

		it('should create NPC entity with isPlayer=false', () => {
			AgentFactory.createNPC(
				generatedAgent,
				mockKernel,
				'scene-1' as UUID
			);

			expect(mockKernel.createAgent).toHaveBeenCalledWith('张三', 'scene-1', false);
		});

		it('should pass LLM and seed when provided', () => {
			const npc = AgentFactory.createNPC(
				generatedAgent,
				mockKernel,
				'scene-1' as UUID,
				mockLLM,
				42
			);

			expect(npc).toBeInstanceOf(NPCAgent);
			// LLM and seed are stored internally
		});

		it('should work without optional LLM and seed', () => {
			const npc = AgentFactory.createNPC(
				generatedAgent,
				mockKernel,
				'scene-1' as UUID
			);

			expect(npc).toBeInstanceOf(NPCAgent);
		});
	});
});
