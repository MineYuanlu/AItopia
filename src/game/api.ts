// import { sendRequest } from "../api/deepseek_online";
import { RequestData } from "../api/deepseek";
import { sendRequest as _sendRequest } from "../api/deepseek_console";
import {
  type AttrDesc,
  furniture_attr,
  house_attr,
  person_attr,
  room_attr,
} from "./attrs";

type PartialSome<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>;

function makeFieldPrompt(fields: Record<string, AttrDesc>) {
  return [
    "以下是各个字段的详细说明:",
    ...Object.entries(fields).map(
      ([name, [type, example, desc, range]]) =>
        `字段: ${name};\t类型: ${type};\t样例值: ${JSON.stringify(
          example
        )};\t描述: "${desc}";\t值范围: "${range}";`
    ),
  ];
}

function makeUserPrompt(
  user_input?: string,
  user_define?: Record<string, string>,
  random_seed?: string
) {
  const user_prompts = [];

  const user_define_ = user_define ? Object.entries(user_define) : [];
  if (user_define_.length > 0)
    user_prompts.push(
      "字段要求:",
      ...user_define_.map(([name, value]) => `${name}: ${value}`)
    );
  if (user_input) user_prompts.push("设定要求:", user_input);
  if (user_prompts.length <= 0)
    user_prompts.push("没有设定要求, 你可以任意的设定玩家属性.");
  if (!random_seed) random_seed = Math.random().toString(36).substring(2);
  user_prompts.push("随机种子:", random_seed);
  return user_prompts;
}

function sendRequest(
  data: PartialSome<RequestData, "model" | "response_format" | "temperature">
) {
  return _sendRequest({
    model: "deepseek-chat",
    response_format: { type: "json_object" },
    temperature: 2,
    ...(data as any),
  });
}

export function randomPersionAttr(
  user_input?: string,
  user_define?: Record<string, string>
) {
  const system_prompts = [
    "用户正在创建《模拟人生》游戏的玩家属性设置",
    "你需要根据用户输入的信息，随机地给出[三套]符合用户设定要求的玩家属性, 要求属性合理, 每套之间在要求范围内差异尽可能大. 结果以json格式呈现",
    'json格式形如: {"think": "思考内容", "result": {"字段1": "值1", "字段2": "值2", ... , "desc": "描述" }[]}',
    "其中:",
    "think是你对用户需求的一些思考, 不会展示给用户, 仅用于你自己参考. ",
    "result每一项是一套属性设置. ",
    "desc是对用户说的话, 表明生成这套配置的原因",
    "",
    "请注意: 不要直接使用样例值! 你必须仔细思考, 这些设定非常重要!",
    "提到的每一个字段都是必须的, 请你务必仔细阅读并理解, 否则可能导致游戏无法正常运行. ",
    "新创建的玩家将以'搬入新的合租房间'的方式来到游戏中, 玩家创建后会立马开始搬到新家的剧情, 你需要在情绪或记忆中体现这点",
    ...makeFieldPrompt(person_attr),
  ].join("\n");
  const user_prompts = makeUserPrompt(user_input, user_define).join("\n");
  sendRequest({
    messages: [
      { role: "system", content: system_prompts },
      { role: "user", content: user_prompts },
    ],
  });
}

