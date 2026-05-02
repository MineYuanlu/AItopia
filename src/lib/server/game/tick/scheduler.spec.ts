import { describe, it, expect, beforeEach } from 'vitest';
import { Scheduler } from './scheduler';
import { EventBus } from '../events/event-bus';
import type { EventType, UUID, WorldEvent } from '../types';

describe('Scheduler', () => {
	let eventBus: EventBus;
	let scheduler: Scheduler;
	const worldId = 'test-world-123' as UUID;

	beforeEach(() => {
		eventBus = new EventBus(worldId);
		scheduler = new Scheduler(eventBus, 0);
	});

	it('should schedule events at specific times', () => {
		const event = {
			type: 'SPEAK' as EventType,
			agentId: 'agent-1' as UUID,
			data: { content: 'Hello!' }
		};

		scheduler.schedule(10, 0, event);

		expect(scheduler.getNextEventTime()).toBe(10);
		expect(scheduler.hasPendingEvents()).toBe(false); // time is 0, event at 10

		// Advance time to execute the event
		scheduler.advanceTime(15);

		expect(scheduler.hasScheduledEvents()).toBe(false);
		expect(scheduler.getTime()).toBe(15);
	});

	it('should execute events in correct time order (min-heap ordering)', () => {
		const eventLog: string[] = [];

		eventBus.onAny((ev) => {
			eventLog.push(`${ev.tickTime}:${(ev.data as { content: string }).content}`);
		});

		// Schedule events in non-chronological order
		scheduler.schedule(50, 0, {
			type: 'SPEAK' as EventType,
			agentId: 'agent-1' as UUID,
			data: { content: 'At 50s' }
		});

		scheduler.schedule(10, 0, {
			type: 'SPEAK' as EventType,
			agentId: 'agent-1' as UUID,
			data: { content: 'At 10s' }
		});

		scheduler.schedule(30, 0, {
			type: 'SPEAK' as EventType,
			agentId: 'agent-1' as UUID,
			data: { content: 'At 30s' }
		});

		scheduler.schedule(20, 0, {
			type: 'SPEAK' as EventType,
			agentId: 'agent-1' as UUID,
			data: { content: 'At 20s' }
		});

		// Advance time past all events
		scheduler.advanceTime(100);

		// Events should be in chronological order
		expect(eventLog).toEqual(['10:At 10s', '20:At 20s', '30:At 30s', '50:At 50s']);
	});

	it('should respect same-time event ordering by priority', () => {
		const eventLog: string[] = [];

		eventBus.onAny((ev) => {
			eventLog.push(`${ev.tickTime}:${ev.data.priority}:${(ev.data as { content: string }).content}`);
		});

		// Schedule events at the same time with different priorities
		scheduler.schedule(10, 3, {
			type: 'SPEAK' as EventType,
			agentId: 'agent-1' as UUID,
			data: { content: 'Priority 3', priority: 3 }
		});

		scheduler.schedule(10, 1, {
			type: 'SPEAK' as EventType,
			agentId: 'agent-1' as UUID,
			data: { content: 'Priority 1', priority: 1 }
		});

		scheduler.schedule(10, 2, {
			type: 'SPEAK' as EventType,
			agentId: 'agent-1' as UUID,
			data: { content: 'Priority 2', priority: 2 }
		});

		scheduler.advanceTime(100);

		// Lower priority number should execute first
		expect(eventLog).toEqual(['10:1:Priority 1', '10:2:Priority 2', '10:3:Priority 3']);
	});

	it('should process ONLY events at or before current time on tick()', () => {
		const eventLog: string[] = [];

		eventBus.onAny((ev) => {
			eventLog.push(`${ev.tickTime}:${(ev.data as { content: string }).content}`);
		});

		scheduler.schedule(5, 0, {
			type: 'SPEAK' as EventType,
			agentId: 'agent-1' as UUID,
			data: { content: 'At 5s' }
		});

		scheduler.schedule(15, 0, {
			type: 'SPEAK' as EventType,
			agentId: 'agent-1' as UUID,
			data: { content: 'At 15s' }
		});

		scheduler.schedule(10, 0, {
			type: 'SPEAK' as EventType,
			agentId: 'agent-1' as UUID,
			data: { content: 'At 10s' }
		});

		// Set time to 10 and tick
		scheduler.setTime(10);
		const processed = scheduler.tick();

		// The events at time 5 and 10 should be processed
		expect(processed.length).toBe(2);
		expect(eventLog).toEqual(['5:At 5s', '10:At 10s']);

		// Event at 15s should still be pending
		expect(scheduler.getNextEventTime()).toBe(15);
	});

	it('should handle scheduleIn for relative scheduling', () => {
		const eventLog: string[] = [];

		eventBus.onAny((ev) => {
			eventLog.push(`${ev.tickTime}:${(ev.data as { content: string }).content}`);
		});

		scheduler.scheduleIn(10, 0, {
			type: 'SPEAK' as EventType,
			agentId: 'agent-1' as UUID,
			data: { content: 'In 10s' }
		});

		scheduler.scheduleIn(5, 0, {
			type: 'SPEAK' as EventType,
			agentId: 'agent-1' as UUID,
			data: { content: 'In 5s' }
		});

		scheduler.advanceTime(100);

		expect(eventLog).toEqual(['5:In 5s', '10:In 10s']);
	});

	it('should return Infinity for next event time when empty', () => {
		expect(scheduler.getNextEventTime()).toBe(Infinity);
		expect(scheduler.hasPendingEvents()).toBe(false);
	});

	it('should call onTick callback with processed events', () => {
		const callbackEvents: WorldEvent[][] = [];

		scheduler.onTick((events) => {
			callbackEvents.push(events);
		});

		scheduler.schedule(5, 0, {
			type: 'SPEAK' as EventType,
			agentId: 'agent-1' as UUID,
			data: { content: 'Hello' }
		});

		scheduler.setTime(10);
		scheduler.tick();

		expect(callbackEvents.length).toBe(1);
		expect(callbackEvents[0][0].data.content).toBe('Hello');
	});

	it('should track executed events history', () => {
		scheduler.schedule(5, 0, {
			type: 'SPEAK' as EventType,
			agentId: 'agent-1' as UUID,
			data: { content: 'Event 1' }
		});

		scheduler.schedule(10, 0, {
			type: 'MOVE' as EventType,
			agentId: 'agent-1' as UUID,
			data: { direction: 'north' }
		});

		scheduler.advanceTime(100);

		const executed = scheduler.getExecutedEvents();
		expect(executed.length).toBe(2);
		expect(executed[0].type).toBe('SPEAK');
		expect(executed[1].type).toBe('MOVE');
	});

	it('should handle advanceTime with no pending events', () => {
		expect(scheduler.getTime()).toBe(0);

		const processed = scheduler.advanceTime(50);

		expect(processed.length).toBe(0);
		expect(scheduler.getTime()).toBe(50);
	});

	it('should stop scheduling and processing when event time matches advanceTime exactly', () => {
		scheduler.schedule(20, 0, {
			type: 'SPEAK' as EventType,
			agentId: 'agent-1' as UUID,
			data: { content: 'Exact match' }
		});

		const processed = scheduler.advanceTime(20);

		expect(processed.length).toBe(1);
		expect(processed[0].tickTime).toBe(20);
		expect(scheduler.getTime()).toBe(20);
	});

	it('should process multiple events at the same time', () => {
		const eventLog: string[] = [];

		eventBus.onAny((ev) => {
			eventLog.push((ev.data as { content: string }).content);
		});

		// Multiple events at the exact same time
		scheduler.schedule(10, 0, {
			type: 'SPEAK' as EventType,
			agentId: 'agent-1' as UUID,
			data: { content: 'Event A' }
		});

		scheduler.schedule(10, 0, {
			type: 'SPEAK' as EventType,
			agentId: 'agent-2' as UUID,
			data: { content: 'Event B' }
		});

		scheduler.schedule(10, 0, {
			type: 'SPEAK' as EventType,
			agentId: 'agent-3' as UUID,
			data: { content: 'Event C' }
		});

		scheduler.advanceTime(10);

		// All three events should be processed
		expect(eventLog.length).toBe(3);
		expect(eventLog).toContain('Event A');
		expect(eventLog).toContain('Event B');
		expect(eventLog).toContain('Event C');
	});
});
