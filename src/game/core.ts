// 现在我想做一个游戏，请你扮演专业的程序员，给出一些建议：

import { person_attr } from "./attrs";

// 我要做一款AI虚拟现实游戏，游戏中全部都是AI，玩家不能直接干预（但可以像上帝一样触发一些事件）
// 主要目的就是看AI之间的互动，让他们在一个模拟环境中生活、交流、学习、进化
// 目前我希望设定就是一个普通的打工人场景，几个人合租，我希望看他们在这个场景里的互动，以及他们的学习成长过程
// 他们每个人都有自己的属性，比如颜值、身高、体重、身材、智商、体力、智慧、情商等等；也有状态，比如精力，情绪，饱腹感等等
// 游戏中的AI都是人类模样，他们之间也会有各种状态，比如好感度、亲密度、信任度等等
// 上帝可以触发一些特殊事件，比如AI升职、离职、出租屋失火等等

// AI是现成的，他们不会改变神经网络网络参数，只是会在他们的记忆存储一些东西
// 每个AI都可以做以下事情：

// 对话：对某人或某些人说出一些话，对方会知道。
// 思考：类似于自言自语，别人不知道
// 查询记忆：查看自己的记忆
// 记住某件事：即修改自己的记忆
// 特定交互：比如在厨房，可以做饭等，会降低精力，同时做出饭。对“饭”可以“吃”，增加饱腹感和精力，情绪等。。。
// 修改对他人的看法：AI可以自主修改自己对别人的状态，比如降低好感度等。

// 游戏框架需要：
// 存储各个人的属性、状态、记忆、技能、对他人的状态等信息，还有场景信息，比如锅碗（如刷没刷，有没有饭）、垃圾桶（有没有垃圾）、冰箱、储物间等等

// 这款游戏主要在于AI之间的互动，画面什么的不是考虑的重点

/**
 * 游戏场景
 * 包括各个物体的位置, 可以包含子场景, 包括动态/静态两类物体
 */

type Pos = { x: number; y: number };

class Enviroment {
  public obj_static: { obj: Obj; pos: Pos }[] = [];
  public obj_dynamic: { obj: Obj; pos: Pos }[] = [];
  public sub_enviroments: { env: Enviroment; pos: Pos }[] = [];
}
class Obj<Attr extends string = string> {
  constructor(public attr: Record<Attr, any>) {}
}

export class Person extends Obj<keyof typeof person_attr> {
  constructor(attr?: Record<keyof typeof person_attr, any>) {
    // if (!attr) attr = randomPersonAttr();
    super(attr!);
  }
}
