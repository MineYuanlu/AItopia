import type { WorldEvent } from '../types';
import type { EventBus, EventInput } from '../events/event-bus';

interface ScheduledEvent {
	time: number; // When to execute (world time in seconds)
	priority: number; // Lower = higher priority (for same-time ordering)
	event: EventInput;
}

export class Scheduler {
	private heap: ScheduledEvent[] = []; // Min-heap by (time, priority)
	private worldTime: number = 0;
	private isRunning: boolean = false;
	private eventBus: EventBus;
	// executedEvents acts as a ring buffer for recent events only.
	// The authoritative event count is maintained by the persistent store (DB).
	private executedEvents: WorldEvent[] = [];
	private onTickCallback?: (events: WorldEvent[]) => Promise<void> | void;

	constructor(eventBus: EventBus, startTime: number = 0) {
		this.eventBus = eventBus;
		this.worldTime = startTime;
	}

	// Schedule an event at a specific world time
	schedule(time: number, priority: number, event: EventInput): void {
		const scheduledEvent: ScheduledEvent = { time, priority, event };
		this.heap.push(scheduledEvent);
		this.heapifyUp(this.heap.length - 1);
	}

	// Schedule an event relative to current time
	scheduleIn(seconds: number, priority: number, event: EventInput): void {
		this.schedule(this.worldTime + seconds, priority, event);
	}

	// Execute one tick: process all events at or before current time
	// Uses isRunning as a mutex to prevent concurrent tick execution
	tick(): WorldEvent[] {
		if (this.isRunning) {
			console.warn('Scheduler.tick() called while already running — skipping concurrent tick');
			return [];
		}

		this.isRunning = true;
		try {
			const processedEvents: WorldEvent[] = [];

			// Collect all events that should be processed now
			// (snapshot to avoid heap mutations during callback side-effects)
			const eventsToProcess: ScheduledEvent[] = [];
			while (this.heap.length > 0) {
				const next = this.peek();
				if (!next || next.time > this.worldTime) break;
				eventsToProcess.push(this.pop()!);
			}

			// Process the snapshot — callbacks may call schedule() which
			// mutates the heap, but that only affects *future* ticks
			for (const scheduledEvent of eventsToProcess) {
				// Emit through the event bus - tickTime comes from scheduledEvent.time
				const worldEvent = this.eventBus.emit({
					...scheduledEvent.event,
					tickTime: scheduledEvent.time
				} as Omit<WorldEvent, 'id' | 'createdAt'>);

				processedEvents.push(worldEvent);
				this.executedEvents.push(worldEvent);

				// Keep executed events bounded for memory
				if (this.executedEvents.length > 2000) {
					this.executedEvents = this.executedEvents.slice(-1000);
				}
			}

			// Call the tick callback if any events were processed
			if (processedEvents.length > 0 && this.onTickCallback) {
				const result = this.onTickCallback(processedEvents);
				if (result instanceof Promise) {
					result.catch((err) => console.warn('Tick callback error:', err));
				}
			}

			return processedEvents;
		} finally {
			this.isRunning = false;
		}
	}

	// Advance world time by `seconds` and execute any events scheduled
	// at or before the new target time.
	//
	// Semantics: process events in chronological order, jumping time
	// to each event time, then set to the final target time.
	advanceTime(seconds: number): WorldEvent[] {
		if (this.isRunning) {
			console.warn('Scheduler.advanceTime() called while tick is running — skipping');
			return [];
		}

		const targetTime = this.worldTime + seconds;
		const processedEvents: WorldEvent[] = [];

		// Process all events that would occur before or at the target time
		// We iterate event-by-event to maintain chronological ordering.
		while (this.heap.length > 0) {
			const next = this.peek();
			if (!next || next.time > targetTime) break;

			// Advance time to the next event's scheduled time
			this.worldTime = next.time;

			// Process all events at this world time via tick()
			const events = this.tick();
			processedEvents.push(...events);
		}

		// Set the final world time to the target (even if no events fired)
		this.worldTime = targetTime;

		return processedEvents;
	}

	// Get next scheduled event time (Infinity if empty)
	getNextEventTime(): number {
		if (this.heap.length === 0) return Infinity;
		return this.heap[0].time;
	}

	// Check if there are pending events at or before current time
	hasPendingEvents(): boolean {
		if (this.heap.length === 0) return false;
		return this.heap[0].time <= this.worldTime;
	}

	// Check if there are any scheduled events regardless of time
	hasScheduledEvents(): boolean {
		return this.heap.length > 0;
	}

	// Get current world time
	getTime(): number {
		return this.worldTime;
	}

	// Set world time directly. Rejects time going backwards to maintain event ordering.
	setTime(time: number): void {
		if (time < this.worldTime) {
			throw new Error(
				`Cannot set world time backwards: ${time} < ${this.worldTime}`
			);
		}
		this.worldTime = time;
	}

	// Get executed events history
	getExecutedEvents(): WorldEvent[] {
		return [...this.executedEvents];
	}

	// Set callback for when tick executes (for Agent processing)
	onTick(callback: (events: WorldEvent[]) => Promise<void> | void): void {
		this.onTickCallback = callback;
	}

	// --- Min-heap helpers ---

	private peek(): ScheduledEvent | undefined {
		return this.heap[0];
	}

	private pop(): ScheduledEvent | undefined {
		if (this.heap.length === 0) return undefined;
		if (this.heap.length === 1) {
			return this.heap.pop()!;
		}

		const min = this.heap[0];
		this.heap[0] = this.heap.pop()!;
		this.heapifyDown(0);
		return min;
	}

	private heapifyUp(index: number): void {
		if (index === 0) return;

		const parent = Math.floor((index - 1) / 2);
		if (this.compare(this.heap[index], this.heap[parent]) < 0) {
			this.swap(index, parent);
			this.heapifyUp(parent);
		}
	}

	private heapifyDown(index: number): void {
		const left = 2 * index + 1;
		const right = 2 * index + 2;
		let smallest = index;

		if (left < this.heap.length && this.compare(this.heap[left], this.heap[smallest]) < 0) {
			smallest = left;
		}
		if (right < this.heap.length && this.compare(this.heap[right], this.heap[smallest]) < 0) {
			smallest = right;
		}

		if (smallest !== index) {
			this.swap(index, smallest);
			this.heapifyDown(smallest);
		}
	}

	private swap(i: number, j: number): void {
		const temp = this.heap[i];
		this.heap[i] = this.heap[j];
		this.heap[j] = temp;
	}

	// Compare two scheduled events by (time, priority)
	// Earlier time wins; if equal, lower priority number wins
	private compare(a: ScheduledEvent, b: ScheduledEvent): number {
		if (a.time !== b.time) {
			return a.time - b.time;
		}
		return a.priority - b.priority;
	}
}
