export type UUID = string;
export type ScenePath = string;

export type SceneType = 'town' | 'building' | 'room' | 'outdoor' | 'abstract';

export interface Scene {
	id: UUID;
	worldId: UUID;
	parentId: UUID | null;
	name: string;
	type: SceneType;
	description: string;
	properties: Record<string, unknown>;
	exits: SceneExit[];
}

export interface SceneExit {
	direction: string;
	targetSceneId: UUID;
	condition?: string;
}

export type EntityType = 'player' | 'npc' | 'item';

export interface Entity {
	id: UUID;
	worldId: UUID;
	sceneId: UUID;
	name: string;
	type: EntityType;
}

export type Component =
	| PositionComponent
	| StatsComponent
	| InventoryComponent
	| PersonalityComponent
	| MemoryComponent
	| RelationComponent
	| PerceptionComponent;

export interface PositionComponent {
	type: 'Position';
	sceneId: UUID;
	relX: number;
	relY: number;
	facing: string;
}

export interface StatsComponent {
	type: 'Stats';
	energy: number;
	maxEnergy: number;
	health: number;
	maxHealth: number;
}

export interface InventoryComponent {
	type: 'Inventory';
	capacity: number;
	items: UUID[];
}

export interface PersonalityComponent {
	type: 'Personality';
	traits: Record<string, number>;
	voice: string;
	background: string;
}

export interface MemoryComponent {
	type: 'Memory';
	shortTerm: MemoryChunk[];
	longTerm: MemoryChunk[];
}

export interface MemoryChunk {
	id: UUID;
	content: string;
	timestamp: number;
	importance: number;
}

export type ComponentType = Component['type'];

export type ComponentMap = {
	Position: PositionComponent;
	Stats: StatsComponent;
	Inventory: InventoryComponent;
	Personality: PersonalityComponent;
	Memory: MemoryComponent;
	Relation: RelationComponent;
	Perception: PerceptionComponent;
};

export interface RelationComponent {
	type: 'Relation';
	targets: RelationEntry[];
}

export interface RelationEntry {
	targetId: UUID;
	relationType: string;
	description: string;
	status: string;
	affinity: number;
}

export interface PerceptionComponent {
	type: 'Perception';
	visibleEntities: UUID[];
	audibleEvents: string[];
}

export type EventType =
	| 'AGENT_DECIDE'
	| 'AGENT_ACTION'
	| 'SCENE_CHANGE'
	| 'SPEAK'
	| 'MOVE'
	| 'TIME_ADVANCE'
	| 'WORLD_INIT'
	| 'ENTITY_CREATED'
	| 'COMPONENT_ADDED';

export interface WorldEvent {
	id: UUID;
	worldId: UUID;
	tickTime: number;
	type: EventType;
	agentId: UUID | null;
	data: Record<string, unknown>;
	createdAt: number;
}

export interface ActionIntent {
	thought: string;
	action: {
		type: 'SPEAK' | 'MOVE' | 'INTERACT' | 'WAIT' | 'THINK';
		target?: string;
		content?: string;
	};
	timeAdvanceSeconds: number;
}

export interface WorldState {
	id: UUID;
	currentTime: number;
	scenes: Map<UUID, Scene>;
	entities: Map<UUID, Entity>;
	components: Map<UUID, Component[]>;
}

export interface AgentState {
	id: UUID;
	worldId: UUID;
	entityId: UUID;
	currentSceneId: UUID;
	lastActionTime: number;
	isPlayer: boolean;
	config: {
		name: string;
		personality: PersonalityComponent;
		memory: MemoryComponent;
		stats: StatsComponent;
	};
}

export interface AgentPerception {
	currentScene: Scene;
	visibleAgents: { id: UUID; name: string; type: EntityType }[];
	visibleItems: { id: UUID; name: string }[];
	recentEvents: WorldEvent[];
	selfState: {
		name: string;
		stats: StatsComponent;
		memory: MemoryChunk[];
	};
}
