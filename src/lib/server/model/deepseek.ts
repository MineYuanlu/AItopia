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
	model: 'deepseek-chat' | 'deepseek-reasoner';
	/**
	 * 介于 -2.0 和 2.0 之间的数字，默认为 0。如果该值为正，那么新 token 会根据其在已有文本中的出现频率受到相应的惩罚，降低模型重复相同内容的可能性。
	 */
	frequency_penalty?: number | null;
	/**
	 * 介于 1 到 8192 间的整数，限制一次请求中模型生成 completion 的最大 token 数。输入 token 和输出 token 的总长度受模型的上下文长度的限制。
	 * 如未指定 max_tokens参数，默认使用 4096。
	 */
	max_tokens?: number | null;
	/**
	 * 介于 -2.0 和 2.0 之间的数字，默认为 0。如果该值为正，那么新 token 会根据其是否已在已有文本中出现受到相应的惩罚，从而增加模型谈论新主题的可能性。
	 */
	presence_penalty?: number | null;
	/**
	 * 一个 object，指定模型必须输出的格式。
	 *
	 * 设置为 `{ "type": "json_object" }` 以启用 JSON 模式，该模式保证模型生成的消息是有效的 JSON。
	 *
	 * 注意: 使用 JSON 模式时，你还必须通过系统或用户消息指示模型生成 JSON。否则，模型可能会生成不断的空白字符，直到生成达到令牌限制，从而导致请求长时间运行并显得“卡住”。
	 * 此外，如果 finish_reason="length"，这表示生成超过了 max_tokens 或对话超过了最大上下文长度，消息内容可能会被部分截断。
	 */
	response_format?: null | {
		type: 'text' | 'json_object';
	};
	/**
	 * 一个 string 或最多包含 16 个 string 的 list，在遇到这些词时，API 将停止生成更多的 token。
	 */
	stop?: null | string | string[];
	/**
	 * 如果设置为 True，将会以 SSE（server-sent events）的形式以流式发送消息增量。消息流以 data: [DONE] 结尾。
	 */
	stream?: boolean | null;
	/** 流式输出相关选项。只有在 stream 参数为 true 时，才可设置此参数。 */
	stream_options?: null | {
		/**
		 * 如果设置为 true，在流式消息最后的 data: [DONE] 之前将会传输一个额外的块。
		 * 此块上的 usage 字段显示整个请求的 token 使用统计信息，而 choices 字段将始终是一个空数组。
		 * 所有其他块也将包含一个 usage 字段，但其值为 null。
		 */
		include_usage?: boolean;
	};
	/**
	 * 采样温度，介于 0 和 2 之间，默认 1。更高的值，如 0.8，会使输出更随机，而更低的值，如 0.2，会使其更加集中和确定。
	 * 我们通常建议可以更改这个值或者更改 `top_p`，但不建议同时对两者进行修改。
	 */
	temperature?: number | null;
	/**
	 * 作为调节采样温度的替代方案，模型会考虑前 top_p 概率的 token 的结果。
	 * 所以 0.1 就意味着只有包括在最高 10% 概率中的 token 会被考虑。
	 * 我们通常建议修改这个值或者更改 temperature，但不建议同时对两者进行修改。
	 * 小于等于 1，默认 1。
	 */
	top_p?: number | null;
	/**
	 * 模型可能会调用的 tool 的列表。目前，仅支持 function 作为工具。
	 * 使用此参数来提供以 JSON 作为输入参数的 function 列表。最多支持 128 个 function。
	 */
	tools?: null | Tool[];
	/**
	 * 控制模型调用 tool 的行为。
	 * - `none` 意味着模型不会调用任何 tool，而是生成一条消息。
	 * - `auto` 意味着模型可以选择生成一条消息或调用一个或多个 tool。
	 * - `required` 意味着模型必须调用一个或多个 tool。
	 * - 通过 `{"type": "function", "function": {"name": "my_function"}}` 指定特定 tool，会强制模型调用该 tool。
	 * 当没有 tool 时，默认值为 none。如果有 tool 存在，默认值为 `auto`。
	 */
	tool_choice?:
		| null
		| 'none'
		| 'auto'
		| 'required'
		| {
				/** tool 的类型。目前，仅支持 function。 */
				type: 'function';
				function: {
					/** 要调用的函数名称。 */
					name: string;
				};
		  };
	/** 是否返回所输出 token 的对数概率。如果为 true，则在 message 的 content 中返回每个输出 token 的对数概率。 */
	logprobs?: boolean | null;
	/** 一个介于 0 到 20 之间的整数 N，指定每个输出位置返回输出概率 top N 的 token，且返回这些 token 的对数概率。指定此参数时，logprobs 必须为 true。 */
	top_logprobs?: number | null;
};

