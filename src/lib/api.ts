import type { Resp as apiGameActionPlayerResp } from '../routes/api/game/action/player/+server';
import type { Resp as apiGameLogResp } from '../routes/api/game/log/+server';
import type { Resp as apiGameSummonPersonResp } from '../routes/api/game/summon/person/+server';

async function api<Resp>(
	path: string,
	failValue: Resp,
	setting: {
		method?: 'POST' | 'GET';
		headers?: Record<string, string>;
		body?: any;
		query?: string[][] | Record<string, string> | string | URLSearchParams;
	},
): Promise<Resp> {
	const init: RequestInit = {
		method: setting.method || 'GET',
		headers: { ...setting.headers, Accept: 'application/json' },
	};
	if (setting.body !== undefined) {
		(init.headers as any)['Content-Type'] = 'application/json';
		init.body = JSON.stringify(setting.body);
	}
	if (setting.query !== undefined) {
		path += '?' + new URLSearchParams(setting.query).toString();
	}
	const resp = await fetch(path, init);
	if (!resp.ok) {
		console.error('无法访问API', path, resp.status, resp.statusText, init, resp);
		return failValue;
	}
	const resp_json = await resp.json(); // { data, code, message }
	if (typeof resp_json !== 'object') {
		console.error('API返回数据格式错误', path, resp_json, init, resp);
		return failValue;
	}
	if (resp_json.code !== 0) {
		console.error('API调用失败:', resp_json.message, path, resp_json, init, resp);
		return failValue;
	}
	return resp_json.data as Resp;
}
function makeQuery(query: Record<string, any> | any[][]): Record<string, string> | string[][] {
	if (Array.isArray(query)) {
		return (query as any[][]).map((data) => data.map((v) => v.toString()));
	} else {
		return Object.fromEntries(
			Object.entries(query)
				.filter(([_, v]) => v !== undefined)
				.map(([k, v]) => [k, `${v}`]),
		);
	}
}

/** 随机生成人物属性 */
export const apiGameSummonPerson = async (
	user_input?: string,
	user_define?: Record<string, string>,
) =>
	api<apiGameSummonPersonResp | null>('/api/game/summon/person', null, {
		method: 'POST',
		body: { user_input, user_define },
	});

export const apiGameActionPlayer = async (game: number, player: string, history: number = 20) =>
	api<apiGameActionPlayerResp | null>('/api/game/action/player', null, {
		method: 'POST',
		body: { game, player, history },
	});

export const apiGameLog = async (query: {
	game: number;
	target?: string;
	getTo?: boolean;
	cursor?: number;
	limit?: number;
}) => api<apiGameLogResp>('/api/game/log', { logs: [], cursor: 0 }, { query: makeQuery(query) });

/** 执行操作 */
export const apiGameExecStepRun = async (game_id: string) =>
	api<string | null>('/game/exec/step/run', null, {});

/** AI生成 */
export const apiGameExecStepGen = async (game_id: string) =>
	api<string | null>('/game/exec/step/gen', null, {});
