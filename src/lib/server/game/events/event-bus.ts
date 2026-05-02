import { eq, desc } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import type { EventType, UUID, WorldEvent } from '../types';
import { EventLog } from '../persistence/event-log';

// Common partial used by constructor callers - tickTime is optional (Scheduler will fill it)
export type EventInput = Omit<WorldEvent, 'id' | 'createdAt' | 'worldId' | 'tickTime'> & { tickTime?: number };

export type EventHandler = (event: WorldEvent) => void | Promise<void>;

export class EventBus {
	private handlers: Map<EventType, Set<EventHandler>> = new Map();
	private anyHandlers: Set<EventHandler> = new Set();
	private worldId: UUID;
	private pendingEvents: WorldEvent[] = []; // Buffer before DB write
	eventLog: EventLog;

	constructor(worldId: UUID) {
		this.worldId = worldId;
		this.eventLog = new EventLog(worldId);
	}

	// Subscribe to event types
	on(eventType: EventType, handler: EventHandler): () => void {
		if (!this.handlers.has(eventType)) {
			this.handlers.set(eventType, new Set());
		}
		this.handlers.get(eventType)!.add(handler);

		// Return unsubscribe function
		return () => {
			this.handlers.get(eventType)?.delete(handler);
		};
	}

	// Subscribe to all events
	onAny(handler: EventHandler): () => void {
		this.anyHandlers.add(handler);

		// Return unsubscribe function
		return () => {
			this.anyHandlers.delete(handler);
		};
	}

	// Emit an event - synchronously calls handlers, queues for DB
	emit(event: EventInput): WorldEvent {
		const fullEvent: WorldEvent = {
			...event,
			tickTime: event.tickTime ?? Date.now() * 0.001, // Default to current time if not set
			id: crypto.randomUUID(),
			worldId: this.worldId,
			createdAt: Date.now()
		};

		// Call type-specific handlers (synchronously for now)
		const typeHandlers = this.handlers.get(fullEvent.type);
		if (typeHandlers) {
			for (const handler of typeHandlers) {
				try {
					const result = handler(fullEvent);
					if (result instanceof Promise) {
						result.catch((err) => console.warn('Event handler error:', err));
					}
				} catch (err) {
					console.warn('Event handler error:', err);
				}
			}
		}

		// Call any-event handlers
		for (const handler of this.anyHandlers) {
			try {
				const result = handler(fullEvent);
				if (result instanceof Promise) {
					result.catch((err) => console.warn('Any-event handler error:', err));
				}
			} catch (err) {
				console.warn('Any-event handler error:', err);
			}
		}

		// Queue for DB persistence
		this.pendingEvents.push(fullEvent);

		// Keep in-memory buffer bounded
		if (this.pendingEvents.length > 1000) {
			this.pendingEvents.shift();
		}

		return fullEvent;
	}

	// Flush pending events to DB via EventLog
	async flush(): Promise<void> {
		if (this.pendingEvents.length === 0) return;

		// Delegate to EventLog for batch insertion
		const stripped = this.pendingEvents.map((ev) => {
			const { id, createdAt, ...rest } = ev;
			return rest;
		});
		await this.eventLog.appendMany(stripped);

		this.pendingEvents = [];
	}

	// Load events from DB for replay
	async loadEvents(sinceTick: number = 0): Promise<WorldEvent[]> {
		return this.eventLog.replayEvents(sinceTick);
	}

	// Get recent events (for perception)
	getRecentEvents(limit: number = 10): WorldEvent[] {
		return this.pendingEvents.slice(-limit);
	}
}

