/**
 * Prompt builder for Agent operations.
 * Builds structured prompts for LLM-based character generation and decision-making.
 */
import type { LLMRequest, LLMMessage } from './client';
import type { AgentPerception } from '../game/types';

/**
 * Field descriptor for attribute definitions.
 * Mirrors the AttrDesc pattern from chat-prompt.md:
 * [type, example, description, range]
 */
type FieldDesc = readonly [string, unknown, string, string];

/** Agent attribute descriptor map. */
const agentFields: Record<string, FieldDesc> = {
	名称: ['str', '张三', '人名', '任意人名即可(符合人名规范)'],
	性别: ['str', '男', '性别', '男/女'],
	生日: ['str', '2000-01-01', '生日', '任意日期'],
	身高: ['number', 170, '身高(cm)', '150-200'],
	体重: ['number', 70, '体重(kg)', '45-120'],
	智商: ['number', 80, '智商', '百分制，最大100'],
	体力: ['number', 100, '体力', '百分制，最大100'],
	智慧: ['number', 90, '智慧', '百分制，最大100'],
	幸运: ['number', 50, '幸运', '百分制，最大100'],
	性格: ['str_arr', ['开朗', '善解人意'], '性格词条', '性格描述词条(如: 开朗, 内向, 细心等)'],
	职业: ['str', '程序员', '职业', '任意职业'],
	爱好: ['str_arr', ['滑雪', 'FPS游戏'], '爱好词条', '和身份相关的爱好词条'],
	技能: ['str_arr', ['编程'], '技能词条', '和身份相关的技能词条'],
	身世: ['str', '北京人，家境富裕', '身世描述', '符合设定的身世描述'],
	大记忆: [
		'str_arr',
		['我的领导不错'],
		'大记忆列表',
		'代表一些重要的事件或事情, 较难修改'
	],
	小记忆: [
		'str_arr',
		['今天工作好多'],
		'小记忆列表',
		'临时性的事情，也是思考产物，极易修改'
	],
	情绪: ['str', '平静', '情绪', '情绪描述'],
	关系: [
		'arr',
		[
			{
				name: '李四',
				rel: '好友',
				desc: '他是我一个关系不错的好友',
				stat: '今晚找他吃饭'
			}
		],
		'关系数组',
		'name: 关系人, rel: 关系类型, desc: 整体评价, stat: 临时信息。初始为空'
	]
} as const;

function formatFieldPrompt(fields: Record<string, FieldDesc>): string {
	return Object.entries(fields)
		.map(
			([name, [type, example, desc, range]]) =>
				`字段: ${name}; 类型: ${type}; 样例值: ${JSON.stringify(example)}; 描述: "${desc}"; 值范围: "${range}";`
		)
		.join('\n');
}

export class PromptBuilder {
	/**
	 * Build the prompt for generating Agent personalities.
	 *
	 * @param count   Number of agent sets to generate (default 3)
	 * @param context Narrative context for the agents (default: roommates)
	 */
	static buildAgentGenerationPrompt(
		count: number = 3,
		context: string = '刚搬入合租公寓的年轻人'
	): LLMRequest {
		const systemContent = [
			'用户正在创建《模拟人生》游戏的玩家属性设置。',
			`你需要根据用户输入的信息，随机给出[${count}套]符合用户设定要求的玩家属性，要求属性合理，每套之间在要求范围内差异尽可能大。结果以JSON格式呈现。`,
			'JSON格式形如：{"think": "思考内容", "result": [{"字段1": "值1", "字段2": "值2", ...}, ...], "desc": "描述"}',
			'其中：',
			'think 是你对用户需求的一些思考，不会展示给用户，仅用于你自己参考。',
			'result 每一项是一套属性设置。',
			'desc 是对用户说的话，表明生成这套配置的原因。',
			'',
			'请注意：不要直接使用样例值！你必须仔细思考，这些设定非常重要！',
			'提到的每一个字段都是必须的，请你务必仔细阅读并理解，否则可能导致游戏无法正常运行。',
			`新创建的玩家将以'搬入新的合租房间'的方式来到游戏中，玩家创建后会立马开始搬到新家的剧情，你需要在情绪或记忆中体现这点。`,
			`用户设定背景: ${context}`,
			'',
			'以下是各个字段的详细说明：',
			formatFieldPrompt(agentFields)
		].join('\n');

		const userContent = [
			'没有设定要求，你可以任意地设定玩家属性。',
			`请生成 ${count} 套差异明显的角色设定。`
		].join('\n');

		return {
			messages: [
				{ role: 'system', content: systemContent },
				{ role: 'user', content: userContent }
			],
			model: undefined,
			temperature: 2,
			responseFormat: { type: 'json_object' }
		};
	}

