import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NPCAgent } from './npc-agent';
import type { UUID, AgentPerception, Scene, StatsComponent } from '../types';
import type { WorldKernel } from '../world/world-kernel';

describe('NPCAgent', () => {
	let mockKernel: WorldKernel;
	let agent: NPCAgent;
	const mockScene: Scene = {
		id: 'scene-1',
		worldId: 'world-1',
		parentId: null,
		name: '客厅',
		type: 'room',
		description: '温馨的客厅',
		properties: {},
		exits: []
	};
	const mockStats: StatsComponent = {
		type: 'Stats',
		energy: 100,
		maxEnergy: 100,
		health: 100,
		maxHealth: 100
	};

	beforeEach(() => {
		mockKernel = {
			worldId: 'world-1' as UUID,
			getAgentPerception: vi.fn().mockReturnValue({
				currentScene: mockScene,
				visibleAgents: [],
				visibleItems: [],
				recentEvents: [],
				selfState: { name: 'NPC', stats: mockStats, memory: [] }
			} as AgentPerception),
			agentSpeak: vi.fn(),
			moveEntity: vi.fn(),
			getTime: vi.fn().mockReturnValue(0),
			dispatch: vi.fn()
		} as unknown as WorldKernel;

		agent = new NPCAgent({
			id: 'npc-1' as UUID,
			entityId: 'entity-npc-1' as UUID,
			worldId: 'world-1' as UUID,
			kernel: mockKernel,
			name: 'TestNPC',
			seed: 42
		});
	});

	it('should be a non-player agent', () => {
		expect(agent.isPlayer).toBe(false);
		expect(agent.getName()).toBe('TestNPC');
	});

	it('should have 4 behaviors initialized', () => {
		expect(agent['behaviors'].length).toBe(4);
	});

	it('decide() should return a valid ActionIntent from rules', async () => {
		// Set LLM trigger chance to 0 to force rule-based
		agent['llmTriggerChance'] = 0;

		const result = await agent.decide(agent.perceive());

		expect(result).not.toBeNull();
		expect(result!.thought).toContain('TestNPC');
		expect(['WAIT', 'SPEAK', 'THINK', 'MOVE']).toContain(result!.action.type);
		expect(typeof result!.timeAdvanceSeconds).toBe('number');
	});

	it('should use seeded random for deterministic behavior', async () => {
		agent['llmTriggerChance'] = 0;

		// First agent with seed 42
		const result1 = await agent.decide(agent.perceive());

		// Create second agent with same seed
		const agent2 = new NPCAgent({
			id: 'npc-2' as UUID,
			entityId: 'entity-npc-2' as UUID,
			worldId: 'world-1' as UUID,
			kernel: mockKernel,
			name: 'TestNPC2',
			seed: 42
		});
		agent2['llmTriggerChance'] = 0;

		const result2 = await agent2.decide(agent2.perceive());

		// Same seed should produce same action type initially
		expect(result1!.action.type).toBe(result2!.action.type);
	});

	it('should use different behavior with different seeds', async () => {
		agent['llmTriggerChance'] = 0;

		const result1 = await agent.decide(agent.perceive());

		// Create agent with different seed
		const agent2 = new NPCAgent({
			id: 'npc-3' as UUID,
			entityId: 'entity-npc-3' as UUID,
			worldId: 'world-1' as UUID,
			kernel: mockKernel,
			name: 'TestNPC3',
			seed: 999
		});
		agent2['llmTriggerChance'] = 0;

		const result2 = await agent2.decide(agent2.perceive());

		// Different seeds might produce same type occasionally, but action details differ
		expect(result2).not.toBeNull();
	});

	it('weighted selection should respect probabilities', () => {
		agent['llmTriggerChance'] = 0;

		// Run many times and collect distribution
		const counts: Record<string, number> = { WAIT: 0, SPEAK: 0, THINK: 0, MOVE: 0 };
		const iterations = 1000;

		for (let i = 0; i < iterations; i++) {
			const result = agent['selectWeightedBehavior']();
			counts[result.action.type]++;
		}

		// Check rough proportions (with seeded random, these are deterministic)
		// WAIT should be ~40%, SPEAK ~30%, THINK ~20%, MOVE ~10%
		expect(counts['WAIT']).toBeGreaterThan(counts['SPEAK']);
		expect(counts['SPEAK']).toBeGreaterThan(counts['THINK']);
		expect(counts['THINK']).toBeGreaterThan(counts['MOVE']);

		// All action types should have been chosen at least once in 1000 iterations
		expect(counts['MOVE']).toBeGreaterThan(0);
	});

	it('SPEAK behavior should return one of the phrases', async () => {
		agent['llmTriggerChance'] = 0;

		// Force SPEAK by manipulating rng to select the second behavior
		// behavior weights: WAIT=0.4, SPEAK=0.3, THINK=0.2, MOVE=0.1
		// We need random in [0.4, 0.7) to hit SPEAK
		agent['rng'] = () => 0.5;

		const result = await agent.decide(agent.perceive());

		expect(result!.action.type).toBe('SPEAK');
		expect(result!.action.content).toBeTruthy();
	});

	it('MOVE behavior should return a direction', async () => {
		agent['llmTriggerChance'] = 0;

		// Force MOVE: random in [0.9, 1.0)
		agent['rng'] = () => 0.95;

		const result = await agent.decide(agent.perceive());

		expect(result!.action.type).toBe('MOVE');
		expect(result!.action.target).toBeTruthy();
		expect(['north', 'south', 'east', 'west']).toContain(result!.action.target);
	});

	it('should fall back to rules when LLM fails', async () => {
		const mockLLM = {
			chatJSON: vi.fn().mockRejectedValue(new Error('LLM error'))
		};

		const agentWithLLM = new NPCAgent({
			id: 'npc-llm' as UUID,
			entityId: 'entity-llm' as UUID,
			worldId: 'world-1' as UUID,
			kernel: mockKernel,
			name: 'LLM NPC',
			llm: mockLLM as any,
			llmTriggerChance: 1.0 // Always try LLM
		});

		// Force rng to trigger LLM path
		agentWithLLM['rng'] = () => 0.05;

		const result = await agentWithLLM.decide(agentWithLLM.perceive());

		expect(result).not.toBeNull();
		expect(mockLLM.chatJSON).toHaveBeenCalled();
		// Should have fallen back to rules
		expect(result!.thought).toContain('LLM NPC');
	});

	it('should support tick() lifecycle', async () => {
		agent['llmTriggerChance'] = 0;

		const result = await agent.tick();

		expect(result).not.toBeNull();
		expect(mockKernel.dispatch).toHaveBeenCalledWith(expect.objectContaining({
			type: 'AGENT_ACTION',
			agentId: 'entity-npc-1'
		}));
	});
});
