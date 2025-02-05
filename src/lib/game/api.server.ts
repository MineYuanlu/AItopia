// import { sendRequest } from "../api/deepseek_online";
import type { RequestData, ResponseData } from '$lib/server/model/def';
import { sendRequest as _sendRequest1 } from '$lib/server/model/deepseek_console';
import { sendRequest as _sendRequest2 } from '$lib/server/model/deepseek_ollama';
import {
	type AttrDesc2,
	furniture_attr,
	furniture_attr_zod,
	house_attr,
	house_attr_zod,
	person_attr,
	person_attr_zod,
	room_attr,
	room_attr_zod,
} from './attrs';
import { z } from 'zod';
import { Person, PersonRelation } from './core';
import { loadLogs } from '$lib/server/db/games';
import { get_time_str } from '$lib/utils';
import type { P } from 'vitest/dist/chunks/environment.d8YfPkTm.js';
import { Command } from './llm';

/**
 * 构造属性字段的提示信息
 * @param fields 属性字段定义
 */
function makeField2Prompt(fields: Record<string, AttrDesc2>): string[] {
	return [
		'以下是各个字段的详细说明:',
		...Object.entries(fields)
			.map(([name, { type, example, desc, range, init, summon }]) => {
				if (init) return undefined;
				let msgs = [`字段: ${name}`];
				if (type) msgs.push(`类型: ${type}`);
				if (example) msgs.push(`样例: ${JSON.stringify(example)}`);
				if (desc) msgs.push(`描述: "${desc}"`);
				if (range) msgs.push(`值范围: "${range}"`);
				if (summon) msgs.push(`生成规则: "${summon}"`);
				return msgs.join('\t');
			})
			.filter((v): v is string => !!v),
	];
}

/**
 * 构造用户输入提示信息
 * @param user_input 用户要求
 * @param user_define 用户针对字段的要求
 */
function makeUserPrompt(user_input?: string, user_define?: Record<string, string>) {
	const user_prompts = [];

	const user_define_ = user_define ? Object.entries(user_define) : [];
	if (user_define_.length > 0)
		user_prompts.push('字段要求:', ...user_define_.map(([name, value]) => `${name}: ${value}`));
	if (user_input) user_prompts.push('设定要求:', user_input);
	if (user_prompts.length <= 0) user_prompts.push('没有设定要求, 你可以任意的设定属性.');
	return user_prompts;
}

/**
 * 构造修复json格式提示信息
 * @param error 错误信息
 * @param json_struct json格式要求
 */
function makeFixJsonPrompt(error: string, json_struct: string) {
	return [
		'你给出的json格式有误, 请你对照错误信息和格式要求重新输入: ',
		`错误信息: ${error}`,
		`json格式要求: ${json_struct}`,
	];
}

/**
 * LLM后处理
 * @param data 原始数据
 * @param lint JSON Schema校验器
 * @returns 后处理结果
 */
function getJsonResp(
	data: ResponseData,
	lint: z.ZodType<any>,
):
	| {
			success: false;
			error: string;
			data?: never;
	  }
	| {
			success: true;
			data: any;
			error?: never;
	  } {
	let msg = data.message.content.trim();
	msg = ['think', 'desc'].reduce((msg, skip) => {
		if (!msg.startsWith(`<${skip}>`)) return msg;
		const end = msg.indexOf(`</${skip}>`);
		if (end < 0) return msg;
		return msg.substring(end + `</${skip}>`.length).trimStart();
	}, msg);
	let obj: any;
	try {
		obj = JSON.parse(msg);
	} catch (e1) {
		let start_key;
		let idx_start = msg.indexOf((start_key = '```json'));
		if (idx_start < 0) idx_start = msg.indexOf((start_key = '```'));
		if (idx_start < 0) return { success: false, error: `不是一个有效的json: ${e1}` };
		let idx_end = msg.indexOf('```', idx_start + start_key.length);
		if (idx_end < 0) idx_end = msg.length;
		msg = msg.substring(idx_start + start_key.length, idx_end).trim();
		try {
			obj = JSON.parse(msg);
		} catch (e2) {
			return { success: false, error: `不是一个有效的json: ${e2}` };
		}
	}
	const ret = lint.safeParse(obj);
	if (!ret.success) {
		const msg = ret.error.issues
			.map(({ path, message, code, ...extra }) => {
				return `[${path.join('.')}]: ${message || code} ${JSON.stringify(extra)}`;
			})
			.join('\n');
		return {
			success: false,
			error: `json schema校验失败: ${msg}`,
		};
	}
	return { success: true, data: ret.data };
}