	/**
	 * Build the prompt for Agent decision-making.
	 *
	 * @param agentName      The agent's name
	 * @param perception     Current world perception
	 * @param recentThoughts Recent internal thoughts (up to last N)
	 */
	static buildAgentDecisionPrompt(
		agentName: string,
		perception: AgentPerception,
		recentThoughts: string[] = []
	): LLMRequest {
		const systemContent =
			`你是《模拟人生》中的角色「${agentName}」。你正在一个虚拟世界中生活。\n` +
			`你接下来需要根据当前的环境信息，做出合理的行动决策。\n` +
			`你的输出必须是合法的JSON格式。`;

		const perceptionText = this.formatPerception(perception);
		const thoughtsText =
			recentThoughts.length > 0
				? recentThoughts.map((t, i) => `${i + 1}. ${t}`).join('\n')
				: '（暂无近期思考）';

		const userContent = [
			'--- 当前场景 ---',
			perceptionText,
			'',
			'--- 近期思考记录 ---',
			thoughtsText,
			'',
			'--- 决策要求 ---',
			'请基于以上信息，给出你的下一步行动。',
			'',
			'你必须以如下JSON格式输出（不要包含任何其他内容）：',
			JSON.stringify(
				{
					thought: '内心独白和思考过程',
					action: {
						type: 'SPEAK | MOVE | WAIT | THINK',
						target: '行动目标（说话对象、移动目的地等，可选）',
						content: '具体内容（说的话、移动方向等，可选）'
					},
					timeAdvanceSeconds: 300
				},
				null,
				2
			)
		].join('\n');

		return {
			messages: [
				{ role: 'system', content: systemContent },
				{ role: 'user', content: userContent }
			],
			model: undefined,
			temperature: 0.8,
			responseFormat: { type: 'json_object' }
		};
	}

	/**
	 * Format an AgentPerception into human-readable text.
	 */
	static formatPerception(perception: AgentPerception): string {
		const lines: string[] = [];

		// Scene
		lines.push(`场景: ${perception.currentScene.name}`);
		lines.push(`  ${perception.currentScene.description}`);
		lines.push('');

		// Visible people
		if (perception.visibleAgents.length > 0) {
			lines.push('在场的人:');
			for (const a of perception.visibleAgents) {
				lines.push(`  - ${a.name} (${a.type === 'player' ? '玩家' : 'NPC'})`);
			}
		} else {
			lines.push('在场的人: （无）');
		}
		lines.push('');

		// Visible items
		if (perception.visibleItems.length > 0) {
			lines.push('可见物品:');
			for (const item of perception.visibleItems) {
				lines.push(`  - ${item.name}`);
			}
		} else {
			lines.push('可见物品: （无）');
		}
		lines.push('');

		// Recent events
		if (perception.recentEvents.length > 0) {
			lines.push('最近发生的事:');
			for (const ev of perception.recentEvents.slice(-5)) {
				lines.push(`  [T+${ev.tickTime}s] ${ev.type}: ${JSON.stringify(ev.data).slice(0, 100)}`);
			}
		} else {
			lines.push('最近发生的事: （无）');
		}
		lines.push('');

		// Self state
		const { name, stats, memory } = perception.selfState;
		lines.push(`自身状态 —— ${name}`);
		lines.push(`  体力: ${stats.energy}/${stats.maxEnergy}`);
		lines.push(`  生命: ${stats.health}/${stats.maxHealth}`);
		if (memory.length > 0) {
			lines.push('  近期记忆:');
			for (const m of memory.slice(-3)) {
				lines.push(`    - ${m.content.slice(0, 80)}`);
			}
		} else {
			lines.push('  近期记忆: （无）');
		}

		return lines.join('\n');
	}
}
