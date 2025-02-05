import { z } from 'zod';
import {
	furniture_attr,
	furniture_attr_zod,
	house_attr,
	house_attr_zod,
	person_attr,
	person_attr_zod,
	room_attr,
	room_attr_zod,
} from './attrs';
import { get_time_str } from '$lib/utils';

export type EnvSerialized = {
	type: string;
	attr: any;
	objs: ObjSerialized[];
	objd: ObjSerialized[];
	senv: EnvSerialized[];
	[key: string]: any;
};
/**
 * 一个游戏环境, 代表了一个场景, 包含了自身属性、内含物体、内含子环境等
 */
export abstract class Env<Attr extends Record<string, any> = Record<string, any>> {
	/** 游戏实例, 代表当前Env所属的游戏 */
	public game: GameScene = undefined as any;
	constructor(
		/** 环境名称 */
		public name: string,
		/** 环境属性 */
		public attr: Attr,
		/** 此环境下直接包含的静态物体 */
		public obj_static: Obj[] = [],
		/** 此环境下直接包含的动态物体 */
		public obj_dynamic: Obj[] = [],
		/** 此环境下包含的子环境 */
		public sub_env: Env[] = [],
	) {}
	/** 添加静态物体 */
	public addObjStatic(obj: Obj) {
		this.obj_static.push(obj);
		obj.reset(this.game);
	}
	/** 添加动态物体 */
	public addObjDynamic(obj: Obj) {
		this.obj_dynamic.push(obj);
		obj.reset(this.game);
	}
	/** 添加子环境 */
	public addSubEnv(env: Env) {
		this.sub_env.push(env);
		env.reset(this.game);
	}
	/** 当前环境的位置缓存 */
	private location_cache: string[] | null = null;
	/**
	 * 获取当前环境位置, 例如:
	 * - 对于Game自身,为`[]`
	 * - 对于Game下某个Env,为`[env.name]`
	 */
	public get location(): readonly string[] {
		if (this.location_cache) return this.location_cache;
		if (!this.game) throw new Error('GameScene not set');
		let envs: [Env, string[]][] = [[this.game, []]];
		while (envs.length) {
			const [env, loc] = envs.pop()!;
			if (env === this) return loc;
			envs.push(...env.sub_env.map((e): (typeof envs)[number] => [e, [...loc, e.name]]));
		}
		throw new Error('Env not found');
	}
	/** 重置环境(及所有所属元素)的结构信息 */
	public reset(game: GameScene) {
		this.game = game;
		this.obj_static.forEach((obj) => obj.reset(game));
		this.obj_dynamic.forEach((obj) => obj.reset(game));
		this.sub_env.forEach((env) => env.reset(game));
		this.location_cache = null;
	}
	public serialize(): EnvSerialized {
		return {
			type: this.constructor.name,
			attr: this.attr,
			objs: this.obj_static.map((obj) => obj.serialize()),
			objd: this.obj_dynamic.map((obj) => obj.serialize()),
			senv: this.sub_env.map((env) => env.serialize()),
		};
	}
}
export type ObjSerialized = {
	type: string;
	attr: any;
	[key: string]: any;
};
/**
 * 游戏中的物体
 */
export abstract class Obj<Attr extends Record<string, any> = Record<string, any>> {
	/** 游戏实例, 代表当前Obj所属的游戏 */
	public game: GameScene = undefined as any;
	constructor(
		/** 物体名称 */
		public name: string,
		/** 物体属性 */
		public attr: Attr,
	) {}

	/** 当前物体的位置缓存 */
	private location_cache: string[] | null = null;
	/** 当前物体的环境缓存 */
	private env_cache: Env | null = null;
	private loadCache() {
		if (!this.game) throw new Error('GameScene not set');
		let envs: [Env, string[]][] = [[this.game, []]];
		let all_location_cache: string[][] = [];
		while (envs.length) {
			const [env, loc] = envs.pop()!;
			all_location_cache.push(loc);
			if (env.obj_dynamic.some((obj) => obj === this) || env.obj_static.some((obj) => obj === this)) {
				this.location_cache = loc;
				this.env_cache = env;
				return;
			}
			envs.push(...env.sub_env.map((e): (typeof envs)[number] => [e, [...loc, e.name]]));
		}
		throw new Error('Obj not found');
	}
	/**
	 * 获取当前物体位置, 例如:
	 * - 对于Game下直接包含的Obj,为`[]`
	 * - 对于Game下某个Env内的Obj,为`[env.name]`
	 */
	public get location(): readonly string[] {
		if (!this.location_cache) this.loadCache();
		return this.location_cache!;
	}
	public get env(): Env {
		if (!this.env_cache) this.loadCache();
		return this.env_cache!;
	}
	/** 重置物体的结构信息 */
	public reset(game: GameScene) {
		this.game = game;
		this.location_cache = null;
	}
	public serialize(): ObjSerialized {
		return {
			type: this.constructor.name,
			attr: this.attr,
		};
	}
}
type SData<T extends { serialize(): any }> = {
	[K in keyof ReturnType<T['serialize']>]: ReturnType<T['serialize']>[K] extends EnvSerialized[]
		? Env[]
		: ReturnType<T['serialize']>[K] extends ObjSerialized[]
			? Obj[]
			: ReturnType<T['serialize']>[K];
};