async function sendCommonRequest(req: RequestData) {
	req = {
		...req,
		messages: [
			{
				role: 'user',
				content: req.messages.map(({ role, content }) => `<${role}>\n ${content}\n </${role}>\n`).join('\n'),
			},
		],
		temperature: req.temperature ?? 0.5,
		presence_penalty: req.presence_penalty ?? 1,
		seed: req.seed ?? Number(Math.random().toString().substring(2)),
	};
	return { req, resp: await _sendRequest2(req) };
	// return _sendRequest1({
	//   model: "deepseek-chat",
	//   response_format: { type: "json_object" },
	//   temperature: 2,
	//   ...(data as any),
	// });
}

async function sendJsonRequest<O = any, D extends z.ZodTypeDef = z.ZodTypeDef, I = O>(
	data: RequestData,
	lint: z.ZodType<O, D, I>,
	json_struct: string,
	retry = 3,
): Promise<
	| {
			success: true;
			parsed: z.infer<z.ZodType<O, D, I>>;
			error?: never;
			req: RequestData;
			resp: ResponseData;
	  }
	| {
			success: false;
			parsed?: never;
			error: string;
			req: RequestData;
			resp: ResponseData;
	  }
> {
	const { req, resp } = await sendCommonRequest(data);
	const check_ret = getJsonResp(resp, lint);
	if (check_ret.success) return { success: true, parsed: check_ret.data, req: req, resp: resp };
	else return { success: false, error: check_ret.error, req: req, resp: resp };
	//TODO: 校验不通过新增重试
	// do{
	// 	const check_ret=	postProcess(resp, lint);
	// 	if(check_ret.success)return check_ret.data;
	// }while(retry-- > 0 && !check_ret.success);
}

export const zRandomPersonResp = z.object({
	result: z.array(person_attr_zod.summon.extend({ desc: z.string().optional() })),
});
export async function randomPersionAttr(user_input?: string, user_define?: Record<string, string>) {
	const json_struct = '{"think": "思考内容", "result": {"字段1": "值1", "字段2": "值2", ... , "desc": "描述" }[]}';
	const system_prompts = [
		'用户正在创建《模拟人生》游戏的玩家属性设置',
		'你需要根据用户输入的信息，随机地给出[三套]符合用户设定要求的玩家属性, 要求属性合理, 每套之间在要求范围内差异尽可能大. ',
		'你的回复应该是一个纯json内容, 不需要有任何markdown内容或对json格式化',
		`json格式形如: ${json_struct}`,
		'其中:',
		'think是你对用户需求的一些思考, 不会展示给用户, 仅用于你自己参考. ',
		'result每一项是一套属性设置. ',
		'desc是对用户说的话, 表明生成这套配置的原因',
		'',
		'请注意: 不要直接使用样例值! 你必须仔细思考, 这些设定非常重要!',
		'提到的每一个字段都是必须的, 请你务必仔细阅读并理解, 否则可能导致游戏无法正常运行. ',
		"新创建的玩家将以'搬入新的合租房间'的方式来到游戏中, 玩家创建后会立马开始搬到新家的剧情, 你需要在情绪或记忆中体现这点",
		'',
		...makeField2Prompt(person_attr),
	].join('\n');
	const user_prompts = makeUserPrompt(user_input, user_define).join('\n');
	return await sendJsonRequest(
		{
			messages: [
				{ role: 'system', content: system_prompts },
				{ role: 'user', content: user_prompts },
			],
		},
		zRandomPersonResp,
		json_struct,
	);
}

