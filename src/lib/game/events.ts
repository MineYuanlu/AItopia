const game_events = {
	对话检查: '一个人开始对话前交由判定系统检查是否能与其对话(如空间距离)',
	对话: '(判定系统检查后)说的一句话, 将会唤起目标对象进行对话',
	事件: '(延时)触发的一个事情, 拥有目标、事件内容, 在到达触发时刻唤起目标对象进行处理',
	循环事件: '类似于事件, 但循环执行, 直到条件满足',
};
/**
 * 代表一个游戏事件
 */
class GameEvent {
	constructor(
		public time: Date, // 事件发生时间
		public type: string, //keyof typeof game_events, // 事件类型
		public target: string[], // 事件目标
		public content: string, // 事件内容
	) {}
}

class PlayerEvent extends GameEvent {
	constructor(time: Date, target: string[]) {
		super(time, 'player', target, '');
	}
	protected executeEvent() {
		//TODO: 对每个target依次调用playerAction, 解析响应
		// 对于无法解析的,retry
		// 能够解析的命令有: 对话/思考/交互/移动/查看/长期记忆/临时记忆/设置关系/关系描述/查看关系
		// 对话/交互/移动/(查看) 等有世界交互的, 创建一个新的判定系统立即事件, 推入队列, 等待判定结果
		// 思考/长期记忆/临时记忆/设置关系/关系描述/查看关系 等仅涉及自己一个人的, 立即执行
	}
}
class JudgeEvent extends GameEvent {
	constructor(time: Date, target: string[], content: string) {
		super(time, 'judge', target, content);
	}
	protected executeEvent() {
		//TODO: 判定玩家的行为是否违背物理规则, 如跑得太快, 走得太远, 隔空对话等
		// 若违背, 则添加一个新的行动取消立即事件, 通知玩家行动失败
		// 若不违背, 根据玩家行动, 执行相应操作, 对于非立即操作, 推送一个延时事件到队列
	}
}

class EventQueue {
	//TODO: 事件队列, 应按照时间先后执行, 排序需要稳定排序, 多个立即事件(即时间相等)不能打乱顺序, 要按照插入顺序执行
}