export class GameLog {
	constructor(
		public id: number, // 日志ID
		public time: Date, // 日志时间
		public type: string, // 日志类型: 玩家/系统/事件/上帝
		public src: string, // 日志来源: 具体对象名称
		public dst: string[], // 日志目标: 多个对象名称
		public msg: string, // 日志内容
	) {}
	public serialize() {
		return {
			id: this.id,
			time: this.time.getTime(),
			type: this.type,
			src: this.src,
			dst: this.dst,
			msg: this.msg,
		};
	}
	public static deserialize(data: SData<GameLog>): GameLog {
		return new GameLog(data.id, new Date(data.time), data.type, data.src, data.dst, data.msg);
	}
}

const game_scene_attr_zod = z.object({
	name: z.string(),
});
type GameSceneAttr = z.infer<typeof game_scene_attr_zod>;
/**
 * 游戏场景, 包含了游戏内所有元素
 */
export class GameScene extends Env<GameSceneAttr> {
	public time: Date;

	constructor(
		attr: GameSceneAttr,
		obj_static: Obj[] = [],
		obj_dynamic: Obj[] = [],
		sub_env: Env[] = [],
		time: number | Date = new Date(),
		public stage: string = '待开始', // 阶段: 待开始/AI运行中/AI结束/应用中/应用结束
	) {
		super(attr.name, attr, obj_static, obj_dynamic, sub_env);
		this.time = new Date(time);
		this.reset(this);
	}
	public updateTime(sec: number) {
		this.time = new Date(this.time.getTime() + sec * 1000);
	}
	public getTime(): string {
		return get_time_str(this.time);
	}
	private all_env_cache: Env[] | null = null;
	/** 获取当前游戏场景的所有环境位置 */
	public get all_env(): Env[] {
		if (this.all_env_cache) return this.all_env_cache;
		let envs: Env[] = [this];
		for (let i = 0; i < envs.length; i++) {
			const env = envs[i];
			envs.push(...env.sub_env);
		}
		this.all_env_cache = envs.slice(1);
		return this.all_env_cache;
	}

	public findObj<T extends Obj = Obj>(finder: (o: Obj) => o is T): T | undefined;
	public findObj(finder: (o: Obj) => boolean): Obj | undefined;
	public findObj<T extends Obj = Obj>(finder: (o: Obj) => o is T): T | undefined {
		let envs: Env[] = [this];
		while (envs.length) {
			const env = envs.pop()!;
			const obj = env.obj_static.find(finder) ?? env.obj_dynamic.find(finder);
			if (obj) return obj;
			envs.push(...env.sub_env);
		}
		return undefined;
	}
	public findObjs<T extends Obj = Obj>(finder: (o: Obj) => o is T): T[];
	public findObjs(finder: (o: Obj) => boolean): Obj[];
	public findObjs<T extends Obj = Obj>(finder: (o: Obj) => o is T): T[] {
		let envs: Env[] = [this];
		let result: T[] = [];
		while (envs.length) {
			const env = envs.pop()!;
			result.push(...(env.obj_static.filter(finder) as T[]));
			result.push(...(env.obj_dynamic.filter(finder) as T[]));
			envs.push(...env.sub_env);
		}
		return result;
	}

	public resetAllEnvLocationCache() {
		this.all_env_cache = null;
	}
	public serialize() {
		return {
			...super.serialize(),
			time: this.time.getTime(),
			stage: this.stage,
		};
	}
}

export class Memory {
	constructor(
		public time: Date,
		public content: string,
	) {}
	public serialize() {
		return { t: this.time.getTime(), c: this.content };
	}
	public static deserialize(data: SData<Memory>): Memory {
		return new Memory(new Date(data.t), data.c);
	}
}

export class PersonRelation {
	constructor(
		public target: string,
		/** 亲属类: 父母/配偶/子女等; 好友类: 朋友/同学/恋人等; 敌对类: 敌人/仇人等 */
		public rel: string,
		public desc: string,
	) {}
	public serialize() {
		return {
			t: this.target,
			r: this.rel,
			d: this.desc,
		};
	}
	public static deserialize(data: SData<PersonRelation>): PersonRelation {
		return new PersonRelation(data.t, data.r, data.d);
	}
}

type PersonAttr = z.infer<typeof person_attr_zod.summon>;
export class Person extends Obj<PersonAttr> {
	constructor(
		attr: PersonAttr,
		public status: string = '空闲', //状态: 空闲/上班/对话/学习/休息 等一切状态
		public long_term_memory: Memory[] = [],
		public short_term_memory: Memory[] = [],
		public person_relations: PersonRelation[] = [],
	) {
		super(attr.名称, attr);
		attr.小记忆.forEach((m) => this.addSmallMemory(m));
		attr.大记忆.forEach((m) => this.addBigMemory(m));
	}