const zRandomHouseResp = z.object({
	result: house_attr_zod.summon,
	desc: z.string(),
	tip: z.string().optional(),
});
export async function randomHouseAttr(user_input?: string, user_define?: Record<string, string>) {
	const json_struct =
		'{"think": "思考内容", "result": {"字段1": "值1", "字段2": "值2", ... }, "desc": "描述", "tip": "提示信息"}';
	const system_prompts = [
		'用户正在创建《模拟人生》游戏的房屋属性设置',
		'你需要根据用户输入的信息，随机地给出[一套]符合用户设定要求的房屋属性, 要求属性合理, 结果以json格式呈现',
		`json格式形如: ${json_struct}`,
		'其中:',
		'think是你对用户需求的一些思考, 不会展示给用户, 仅用于你自己本次生成参考. ',
		'result是一套房屋属性设置. ',
		'desc是对用户说的话, 表明生成这套配置的原因',
		'tip是一些你给你自己的提示信息, 用于给你自己后续生成房间时提供参考, 表明你对房间的理解即可',
		'',
		'请注意: 不要直接使用样例值! 你必须仔细思考, 这些设定非常重要!',
		'提到的每一个字段都是必须的, 请你务必仔细阅读并理解, 否则可能导致游戏无法正常运行. ',
		'你要确保参数合理, 尤其是面积和户型之间的关系, 否则可能导致房屋建筑质量不佳',
		...makeField2Prompt(house_attr),
	].join('\n');
	const user_prompts = makeUserPrompt(user_input, user_define).join('\n');
	return await sendJsonRequest(
		{
			messages: [
				{ role: 'system', content: system_prompts },
				{ role: 'user', content: user_prompts },
			],
		},
		zRandomHouseResp,
		json_struct,
	);
}

const zRandomRoomResp = z.object({
	result: z.array(room_attr_zod.summon),
	desc: z.string().optional(),
	fail: z.boolean().optional(),
	tip: z.string().optional(),
});
export async function randomRoomAttr(
	house_info: Record<string, any>,
	tip?: string,
	user_input?: string,
	user_define?: Record<string, string>,
) {
	const json_struct =
		'{"think": "思考内容", "result": {"字段1": "值1", "字段2": "值2", ... }[], "desc": "整体描述", "fail"?: true, "tip": "提示信息"}';
	const system_prompts = [
		'用户正在创建《模拟人生》游戏的房间属性设置',
		'你刚刚帮助用户生成了房屋属性, 现在需要你根据用户输入的信息, 针对房屋的信息生成各个房间, 要求属性合理, 结果以json格式呈现',
		`json格式形如: ${json_struct}`,
		'其中:',
		'think是你对用户需求的一些思考, 不会展示给用户, 仅用于你自己本次生成参考. ',
		'result是每个房间的属性设置(仅含房间本身的信息, 不包括房屋和家具信息). ',
		'desc是对用户说的话, 表明生成这套配置的原因',
		'tip是一些你给你自己的提示信息, 用于给你自己后续生成房间内物品时提供参考, 表明你对房间的理解即可',
		'若你发现房屋信息明显不合理, 无法生成正常的房间信息, 请你在desc中说明, 并在desc后添加"fail":true字段',
		'',
		'请注意: 不要直接使用样例值! 你必须仔细思考, 这些设定非常重要!',
		'提到的每一个字段都是必须的, 请你务必仔细阅读并理解, 否则可能导致游戏无法正常运行. ',
		'你要确保参数合理, 尤其是面积等信息, 确保能容纳下正常的家具, 否则可能导致房屋建筑质量不佳',
		...makeField2Prompt(room_attr),
	].join('\n');
	const user_prompts = makeUserPrompt(user_input, user_define).join('\n');
	return await sendJsonRequest(
		{
			messages: [
				{
					role: 'assistant',
					content: `房屋信息: ${JSON.stringify(house_info)}${tip ? `\n提示: ${tip}` : ''}`,
				},
				{ role: 'system', content: system_prompts },
				{ role: 'user', content: user_prompts },
			],
		},
		zRandomRoomResp,
		json_struct,
	);
}

