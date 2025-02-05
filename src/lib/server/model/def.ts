export type SystemMessage = {
	/** system 消息的内容。 */
	content: string;
	/** 该消息的发起角色，其值为 system。 */
	role: 'system';
	/** 可以选填的参与者的名称，为模型提供信息以区分相同角色的参与者。 */
	name?: string;
};
export type UserMessage = {
	/** user 消息的内容。 */
	content: string;
	/** 该消息的发起角色，其值为 user。 */
	role: 'user';
	/** 可以选填的参与者的名称，为模型提供信息以区分相同角色的参与者。 */
	name?: string;
};
export type AssistantMessage = {
	/** assistant 消息的内容。 */
	content: string;
	/** 该消息的发起角色，其值为 assistant。 */
	role: 'assistant';
	/** 可以选填的参与者的名称，为模型提供信息以区分相同角色的参与者。 */
	name?: string;
	/**
	 * (Beta) 设置此参数为 true，来强制模型在其回答中以此 assistant 消息中提供的前缀内容开始。
	 * 您必须设置 base_url="https://api.deepseek.com/beta" 来使用此功能。
	 */
	prefix?: boolean;
	/**
	 * (Beta) 用于 deepseek-reasoner 模型在对话前缀续写功能下，作为最后一条 assistant 思维链内容的输入。
	 * 使用此功能时，prefix 参数必须设置为 true。
	 */
	reasoning_content?: string | null;
};
export type ToolMessage = {
	/** tool 消息的内容。 */
	content: string;
	/** 该消息的发起角色，其值为 tool。 */
	role: 'tool';
	/** 此消息所响应的 tool call 的 ID。 */
	tool_call_id: string;
};

export type Tool = {
	type: 'function';
	function: {
		/** function 的功能描述，供模型理解何时以及如何调用该 function。 */
		description: string;
		/** 要调用的 function 名称。必须由 a-z、A-Z、0-9 字符组成，或包含下划线和连字符，最大长度为 64 个字符。 */
		name: string;
		/**
		 * function 的输入参数，以 JSON Schema 对象描述。
		 * 请参阅 Function Calling 指南获取示例，并参阅JSON Schema 参考了解有关格式的文档。
		 * 省略 parameters 会定义一个参数列表为空的 function。
		 */
		parameters: Record<string, any>;
	};
};

export type RequestData = {
	messages: (SystemMessage | UserMessage | AssistantMessage | ToolMessage)[];
	/**
	 * 介于 -2.0 和 2.0 之间的数字，默认为 0。
	 * 如果该值为正，那么新 token 会根据其在已有文本中的出现频率受到相应的惩罚，降低模型重复相同内容的可能性。
	 */
	frequency_penalty?: number;
	/**
	 * 介于 -2.0 和 2.0 之间的数字，默认为 0。
	 * 如果该值为正，那么新 token 会根据其是否已在已有文本中出现受到相应的惩罚，从而增加模型谈论新主题的可能性。
	 */
	presence_penalty?: number;
	/**
	 * 采样温度，介于 0 和 2 之间，默认 1。更高的值，如 0.8，会使输出更随机，而更低的值，如 0.2，会使其更加集中和确定。
	 * 我们通常建议可以更改这个值或者更改 `top_p`，但不建议同时对两者进行修改。
	 */
	temperature?: number;
	/**
	 * 作为调节采样温度的替代方案，模型会考虑前 top_p 概率的 token 的结果。
	 * 所以 0.1 就意味着只有包括在最高 10% 概率中的 token 会被考虑。
	 * 我们通常建议修改这个值或者更改 temperature，但不建议同时对两者进行修改。
	 * 小于等于 1，默认 1。
	 */
	top_p?: number;
	/**
	 * 模型可能会调用的 tool 的列表。目前，仅支持 function 作为工具。
	 * 使用此参数来提供以 JSON 作为输入参数的 function 列表。最多支持 128 个 function。
	 */
	tools?: Tool[];
	/**
	 * 一个 string 或最多包含 16 个 string 的 list，在遇到这些词时，API 将停止生成更多的 token。
	 */
	stop?: string[];
	/**
	 * 一个整数，用于设置随机数种子。
	 */
	seed?: number;
};
export type ResponseData = {
	model: string;
	/** 秒级时间戳 */
	created: number;
	finish_reason: string;
	/** 一些性能指标 */
	status: [string, string | number | undefined | null][];
	message: {
		role: 'assistant' | 'tool';
		/** 正式输出结果 */
		content: string;
		/** 推理结果 */
		reasoning_content?: string | null;
		tool_calls?:
			| null
			| {
					function: {
						name: string;
						arguments: Record<string, any>;
					};
			  }[];
	};
	raws: any;
};
