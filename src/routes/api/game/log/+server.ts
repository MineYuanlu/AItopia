import type { RequestHandler } from './$types';
import { z } from 'zod';
import { parseZod, success } from '$lib/api.server';
import { loadLogs } from '$lib/server/db/games';

export type Resp = Awaited<ReturnType<typeof loadLogs>>;

const querySchema = z.object({
	game: z.coerce.number(),
	target: z.string().optional(),
	getTo: z.coerce.boolean().optional().default(false),
	cursor: z.coerce.number().min(0).optional(),
	limit: z.coerce.number().min(1).max(1000).optional().default(100),
});
export const GET: RequestHandler = async (req) => {
	const { game, target, getTo, cursor, limit } = await parseZod(querySchema, req.url.searchParams);

	const resp = await loadLogs(game, target ?? null, getTo, limit, cursor);
	return success(resp);

	// const game = await getGameById(gameID);
	// if (!game) return failure(`游戏不存在`);

	// const player = game.findObj((o): o is Person => o instanceof Person && o.name === playerName);
	// if (!player) return failure(`玩家不存在`);

	// try {
	// 	const data = await playerAction(gameID, player, history);
	// 	return success(data);
	// } catch (e) {
	// 	failure(`随机生成属性失败: ${e}`);
	// }
};
