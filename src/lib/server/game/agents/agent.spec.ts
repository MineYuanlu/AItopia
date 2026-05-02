import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from './agent';
import type { UUID, AgentPerception, ActionIntent, Scene, StatsComponent } from '../types';
import type { WorldKernel } from '../world/world-kernel';

// Concrete agent for testing abstract class
class TestAgent extends Agent {
	async decide(perception: AgentPerception): Promise<ActionIntent | null> {
		return {
			thought: 'test thought',
			action: { type: 'WAIT' },
			timeAdvanceSeconds: 60
		};
	}
}

describe('Agent (base class)', () => {
	let mockKernel: WorldKernel;
	let agent: TestAgent;
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
				selfState: { name: 'Test', stats: mockStats, memory: [] }
			} as AgentPerception),
			agentSpeak: vi.fn(),
			moveEntity: vi.fn(),
			getTime: vi.fn().mockReturnValue(0),
			dispatch: vi.fn()
		} as unknown as WorldKernel;

		agent = new TestAgent({
			id: 'agent-1' as UUID,
			entityId: 'entity-1' as UUID,
			worldId: 'world-1' as UUID,
			kernel: mockKernel,
			name: 'TestAgent',
			isPlayer: false
		});
	});

	it('should have correct properties after construction', () => {
		expect(agent.id).toBe('agent-1');
		expect(agent.entityId).toBe('entity-1');
		expect(agent.worldId).toBe('world-1');
		expect(agent.isPlayer).toBe(false);
		expect(agent.getName()).toBe('TestAgent');
		expect(agent.getEntityId()).toBe('entity-1');
	});

	it('perceive() should call kernel.getAgentPerception', () => {
		const perception = agent.perceive();
		expect(mockKernel.getAgentPerception).toHaveBeenCalledWith('entity-1');
		expect(perception.currentScene.name).toBe('客厅');
	});

	it('tick() should run full lifecycle: perceive → decide → record thought → execute', async () => {
		const result = await agent.tick();

		expect(result).not.toBeNull();
		expect(result!.thought).toBe('test thought');
		expect(result!.action.type).toBe('WAIT');

		// Should dispatch AGENT_ACTION event
		expect(mockKernel.dispatch).toHaveBeenCalledTimes(1);
		expect(mockKernel.dispatch).toHaveBeenCalledWith({
			type: 'AGENT_ACTION',
			tickTime: 0,
			agentId: 'entity-1',
			data: {
				agentId: 'entity-1',
				action: { type: 'WAIT' },
				success: true
			}
		});
	});

	it('tick() should maintain sliding window of recent thoughts', async () => {
		// Override decide to return different thoughts
		let callCount = 0;
		agent.decide = vi.fn().mockImplementation(async () => {
			callCount++;
			return {
				thought: `thought ${callCount}`,
				action: { type: 'WAIT' },
				timeAdvanceSeconds: 60
			};
		});

		// Tick 7 times (max is 5)
		for (let i = 0; i < 7; i++) {
			await agent.tick();
		}

		// Should only keep last 5 thoughts
		expect(agent['recentThoughts'].length).toBe(5);
		expect(agent['recentThoughts'][0]).toBe('thought 3');
		expect(agent['recentThoughts'][4]).toBe('thought 7');
	});

	it('execute() should handle SPEAK action', () => {
		agent['execute']({
			thought: 'say hello',
			action: { type: 'SPEAK', content: 'Hello!' },
			timeAdvanceSeconds: 60
		});

		expect(mockKernel.agentSpeak).toHaveBeenCalledWith('entity-1', 'Hello!');
		expect(mockKernel.dispatch).toHaveBeenCalledWith({
			type: 'AGENT_ACTION',
			tickTime: 0,
			agentId: 'entity-1',
			data: {
				agentId: 'entity-1',
				action: { type: 'SPEAK', content: 'Hello!' },
				success: true
			}
		});
	});

	it('execute() should handle MOVE action', () => {
		agent['execute']({
			thought: 'go north',
			action: { type: 'MOVE', target: 'scene-north' },
			timeAdvanceSeconds: 300
		});

		expect(mockKernel.moveEntity).toHaveBeenCalledWith('entity-1', 'scene-north');
	});

	it('execute() should handle WAIT and THINK actions without calling kernel methods', () => {
		agent['execute']({
			thought: 'wait',
			action: { type: 'WAIT' },
			timeAdvanceSeconds: 60
		});

		expect(mockKernel.agentSpeak).not.toHaveBeenCalled();
		expect(mockKernel.moveEntity).not.toHaveBeenCalled();
	});
});
