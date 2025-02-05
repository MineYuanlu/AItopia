import { z } from 'zod';

type AttrTypes = {
	str: string;
	str_arr: string[];
	int: number;
	bool: boolean;
	arr: any[];
};
export type AttrDesc2<T extends keyof AttrTypes = keyof AttrTypes> = {
	type: T;
	example: AttrTypes[T]; // 样例值
	desc: string; // 描述
	range?: string; // 值范围
	summon?: string; // 首次生成规则
	init?: AttrTypes[T] | (() => AttrTypes[T]); // 初始值, 如果有此字段则不会让AI生成初始值, 而是使用此值
	edit?: string; // 修改规则
	zod?: z.ZodType<AttrTypes[T]>; // 用于校验属性值, 若不指定则使用类型默认校验
};

export type AttrDescArr<Key extends string = string> = [Key, AttrDesc2][];

const zod_str2int = z
	.string()
	.refine((s) => /^[+-]?\d+$/.test(s), { message: '请输入整数' })
	.transform((s) => parseInt(s));

export const zods = {
	str: z.string(),
	str_arr: z.array(z.string()),
	int: z.union([z.number(), zod_str2int]),
	bool: z.union([
		z.boolean(),
		z
			.string()
			.transform((s) => s.toLowerCase())
			.refine((s) => s.includes('t') || s.includes('f') || s.includes('y') || s.includes('n'), {
				message: '请输入true/false/yes/no',
			})
			.transform((s) => s.includes('t') || s.includes('y')),
		zod_str2int.transform((n) => !!n),
	]),
	arr: z.array(z.any()),
} as const satisfies Record<keyof AttrTypes, z.ZodType<any>>;

/** 目标类型是否使用json格式保存 */
export const jsonable_attr_type = {
	str: false,
	str_arr: true,
	int: false,
	bool: false,
	arr: true,
} as const satisfies Record<keyof AttrTypes, boolean>;

function attr_to_zod<Attr extends Record<string, AttrDesc2>>(attr: Attr) {
	const summon_attrs: Record<string, z.ZodType> = {};
	for (const key in attr) {
		const { init, zod, type } = attr[key];
		if (init === undefined) {
			summon_attrs[key] = zod || zods[type];
		} else {
			summon_attrs[key] = z
				.any()
				.optional()
				.transform(() => init);
		}
	}
	return {
		summon: z.object(
			summon_attrs as {
				[K in keyof Attr]: 'init' extends keyof Attr[K] // 有init
					? undefined extends Attr[K]['init'] // 但是init为undefined
						? Attr[K]['zod'] extends z.ZodType // 有zod
							? Attr[K]['zod'] // 用自定义zod
							: (typeof zods)[Attr[K]['type']] // 用默认zod
						: z.ZodType<Attr[K]['init']> // 有init并且init不是undefined, 则用init的类型
					: Attr[K]['zod'] extends z.ZodType
						? Attr[K]['zod']
						: (typeof zods)[Attr[K]['type']];
			},
		),
	};
}

export const person_attr = {
	名称: {
		type: 'str',
		example: '张三',
		desc: '人名',
		summon: '任意人名即可(符合人名规范)',
		edit: '大部分情况下不能修改',
	},
	性别: { type: 'str', example: '男', desc: '性别', range: '男/女', edit: '不能修改' },
	生日: {
		type: 'str',
		example: '2000-01-01',
		desc: '生日',
		summon: `当前年份:${new Date().getFullYear()}, 依据此推算`,
		edit: '不能修改',
		zod: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	},
	身高: { type: 'int', example: 170, desc: '身高', range: 'cm', edit: '极难修改' },
	体重: { type: 'int', example: 70, desc: '体重', range: 'kg', edit: '锻炼/事件修改' },
	智商: { type: 'int', example: 80, desc: '智商', range: '百分制', edit: '极难修改/大事件修改' },
	体力: { type: 'int', example: 100, desc: '体力', range: '百分制,最大100', edit: '锻炼/事件修改' },
	幸运: { type: 'int', example: 50, desc: '幸运', range: '百分制,最大100', edit: '事件修改' },
	性格: { type: 'str_arr', example: ['开朗', '善解人意'], desc: '性格词条', edit: '大事件修改' },
	职业: {
		type: 'str',
		example: '程序员, 朝九晚五双休, 较轻松',
		desc: '职业的详细描述',
		edit: '事件修改',
	},
	// 资产: {
	// 	type: 'int',
	// 	example: 100000,
	// 	desc: '当前资产',
	// 	range: '任意整数, 负数代表负债',
	// 	summon: '符合用户设定的初始资产',
	// 	edit: '事件修改',
	// },
	爱好: {
		type: 'str_arr',
		example: ['滑雪', 'FPS游戏'],
		desc: '爱好词条',
		summon: '和身份相关的爱好词条',
		edit: '事件修改',
	},
	技能: {
		type: 'str_arr',
		example: ['编程'],
		desc: '技能词条',
		summon: '和身份相关的技能词条',
		edit: '学习/事件修改',
	},
	身世: {
		type: 'str',
		example: '北京人, 家境富裕',
		desc: '身世描述, 代表此人的家庭背景',
		range: '符合设定的身世描述',
		edit: '不能修改',
	},
	大记忆: {
		type: 'str_arr',
		example: ['我的领导不错'],
		desc: '大记忆列表, 代表一些重要的事件或事情',
		range: '此人的任意记忆',
		edit: '较难修改, 只有大事件才会修改',
	},
	小记忆: {
		type: 'str_arr',
		example: ['今天工作好多'],
		desc: '小记忆列表, 是一些临时性的事情, 也是思考产物',
		range: '此人的任意记忆',
		summon: '应仅与搬家事件相关, 搬家之前的统一不记录',
		edit: '极易修改, 任何事情都有可能修改记忆',
	},
	情绪: {
		type: 'str',
		example: '平静',
		desc: '此人实时情绪状态',
		edit: '视用户自身情况修改',
	},
	// 健康: {
	// 	type: 'int',
	// 	example: 100,
	// 	desc: '此人健康状况, 百分制',
	// 	range: '0-100',
	// 	init: 100,
	// 	edit: '视用户自身情况修改',
	// },
	饥饿: {
		type: 'int',
		example: 0,
		desc: '此人饥饿程度, 百分制',
		range: '0-100',
		init: 0,
		edit: '视用户自身情况修改',
	},

	test: {
		type: 'arr',
		example: [1, 2, 3],
		desc: '测试属性',
		init: [],
	},
	// 关系: {
	// 	type: 'arr',
	// 	example: [
	// 		{
	// 			name: '李四',
	// 			rel: '好友',
	// 			desc: '他是我一个关系不错的好友',
	// 			stat: '今晚找他吃饭',
	// 		},
	// 	],
	// 	desc: '与其他人关系的完整情况, name代表关系人, rel代表关系类型, desc代表关系的大致描述, stat代表一些临时的信息',
	// 	range:
	// 		'name:全局内其他人名, rel:好友/同事/朋友/敌人/爱慕/憎恨等等任意关系类型, desc:关系详细描述,对对方的整体评价, stat:临时信息, 有关他的一些信息',
	// 	summon: '初始应为空, 没有任何人的关系, 随着游戏进行逐渐添加关系',
	// 	edit: '视交互修改, 可以增加/减少关系, 可以修改关系类型、描述、临时信息',
	// },
} as const satisfies Record<string, AttrDesc2>;