export type ResponseData = {
	/** 该对话的唯一标识符。 */
	id: string;
	/** 模型生成的 completion 的选择列表。 */
	choices: {
		/**
		 * 模型停止生成 token 的原因。
		 * - stop：模型自然停止生成，或遇到 stop 序列中列出的字符串。
		 * - length ：输出长度达到了模型上下文长度限制，或达到了 max_tokens 的限制。
		 * - content_filter：输出内容因触发过滤策略而被过滤。
		 * - insufficient_system_resource：系统推理资源不足，生成被打断。
		 */
		finish_reason:
			| 'stop'
			| 'length'
			| 'content_filter'
			| 'tool_calls'
			| 'insufficient_system_resource';
		/** 该 completion 在模型生成的 completion 的选择列表中的索引。 */
		index: number;
		/** 模型生成的 completion 消息。 */
		message: {
			/** 该 completion 的内容。 */
			content: string | null;
			/** 仅适用于 deepseek-reasoner 模型。内容为 assistant 消息中在最终答案之前的推理内容。 */
			reasoning_content?: string | null;
			/** 模型生成的 tool 调用，例如 function 调用。 */
			tool_calls?: {
				/** tool 调用的 ID。 */
				id: string;
				/** tool 的类型。目前仅支持 function。 */
				type: 'function';
				/** 模型调用的 function。 */
				function: {
					/** 模型调用的 function 名。 */
					name: string;
					/**
					 * 要调用的 function 的参数，由模型生成，格式为 JSON。
					 * 请注意，模型并不总是生成有效的 JSON，并且可能会臆造出你函数模式中未定义的参数。
					 * 在调用函数之前，请在代码中验证这些参数。
					 */
					arguments: string;
				};
			}[];
			/** 生成这条消息的角色。 */
			role: 'assistant';
			/** 该 choice 的对数概率信息。 */
			logprobs: null | {
				/** 一个包含输出 token 对数概率信息的列表。 */
				content:
					| null
					| {
							/** 输出的 token。 */
							token: string;
							/** 该 token 的对数概率。-9999.0 代表该 token 的输出概率极小，不在 top 20 最可能输出的 token 中。 */
							logprob: number;
							/**
							 * 一个包含该 token UTF-8 字节表示的整数列表。
							 * 一般在一个 UTF-8 字符被拆分成多个 token 来表示时有用。
							 * 如果 token 没有对应的字节表示，则该值为 null。
							 */
							bytes: number[] | null;
							/**
							 * 一个包含在该输出位置上，输出概率 top N 的 token 的列表，以及它们的对数概率。
							 * 在罕见情况下，返回的 token 数量可能少于请求参数中指定的 top_logprobs 值。
							 */
							top_logprobs: {
								/** 输出的 token。 */
								token: string;
								/** 该 token 的对数概率。-9999.0 代表该 token 的输出概率极小，不在 top 20 最可能输出的 token 中。 */
								logprob: number;
								/**
								 * 一个包含该 token UTF-8 字节表示的整数列表。
								 * 一般在一个 UTF-8 字符被拆分成多个 token 来表示时有用。
								 * 如果 token 没有对应的字节表示，则该值为 null。
								 */
								bytes: number[] | null;
							}[];
					  }[];
			};
		};
	};
	/** 创建聊天完成时的 Unix 时间戳（以秒为单位）。 */
	created: number;
	/** 生成该 completion 的模型名。 */
	model: string;
	/** 此指纹代表模型与之运行的后端配置。 */
	system_fingerprint: string;
	/** 对象的类型, 其值为 chat.completion。 */
	object: 'chat.completion';
	/** 该对话补全请求的用量信息。 */
	usage: {
		/** 模型 completion 产生的 token 数。 */
		completion_tokens: number;
		/** 用户 prompt 所包含的 token 数。该值等于 prompt_cache_hit_tokens + prompt_cache_miss_tokens */
		prompt_tokens: number;
		/** 用户 prompt 中，命中上下文缓存的 token 数。 */
		prompt_cache_hit_tokens: number;
		/** 用户 prompt 中，未命中上下文缓存的 token 数。 */
		prompt_cache_miss_tokens: number;
		/** 该请求中，所有 token 的数量（prompt + completion）。 */
		total_tokens: number;
		/** completion tokens 的详细信息。 */
		completion_tokens_details?: {
			/** 推理模型所产生的思维链 token 数量 */
			reasoning_tokens: number;
		};
	};
};
