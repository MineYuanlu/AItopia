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
			tickTime: event.tickTime !== undefined ? event.tickTime : Date.now() * 0.001, // Default to current time if not set
			id: crypto.randomUUID(),
			worldId: this.worldId,
			createdAt: Date.now()
		};

		let handlerFailed = false;
		let lastError: unknown;

		// Call type-specific handlers (synchronously for now)
		const typeHandlers = this.handlers.get(fullEvent.type);
		if (typeHandlers) {
			for (const handler of typeHandlers) {
				try {
					const result = handler(fullEvent);
					if (result instanceof Promise) {
						result.catch((err) => {
							console.warn('Event handler async error:', err);
						});
					}
				} catch (err) {
					handlerFailed = true;
					lastError = err;
					console.warn('Event handler error:', err);
				}
			}
		}

		// Call any-event handlers
		for (const handler of this.anyHandlers) {
			try {
				const result = handler(fullEvent);
				if (result instanceof Promise) {
					result.catch((err) => {
						console.warn('Any-event handler async error:', err);
					});
				}
			} catch (err) {
				handlerFailed = true;
				lastError = err;
				console.warn('Any-event handler error:', err);
			}
		}

		// Queue for DB persistence regardless of handler success
		// (Event happened even if handler failed)
		this.pendingEvents.push(fullEvent);

		// Keep in-memory buffer bounded
		if (this.pendingEvents.length > 1000) {
			this.pendingEvents.shift();
		}

		// If any handler failed, log it but still return the event
		// Callers should not rely on exceptions to detect handler failures
		if (handlerFailed) {
			console.warn(`Event emitted but some handlers failed for type: ${fullEvent.type}`, lastError);
		}

		return fullEvent;
	}

	// Flush pending events to DB via EventLog
	async flush(): Promise<void> {
		if (this.pendingEvents.length === 0) return;

		// Capture batch by reference, but keep the original array alive
		// until persistence succeeds. If it fails, we can safely restore.
		const batch = this.pendingEvents;
		const nextQueue: WorldEvent[] = [];

		// Move any events that arrived during previous flush attempts
		this.pendingEvents = nextQueue;

		// Strip auto-generated fields before delegation to EventLog
		const stripped = batch.map((ev) => {
			const { id, createdAt, ...rest } = ev;
			return rest;
		});

		try {
			await this.eventLog.appendMany(stripped);
		} catch (err) {
			// Restore failed batch back to pendingEvents (prepend so order is preserved)
			this.pendingEvents = batch.concat(this.pendingEvents);
			throw err;
		}
	}

	// Load events from DB for replay
	async loadEvents(sinceTick: number = 0): Promise<WorldEvent[]> {
		return this.eventLog.replayEvents(sinceTick);
	}

	/**
	 * Get recent events for perception/context building.
	 * NOTE: This returns only un-flushed (in-memory) events.
	 * For full persisted history, use eventLog.replayEvents().
	 */
	getRecentEvents(limit: number = 10): WorldEvent[] {
		return this.pendingEvents.slice(-limit);
	}
}