export function randomHouseAttr(
  user_input?: string,
  user_define?: Record<string, string>
) {
  const system_prompts = [
    "用户正在创建《模拟人生》游戏的房屋属性设置",
    "你需要根据用户输入的信息，随机地给出[一套]符合用户设定要求的房屋属性, 要求属性合理, 结果以json格式呈现",
    'json格式形如: {"think": "思考内容", "result": {"字段1": "值1", "字段2": "值2", ... }, "desc": "描述"}',
    "其中:",
    "think是你对用户需求的一些思考, 不会展示给用户, 仅用于你自己参考. ",
    "result是一套房屋属性设置. ",
    "desc是对用户说的话, 表明生成这套配置的原因",
    "",
    "请注意: 不要直接使用样例值! 你必须仔细思考, 这些设定非常重要!",
    "提到的每一个字段都是必须的, 请你务必仔细阅读并理解, 否则可能导致游戏无法正常运行. ",
    "你要确保参数合理, 尤其是面积和户型之间的关系, 否则可能导致房屋建筑质量不佳",
    ...makeFieldPrompt(house_attr),
  ].join("\n");
  const user_prompts = makeUserPrompt(user_input, user_define).join("\n");
  sendRequest({
    messages: [
      { role: "system", content: system_prompts },
      { role: "user", content: user_prompts },
    ],
    model: "deepseek-chat",
    response_format: { type: "json_object" },
    temperature: 2,
  });
}
export function randomRoomAttr(
  house_info: Record<string, any>,
  user_input?: string,
  user_define?: Record<string, string>
) {
  const system_prompts = [
    "用户正在创建《模拟人生》游戏的房间属性设置",
    "你刚刚帮助用户生成了房屋属性, 现在需要你根据用户输入的信息, 针对房屋的信息生成各个房间, 要求属性合理, 结果以json格式呈现",
    'json格式形如: {"think": "思考内容", "result": {"字段1": "值1", "字段2": "值2", ... , "desc": "描述" }, "desc": "整体描述", "fail"?: true}',
    "其中:",
    "think是你对用户需求的一些思考, 不会展示给用户, 仅用于你自己参考. ",
    "result是每个房间的属性设置(仅含房间本身的信息, 不包括房屋和家具信息). ",
    "desc是对用户说的话, 表明生成这套配置的原因",
    '若你发现房屋信息明显不合理, 无法生成正常的房间信息, 请你在desc中说明, 并在desc后添加"fail":true字段',
    "",
    "请注意: 不要直接使用样例值! 你必须仔细思考, 这些设定非常重要!",
    "提到的每一个字段都是必须的, 请你务必仔细阅读并理解, 否则可能导致游戏无法正常运行. ",
    "你要确保参数合理, 尤其是面积等信息, 确保能容纳下正常的家具, 否则可能导致房屋建筑质量不佳",
    ...makeFieldPrompt(room_attr),
  ].join("\n");
  const user_prompts = makeUserPrompt(user_input, user_define).join("\n");
  sendRequest({
    messages: [
      { role: "assistant", content: `房屋信息: ${JSON.stringify(house_info)}` },
      { role: "system", content: system_prompts },
      { role: "user", content: user_prompts },
    ],
  });
}

export function randomFurnitureAttr(
  house_info: Record<string, any>,
  room_info: Record<string, any>,
  user_input?: string,
  user_define?: Record<string, string>
) {
  const system_prompts = [
    "用户正在创建《模拟人生》游戏的家具属性设置",
    "你刚刚帮助用户生成了房屋和房间信息, 现在需要你根据用户输入的信息, 针对房屋和房间的信息生成家具, 要求属性合理, 结果以json格式呈现",
    'json格式形如: {"think": "思考内容", "result": {"字段1": "值1", "字段2": "值2", ... }, "desc": "描述", "fail"?: true}',
    "其中:",
    "think是你对用户需求的一些思考, 不会展示给用户, 仅用于你自己参考. ",
    "result是一套房屋属性设置. ",
    "desc是对用户说的话, 表明生成这套配置的原因",
    '若你发现房屋信息明显不合理, 无法生成正常的房间信息, 请你在desc中说明, 并在desc后添加"fail":true字段',
    "",
    "请注意: 不要直接使用样例值! 你必须仔细思考, 这些设定非常重要!",
    "提到的每一个字段都是必须的, 请你务必仔细阅读并理解, 否则可能导致游戏无法正常运行. ",
    "你要确保参数合理, 尤其是面积等信息, 确保能容纳下正常的家具, 否则可能导致房屋建筑质量不佳",
    ...makeFieldPrompt(furniture_attr),
  ].join("\n");
  const user_prompts = makeUserPrompt(user_input, user_define).join("\n");
  sendRequest({
    messages: [
      { role: "assistant", content: `房屋信息: ${JSON.stringify(house_info)}` },
      { role: "assistant", content: `房间信息: ${JSON.stringify(room_info)}` },
      { role: "system", content: system_prompts },
      { role: "user", content: user_prompts },
    ],
  });
}
