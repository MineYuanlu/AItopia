import * as t from './schema';
import * as core from '$lib/game/core';
import { and, desc, eq, exists, gte, inArray, lt, ne, or, sql, like, gt } from 'drizzle-orm';
import { db } from './index';

export async function getGameById(id: number) {
	const ret = await db
		.select({ data: t.game.data })
		.from(t.game)
		.where(eq(t.game.id, id))
		.execute();
	return ret.length > 0 ? core.loadGame(ret[0].data) : null;
}
export async function saveGame(id: number | undefined, game: core.GameScene | core.EnvSerialized) {
	if (game instanceof core.GameScene) game = game.serialize();
	const ret = await db
		.insert(t.game)
		.values({ id, data: game })
		.onConflictDoUpdate({ target: t.game.id, set: { data: game } })
		.execute();
	return ret.changes > 0;
}

/**
 * 加载日志
 * @param gameId 游戏ID
 * @param target 日志目标
 * @param limit 日志数量
 * @param cursor 游标
 * @returns 日志列表和游标
 */
export async function loadLogs(
	gameId: number,
	target: string | null = null,
	withTarget: boolean = false,
	limit: number = 40,
	cursor: number | null = null,
): Promise<{
	logs: {
		id: number;
		time: number;
		type: string;
		src: string;
		msg: string;
		target?: string[];
	}[];
	cursor: number | null;
}> {
	let sql = db
		.select({
			id: t.log.id,
			time: t.log.time,
			type: t.log.type,
			src: t.log.src,
			msg: t.log.msg,
		})
		.from(t.log);
	if (target !== null) {
		sql = sql.innerJoin(
			t.logTarget,
			and(eq(t.logTarget.id, t.log.id), eq(t.logTarget.target, target)),
		) as any;
	}
	const logs = await sql
		.where(
			cursor === null ? eq(t.log.game, gameId) : and(eq(t.log.game, gameId), gt(t.log.id, cursor)),
		)
		.orderBy(desc(t.log.id))
		.limit(limit)
		.execute();
	if (withTarget) {
		const targets = await db
			.select({
				id: t.logTarget.id,
				t: t.logTarget.target,
			})
			.from(t.logTarget)
			.where(
				inArray(
					t.logTarget.id,
					logs.map(({ id }) => id),
				),
			);
		(logs as ((typeof logs)[number] & { target: string[] })[]).forEach((log) => (log.target = []));
		const idxMap = new Map(logs.map(({ id }, idx) => [id, idx]));
		targets.forEach(({ id, t }) => {
			(logs[idxMap.get(id)!] as (typeof logs)[number] & { target: string[] }).target.push(t);
		});
	}
	cursor = logs.length > 0 ? logs[logs.length - 1].time : null;
	return { logs, cursor };
}

export async function addLog(
	gameId: number,
	time: number | Date,
	type: string,
	src: string,
	msg: string,
) {
	const ret = await db
		.insert(t.log)
		.values({ game: gameId, time: time instanceof Date ? time.getTime() : time, type, src, msg })
		.execute();
	return ret.changes > 0;
}