const zRandomFurnitureResp = z.object({
	result: z.array(furniture_attr_zod.summon),
	desc: z.string().optional(),
	fail: z.boolean().optional(),
	tip: z.string().optional(),
});
export function randomFurnitureAttr(
	house_info: Record<string, any>,
	room_info: Record<string, any>,
	user_input?: string,
	user_define?: Record<string, string>,
) {
	const json_struct =
		'{"think": "思考内容", "result": {"字段1": "值1", "字段2": "值2", ... }, "desc": "描述", "fail"?: true}';
	const system_prompts = [
		'用户正在创建《模拟人生》游戏的家具属性设置',
		'你刚刚帮助用户生成了房屋和房间信息, 现在需要你根据用户输入的信息, 针对房屋和房间的信息生成家具, 要求属性合理, 结果以json格式呈现',
		`json格式形如: ${json_struct}`,
		'其中:',
		'think是你对用户需求的一些思考, 不会展示给用户, 仅用于你自己参考. ',
		'result是一套房屋属性设置. ',
		'desc是对用户说的话, 表明生成这套配置的原因',
		'若你发现房屋信息明显不合理, 无法生成正常的房间信息, 请你在desc中说明, 并在desc后添加"fail":true字段',
		'',
		'请注意: 不要直接使用样例值! 你必须仔细思考, 这些设定非常重要!',
		'提到的每一个字段都是必须的, 请你务必仔细阅读并理解, 否则可能导致游戏无法正常运行. ',
		'你要确保参数合理, 尤其是面积等信息, 确保能容纳下正常的家具, 否则可能导致房屋建筑质量不佳',
		...makeField2Prompt(furniture_attr),
	].join('\n');
	const user_prompts = makeUserPrompt(user_input, user_define).join('\n');
	sendJsonRequest(
		{
			messages: [
				{ role: 'assistant', content: `房屋信息: ${JSON.stringify(house_info)}` },
				{ role: 'assistant', content: `房间信息: ${JSON.stringify(room_info)}` },
				{ role: 'system', content: system_prompts },
				{ role: 'user', content: user_prompts },
			],
		},
		zRandomFurnitureResp,
		json_struct,
	);
}

const playerActionCmds = [
	new Command('对话', ['对方名称', '对话内容'], "这将会和目标对话, 会有时间流逝, 多人对话使用','分割"),
	new Command(
		'思考',
		['思考内容'],
		'你的思考过程, 会以日志形式被你记住一段时间, 思考是瞬时的, 不会有时间流逝, 不会影响世界',
	),
	new Command(
		'交互',
		['交互物体', '交互动作'],
		'这将会触发交互功能，例如打开/关闭门, 拿起锅, 打开抽屉等. 立即操作不会触发时间流逝; ',
	),
	new Command('移动', ['目的地'], '这是一种特殊的交互, 可以让你移动位置, 例如 `移动 走出卧室`或者`移动 去公司`'),
	new Command(
		'查看',
		['查看物体'],
		'这将会触发查看功能，例如查看房间内的物品，你会得到物品的详细信息; 查看是瞬时操作, 不会触发时间流逝',
	),
	new Command(
		'长期记忆',
		['记忆内容'],
		'这将会触发记忆功能，你会记住一件事, 不会随着日志滚动而消失; 记忆是瞬时操作, 不会触发时间流逝, 不会影响世界; 记住一些大事情',
	),
	new Command(
		'临时记忆',
		['记忆内容'],
		'这将会触发记忆功能，你会记住一件事, 不会随着日志滚动而消失; 记忆是瞬时操作, 不会触发时间流逝, 不会影响世界; 你可以非常频繁的修改临时记忆',
	),
	// 查看记忆
	new Command(
		'设置关系',
		['目标', '关系', '描述'],
		'一种特殊记忆, 你会记住一个人的信息, 所有你对一个人的了解都应该写在描述中; **特别地: 如果你只想新增描述, 则在描述中包含: <old> 可以代替原有描述 **',
	),
	new Command('关系描述', ['目标', '描述'], '类似于设置关系, 但是仅新增一些新的描述, 不修改关系, 不删除旧的描述'),
	new Command(
		'查看关系',
		[],
		'你会得到你自己记忆中所有人的关系信息; 查看关系是瞬时操作, 不会触发时间流逝, 不会影响世界',
	),
	// new Command(
	// 	'设置',
	// 	['设置物体', '设置属性', '设置值'],
	// 	'这将会触发设置功能，例如设置房屋的名称，设置房屋的窗户颜色等',
	// ),
	new Command('其它', ['指令'], '如果你需要一些上述功能之外的功能, 请你在指令前加上`其它: `; 系统会理解你的任何需求'),
];

