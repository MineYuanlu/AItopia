import type { EventType, UUID, WorldEvent } from '../types';

export interface EventPayloadMap {
	WORLD_INIT: {
		worldName: string;
		initialSceneIds: UUID[];
	};
	ENTITY_CREATED: {
		entityId: UUID;
		name: string;
		type: 'player' | 'npc' | 'item';
		sceneId: UUID;
	};
	COMPONENT_ADDED: {
		entityId: UUID;
		componentType: string;
		componentData: Record<string, unknown>;
	};
	AGENT_DECIDE: {
		agentId: UUID;
		thought: string;
		actionType: string;
	};
	AGENT_ACTION: {
		agentId: UUID;
		action: {
			type: string;
			target?: string;
			content?: string;
		};
		success: boolean;
		reason?: string;
	};
	SPEAK: {
		agentId: UUID;
		content: string;
		targetId?: UUID;
	};
	MOVE: {
		entityId: UUID;
		fromSceneId: UUID;
		toSceneId: UUID;
		direction: string;
	};
	TIME_ADVANCE: {
		advancedBy: number;
		newTime: number;
		reason?: string;
	};
}

export type EventPayload<T extends EventType> = T extends keyof EventPayloadMap
	? EventPayloadMap[T]
	: Record<string, unknown>;

// Helper to create typed events
export function createEvent<T extends EventType>(
	type: T,
	worldId: UUID,
	tickTime: number,
	agentId: UUID | null,
	payload: EventPayload<T>
): Omit<WorldEvent, 'id' | 'createdAt'> {
	return {
		type,
		worldId,
		tickTime,
		agentId,
		data: payload as unknown as Record<string, unknown>
	};
}
