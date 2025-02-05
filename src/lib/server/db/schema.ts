import type { EnvSerialized } from '$lib/game/core';
import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';

export const game = sqliteTable('game', {
	id: integer().primaryKey({ autoIncrement: true }).notNull(), // 游戏ID
	data: text({ mode: 'json' }).$type<EnvSerialized>().notNull(), // 游戏阶段
});
export type Game = typeof game.$inferSelect;

export const log = sqliteTable(
	'log',
	{
		id: integer().primaryKey({ autoIncrement: true }).notNull(), // 日志ID
		game: integer()
			.notNull()
			.references(() => game.id), // 所属游戏ID
		time: integer().notNull(), // 日志时间
		type: text().notNull(), // 日志类型
		src: text().notNull(), // 日志来源
		msg: text().notNull(), // 日志内容
	},
	(table) => [index('game_idx').on(table.game)],
);
export type Log = typeof log.$inferSelect;

export const logTarget = sqliteTable(
	'log_target',
	{
		id: integer()
			.notNull()
			.references(() => log.id), // 日志ID
		target: text().notNull(), // 日志目标
	},
	(table) => [
		index('log_target_idx').on(table.id),
		primaryKey({ columns: [table.id, table.target] }),
	],
);