export const person_attr_zod = attr_to_zod(person_attr);

export const house_attr = {
	名称: {
		type: 'str',
		example: '幸福小区203',
		desc: '房子名称',
		range: '任意房子的名称',
		summon: '符合设定的房子名称',
		edit: '不能修改',
	},
	地址: {
		type: 'str',
		example: '北京市海淀区西二旗',
		desc: '房子地址',
		range: '任意房子的地址',
		summon: '符合设定的房子地址',
		edit: '不能修改',
	},
	面积: {
		type: 'int',
		example: 200,
		desc: '房子面积',
		range: '平方米',
		summon: '符合设定的房子面积',
		edit: '不能修改',
	},
	户型: {
		type: 'str',
		example: '4室2厅1厨1卫',
		desc: '房子户型, 包括所有房间类型及数量',
		range: '任意房型',
		summon: '符合设定的户型, 用户可能只指定关键的房间, 你需要给出一套房屋所需要的所有房间',
		edit: '不能修改',
	},
	朝向: {
		type: 'str',
		example: '南',
		desc: '房子朝向',
		range: '南/北/东/西/等方向值',
		summon: '符合设定的朝向',
		edit: '不能修改',
	},
	描述: {
		type: 'str',
		example: '一个精致的小区, 房子整体看起来很干净, 居住环境很好',
		desc: '房子描述, 代表房子特点',
		range: '合理的房子描述',
		summon: '详细描述, 包括房子的特点、居住环境、周围的配套等, 配合前面的字段, 合理即可',
		edit: '在一些重大事件时可修改',
	},
	房间: {
		type: 'arr',
		example: [],
		desc: '房间列表, 代表房子内所有房间信息',
		// summon: '由后续对话生成, 直接给出[]即可',
		init: [],
		edit: '不能修改',
	},
} as const satisfies Record<string, AttrDesc2>;

export const house_attr_zod = attr_to_zod(house_attr);

export const room_attr = {
	房子: {
		type: 'str',
		example: '幸福小区203',
		desc: '所属房子名称',
		summon: '要和给出的房子名称一致',
		edit: '不能修改',
	},
	名称: {
		type: 'str',
		example: '卧室1',
		desc: '房间名称',
		summon: '和户型中提到的一致, 同一类房间用数字区分',
		edit: '不能修改',
	},
	位置: {
		type: 'str',
		example: '东南角',
		desc: '房间位置, 在房子内何处',
		range: '方向值',
		summon: '要考虑所有房间的布局合理',
		edit: '不能修改',
	},
	描述: {
		type: 'str',
		example: '一个精致的卧室, 宽敞明亮',
		desc: '房间描述',
		summon: '对房间的特点进行描述, 方便用户理解和家具生成',
		edit: '不能修改',
	},
	物品: {
		type: 'arr',
		example: [],
		desc: '物品列表, 代表房间内所有物品信息',
		// summon: '由后续对话生成, 直接给出[]即可',
		init: [],
		edit: '不能修改',
	},
} as const satisfies Record<string, AttrDesc2>;

export const room_attr_zod = attr_to_zod(room_attr);

export const furniture_attr = {
	房间: {
		type: 'str',
		example: '卧室1',
		desc: '所属房间名称',
		summon: '要和给出的房间名称一致',
		edit: '不能修改',
	},
	名称: {
		type: 'str',
		example: '双人床',
		desc: '物品名称',
		edit: '不能修改',
	},
	数量: { type: 'int', example: 1, desc: '物品数量', edit: '不能修改' },
	分布: {
		type: 'str',
		example: '房间正中央',
		desc: '物品分布',
		range: '方位+分布情况(大于1个的)',
		edit: '不能修改',
	},
	描述: {
		type: 'str',
		example: '精致的白色的双人床,  非常舒服',
		desc: '物品描述',
		summon: '对物品的描述, 包括品质、大小、形状、功能等任何描述, 方便用户理解和家具生成',
		edit: '不能修改',
	},
} as const satisfies Record<string, AttrDesc2>;

export const furniture_attr_zod = attr_to_zod(furniture_attr);
