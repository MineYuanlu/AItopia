import type {
	AssistantMessage,
	RequestData,
	ResponseData,
	SystemMessage,
	Tool,
	ToolMessage,
	UserMessage,
} from './def';

const CHAT_URL = 'http://192.168.3.8:5172/chat';

export async function sendRequest(data: RequestData): Promise<ResponseData> {
	const resp = await fetch(CHAT_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
		body: JSON.stringify({
			model: 'deepseek-r1:14b',
			messages: data.messages,
			tools: data.tools,
			options: {
				frequency_penalty: data.frequency_penalty,
				presence_penalty: data.presence_penalty,
				temperature: data.temperature,
				top_p: data.top_p,
				stop: data.stop,
			},
		} satisfies RequestDataLocal),
	});
	if (!resp.ok) {
		console.error('无法发送请求:', resp.status, resp.statusText, await resp.text());
		throw new Error('Failed to send request');
	}
	const obj: ResponseDataLocal = await resp.json();
	return {
		model: obj.model ?? 'unknown',
		created: obj.created_at ? new Date(obj.created_at).getTime() : 0,
		finish_reason: obj.done_reason ?? 'unknown',
		status: [
			['total_duration', obj.total_duration],
			['load_duration', obj.load_duration],
			['prompt_eval_count', obj.prompt_eval_count],
			['prompt_eval_duration', obj.prompt_eval_duration],
			['eval_count', obj.eval_count],
			['eval_duration', obj.eval_duration],
		],
		message: obj.message as any,
		raws: obj,
	};
}

type RequestDataLocal = {
	messages: (SystemMessage | UserMessage | AssistantMessage | ToolMessage)[];
	model: `deepseek-r1:${1.5 | 7 | 8 | 14 | 32}b`;
	tools?: Tool[];
	format?: '' | 'json';
	options?: Partial<{
		// load time options
		numa: boolean; // 是否启用 Non-Uniform Memory Access (NUMA) 优化
		num_ctx: number; // 上下文窗口的大小
		num_batch: number; // 批量推理的大小
		num_gpu: number; // GPU 数量
		main_gpu: number; // 主 GPU 的编号
		low_vram: boolean; // 是否启用低显存模式
		f16_kv: boolean; // 是否使用16位浮点数（半精度）存储键值缓存
		logits_all: boolean; // 是否输出所有位置的logits（未归一化的概率）
		vocab_only: boolean; // 是否仅加载词汇表而不加载模型权重。适用于仅需要词汇表的任务。
		use_mmap: boolean; // 是否使用内存映射文件来加载模型。可以减少内存占用，但可能增加加载时间。
		use_mlock: boolean; // 是否锁定内存，防止模型数据被交换到磁盘。可以提高性能，但需要足够的物理内存。
		embedding_only: boolean; // 是否仅生成嵌入向量而不进行完整的推理。适用于需要嵌入向量的任务。
		num_thread: number; // 使用的CPU线程数。
		// runtime options
		num_keep: number; // 在生成文本时保留的初始token数量。用于控制生成文本的起始部分。
		seed: number; // 随机数种子。
		num_predict: number; // 预测的最大token数量。控制生成文本的长度。
		top_k: number; // 在生成文本时，仅考虑概率最高的前k个token。用于控制生成文本的多样性。
		top_p: number; // 在生成文本时，仅考虑累积概率超过p的token。也称为“nucleus sampling”，用于控制生成文本的多样性。
		tfs_z: number; // 用于控制生成文本的“温度缩放”参数。较低的值会使生成文本更加确定，较高的值会增加随机性。
		typical_p: number; // 用于控制生成文本的“典型性”参数。较低的值会使生成文本更加典型，较高的值会增加多样性。
		repeat_last_n: number; // 控制生成文本时避免重复的最后n个token。用于减少重复文本的生成。
		temperature: number; // 温度参数，控制生成文本的随机性。较低的值会使生成文本更加确定，较高的值会增加随机性。
		repeat_penalty: number; // 重复惩罚参数，用于惩罚重复生成的token。较高的值会减少重复文本的生成。
		presence_penalty: number; // 存在惩罚参数，用于惩罚已经出现过的token。较高的值会增加生成文本的多样性。
		frequency_penalty: number; // 频率惩罚参数，用于惩罚频繁出现的token。较高的值会增加生成文本的多样性。
		mirostat: number; // 是否启用Mirostat算法。Mirostat是一种用于控制生成文本多样性的算法。
		mirostat_tau: number; // Mirostat算法的目标熵值。用于控制生成文本的多样性。
		mirostat_eta: number; // Mirostat算法的学习率。用于调整生成文本的多样性。
		penalize_newline: boolean; // 是否对换行符进行惩罚。用于控制生成文本中的换行符数量。
		stop: string[]; // 生成文本时的停止符号列表。当生成文本中出现这些符号时，停止生成。
	}>;
};

type ResponseDataLocal = {
	model?: string | null;
	created_at?: string | null;
	done?: boolean | null;
	done_reason?: string | null;
	total_duration?: number | null;
	load_duration?: number | null;
	prompt_eval_count?: number | null;
	prompt_eval_duration?: number | null;
	eval_count?: number | null;
	eval_duration?: number | null;
	message: {
		role: 'assistant' | 'tool';
		content?: string | null;
		images?: any[] | null;
		tool_calls?:
			| {
					function: {
						name: string;
						arguments: Record<string, any>;
					};
			  }[]
			| null;
	};
};
