import type { RequestHandler } from './$types';
import { playerAction } from '$lib/game/api.server';
import { z } from 'zod';
import { failure, parseZod, success } from '$lib/api.server';
import { loadGame, Person } from '$lib/game/core';
import { getGameById } from '$lib/server/db/games';

export type Resp = Awaited<ReturnType<typeof playerAction>>;

const bodySchema = z.object({
	// gameID: number, player: Person, history?: number
	game: z.number(),
	player: z.string(),
	history: z.number().optional().default(20),
});
export const POST: RequestHandler = async (req) => {
	const {
		game: gameID,
		player: playerName,
		history,
	} = await parseZod(bodySchema, req.request.json());
	const game = await getGameById(gameID);
	if (!game) return failure(`游戏不存在`);

	const player = game.findObj((o): o is Person => o instanceof Person && o.name === playerName);
	if (!player) return failure(`玩家不存在`);

	try {
		const data = await playerAction(gameID, player, history);
		return success(data);
	} catch (e) {
		failure(`执行动作失败: ${e}`);
	}
};
