import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// ============================================================
// 1. worlds —— World instance
// ============================================================
export const worlds = sqliteTable('worlds', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	currentTime: integer('current_time')
		.notNull()
		.$defaultFn(() => 0),
	createdAt: integer('created_at')
		.notNull()
		.$defaultFn(() => Date.now())
});
export const scenes = sqliteTable('scenes', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	worldId: text('world_id')
		.notNull()
		.references(() => worlds.id),
	parentId: text('parent_id').references((): any => scenes.id, { onDelete: 'set null' }),
	name: text('name').notNull(),
	type: text('type', {
		enum: ['town', 'building', 'room', 'outdoor', 'abstract']
	}).notNull(),
	description: text('description').notNull().default(''),
	properties: text('properties', { mode: 'json' })
		.notNull()
		.$default(() => ({}) as any),
	exits: text('exits', { mode: 'json' })
		.notNull()
		.$default(() => [] as any)
});

// ============================================================
// 3. entities —— ECS entity
// ============================================================
export const entities = sqliteTable('entities', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	worldId: text('world_id')
		.notNull()
		.references(() => worlds.id),
	sceneId: text('scene_id')
		.notNull()
		.references(() => scenes.id),
	name: text('name').notNull(),
	type: text('type', {
		enum: ['player', 'npc', 'item']
	}).notNull()
});

// ============================================================
// 4. components —— ECS components (stored as JSON)
// ============================================================
export const components = sqliteTable('components', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	entityId: text('entity_id')
		.notNull()
		.references(() => entities.id),
	type: text('type').notNull(),
	data: text('data', { mode: 'json' }).notNull()
});

// ============================================================
// 5. events —— Event sourcing log
// ============================================================
export const events = sqliteTable('events', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	worldId: text('world_id')
		.notNull()
		.references(() => worlds.id),
	tickTime: integer('tick_time').notNull(),
	type: text('type').notNull(),
	agentId: text('agent_id'),
	data: text('data', { mode: 'json' }).notNull(),
	createdAt: integer('created_at')
		.notNull()
		.$defaultFn(() => Date.now())
}, (table) => [index('events_agent_id_idx').on(table.agentId)]);

// ============================================================
// 6. agentStates —— Runtime agent state
// ============================================================
export const agentStates = sqliteTable('agent_states', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	worldId: text('world_id')
		.notNull()
		.references(() => worlds.id),
	entityId: text('entity_id')
		.notNull()
		.references(() => entities.id),
	currentSceneId: text('current_scene_id')
		.notNull()
		.references(() => scenes.id),
	lastActionTime: integer('last_action_time').notNull().default(0),
	isPlayer: integer('is_player', { mode: 'boolean' })
		.notNull()
		.default(false),
	config: text('config', { mode: 'json' })
		.notNull()
		.$default(() => ({}) as any)
});

// ============================================================
// 7. snapshots —— World state snapshots
// ============================================================
export const snapshots = sqliteTable('snapshots', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	worldId: text('world_id')
		.notNull()
		.references(() => worlds.id),
	tickTime: integer('tick_time').notNull(),
	worldState: text('world_state', { mode: 'json' }).notNull(),
	eventCount: integer('event_count').notNull(),
	createdAt: integer('created_at')
		.notNull()
		.$defaultFn(() => Date.now())
});