	public addBigMemory(memory: string) {
		this.long_term_memory.push(new Memory(new Date(), memory));
	}
	public addSmallMemory(memory: string) {
		this.short_term_memory.push(new Memory(new Date(), memory));
	}
	public addNewRelation(target: string, rel: string, desc: string) {
		this.person_relations.push(new PersonRelation(target, rel, desc));
	}
	public getRelation(target: string) {
		return this.person_relations.find((pr) => pr.target === target);
	}

	public processAction(actions: string) {
		// 解析LLM的指令, 并执行相应的动作
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
		// '提示: 如果你要记住一些事情，请使用记忆或设置关系，日志会刷新的很快，你会很快忘记',
	}

	/** 获取玩家对自己可执行的方法 */
	public funcSelfs() {
		// 允许: 修改记忆/修改关系/修改情绪/触发自身能力
	}
	/** 获取判定系统对玩家可执行的方法 */
	public funcSystem() {
		// 允许: 对玩家通知
	}
	/** 获取事件系统对玩家可执行的方法 */
	public funcEvents() {
		// 允许: 修改大部分属性/对玩家通知
	}
	public serialize() {
		return {
			...super.serialize(),
			status: this.status,
			ltm: this.long_term_memory.map((m) => m.serialize()),
			stm: this.short_term_memory.map((m) => m.serialize()),
			pr: this.person_relations.map((pr) => pr.serialize()),
		};
	}
}

type HouseAttr = z.infer<typeof house_attr_zod.summon>;
export class House extends Env<HouseAttr> {
	constructor(attr: HouseAttr, obj_static: Obj[] = [], obj_dynamic: Obj[] = [], sub_env: Env[] = []) {
		super(attr.名称, attr, obj_static, obj_dynamic, sub_env);
	}
}

type RoomAttr = z.infer<typeof room_attr_zod.summon>;
export class Room extends Env<RoomAttr> {
	constructor(attr: RoomAttr, obj_static: Obj[] = [], obj_dynamic: Obj[] = [], sub_env: Env[] = []) {
		super(attr.名称, attr, obj_static, obj_dynamic, sub_env);
	}
}

type FurnitureAttr = z.infer<typeof furniture_attr_zod.summon>;
export class Furniture extends Obj<FurnitureAttr> {
	constructor(attr: FurnitureAttr) {
		super(attr.名称, attr);
	}
}

const envs = [
	[
		GameScene.name,
		({ attr, objs, objd, senv, time, stage }: SData<GameScene>, path) =>
			new GameScene(game_scene_attr_zod.parse(attr, { path }), objs, objd, senv, time, stage),
	],
	[
		House.name,
		({ attr, objs, objd, senv }: SData<House>, path) =>
			new House(house_attr_zod.summon.parse(attr, { path }), objs, objd, senv),
	],
	[
		Room.name,
		({ attr, objs, objd, senv }: SData<Room>, path) =>
			new Room(room_attr_zod.summon.parse(attr, { path }), objs, objd, senv),
	],
] as const satisfies [
	string,
	(
		data: any, // 当前数据
		path: (string | number)[], // 当前解析路径
	) => Env,
][];

const objs = [
	[
		Person.name,
		({ attr, status, ltm, stm, pr }: SData<Person>, path) =>
			new Person(
				person_attr_zod.summon.parse(attr, { path }),
				status,
				ltm.map(Memory.deserialize),
				stm.map(Memory.deserialize),
				pr.map(PersonRelation.deserialize),
			),
	],
	[
		Furniture.name,
		({ attr }: SData<Furniture>, path) => new Furniture(furniture_attr_zod.summon.parse(attr, { path })),
	],
] as const satisfies [
	string,
	(
		data: any, // 当前数据
		path: (string | number)[], // 当前解析路径
	) => Obj,
][];

export function loadGame(data: EnvSerialized): GameScene {
	if (data.type !== GameScene.name) throw new Error(`不是游戏场景数据`);
	return loadEnv(data, ['game']) as GameScene;
}
function loadEnv(data: EnvSerialized, path: (string | number)[]): Env {
	const type = envs.find(([name]) => name === data.type);
	if (!type) throw new Error(`未知的环境类型: ${data.type}`);
	return type[1](
		{
			...data,
			objs: data.objs.map((obj, idx) => loadObj(obj, [...path, 'objs', idx])),
			objd: data.objd.map((obj, idx) => loadObj(obj, [...path, 'objd', idx])),
			senv: data.senv.map((env, idx) => loadEnv(env, [...path, 'senv', idx])),
		} as any,
		path,
	);
}
function loadObj(data: ObjSerialized, path: (string | number)[]): Obj {
	const type = objs.find(([name]) => name === data.type);
	if (!type) throw new Error(`未知的对象类型: ${data.type}`);
	return type[1](data as any, path);
}