export async function playerAction(gameID: number, player: Person, history: number = 20) {
	const time = player.game.getTime();
	const name = player.name;
	const location = player.location.length > 0 ? player.location.join('->') : '非建筑内';
	const objs = [...player.env.obj_dynamic, ...player.env.obj_static];
	const obj_names = objs
		.map((obj) => {
			if (obj instanceof Person) return `玩家: ${obj.name}`;
			return obj.name;
		})
		.join(', ');
	const person_relations = objs
		.filter((obj) => obj instanceof Person)
		.map((obj) => player.getRelation(obj.name))
		.filter((r): r is PersonRelation => !!r)
		.map((r) => `[${r.target}] ${r.rel}: ${r.desc}`);

	const all_scenes = player.game.all_env.map((e) => e.location.join('->')).join(', ');

	const log_ret = await loadLogs(gameID, player.name, false, history);
	const logs = log_ret.logs.map(({ time, type, src, msg }) => `[${get_time_str(time)}] [${type}] ${src}: ${msg}`);
	const system_prompts = [
		`你现在的身份是一名《模拟人生》的玩家，请你结合下方的日志记录, 将自己带入角色, 做出当前最佳的响应, `,
		'你的响应必须是下面的命令中的一个或多个, 并且至少包含一个对游戏世界有影响(比如对话/交互)或有反馈(比如查看)的动作, 不能只包含思考之类的无意义内容',
		'开头写出关键字是必须的, 每个命令独占一行, 参数值不能包含换行, 参数之间用空格隔开: ',
		...playerActionCmds.map((cmd) => cmd.toString()),
		// '对话: `对话 <对方名称> <对话内容>` ; 这将会触发和对方对话',
		// '思考: `思考 <你的思考内容>` ; 这不会触发任何功能，仅用于你自己思考, 思考是立即的, 不会有时间流逝',
		// '交互: `交互 <交互物体> <交互动作>` ; 这将会触发交互功能，例如打开/关闭门, 拿起锅, 打开抽屉等, 立即操作不会触发时间流逝; ',
		// '移动: `移动 <目的地>` ; 这是一种特殊的交互, 可以让你移动位置, 例如 `移动\\n走到客厅`或者`移动\\n去公司`',
		// '查看: `查看 <查看物体>` ; 这将会触发查看功能，例如查看房间内的物品，你会得到物品的详细信息; 查看是立即操作, 不会触发时间流逝',
		// '长期记忆/临时记忆: `长期记忆/临时记忆: <记忆内容>` ; 这将会触发记忆功能，你会记住一件事, 不会随着日志滚动而消失; 记忆是立即操作, 不会触发时间流逝',
		// // 查看记忆
		// '设置关系: `关系 <目标> <关系> <描述>` ; 一种特殊记忆, 你会记住一个人的信息, 所有你对一个人的了解都应该写在描述中; **特别地: 如果你只想新增描述, 则在描述中包含: <old> **',
		// '全部关系: `查看关系` ; 你会得到你自己记忆中所有人的关系信息; 查看关系是立即操作, 不会触发时间流逝',
		// // '设置: `设置: <设置物体> <设置属性> <设置值>` ; 这将会触发设置功能，例如设置房屋的名称，设置房屋的窗户颜色等',
		// '其它: `其它: <指令>` ; 如果你需要一些上述功能之外的功能, 请你在指令前加上`其它: `; 系统会理解你的任何需求',
		'提示: 如果你要记住一些事情，请使用记忆或设置关系，日志会刷新的很快，你会很快忘记',
	].join('\n');
	const data_prompts = [
		'日志记录:',
		...logs,
		'',
		'你的数据信息:',
		`身份: ${JSON.stringify(player.attr)}`,
		`时间: [${time}], 位置: [${location}], 环境内容: [${obj_names}]`,
		`全部场景: [${all_scenes}]`,
		// `大记忆: ${player.long_term_memory}`, TODO
		'',
		'环境内的关系:',
		...person_relations,
	].join('\n');
	const strong_prompts = [
		`1. 你不再是一个旁观者，而是直接成为角色本身。所有思考都应以第一人称视角进行，用"我"而不是"${name}"来指代自己`,
		'2. 思考过程应自然呈现角色的即时心理活动，避免使用分析性语言（如"应该""需要""可能"等）',
		'3. 你需要根据角色背景深度演绎, 你的思考就是角色的自然内心独白',
	].join('\n');

	return await sendCommonRequest({
		messages: [
			{ role: 'system', content: system_prompts },
			{ role: 'user', content: data_prompts },
			{ role: 'system', content: strong_prompts },
		],
	});
}
export function playerJudgeAction(action: string) {
	const system_prompts = [
		'玩家正在执行以下操作, 请你检查是否合理',
		'如果合理, 请你为玩家执行对应的功能',
		'如果不合理, 请你告诉玩家原因',
	];
}
// eventJudgeAction(action: string)
// eventAction(reason: string)
