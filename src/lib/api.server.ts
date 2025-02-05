import { error, json } from '@sveltejs/kit';
import { z } from 'zod';

/**
 * API通用返回函数
 * @param data 返回数据
 * @param code API状态码, 0表示成功
 * @param msg API状态信息
 * @param status HTTP状态码
 * @param headers HTTP头
 * @returns Response对象
 */
export function apiResp(
	data?: any,
	code = 0,
	message?: string,
	status?: number,
	headers?: Record<string, string>,
) {
	let init: ResponseInit | undefined = undefined;
	if (headers || status) init = { status, headers };
	return json({ data, code, message }, init);
}
/**
 * API失败返回函数
 * @param msg 错误信息
 * @param code 错误码( 默认为 1 )
 * @param http HTTP状态码( 默认为 400 )
 * @throw sveltekit的error函数
 */
export function failure(message: string, code = 1, http = 400): never {
	throw error(http, { code, message } as any);
}

/**
 * API成功返回函数
 * @param data 返回数据
 * @param headers HTTP头
 * @returns Response对象
 */
export function success(data?: any, headers?: Record<string, string>) {
	return apiResp(data, 0, undefined, 200, headers);
}

export async function parseZod<
	Output = any,
	Def extends z.ZodTypeDef = z.ZodTypeDef,
	Input = Output,
>(schema: z.ZodType<Output, Def, Input>, data: any | URLSearchParams): Promise<Output> {
	if (data instanceof URLSearchParams) data = Object.fromEntries(data.entries());
	const result = await schema.safeParseAsync(await data);
	if (result.success) return result.data;
	else {
		const msg = result.error.issues
			.map(({ path, message, code, ...extra }) => {
				return `[${path.join('.')}]: ${message || code} ${JSON.stringify(extra)}`;
			})
			.join('\n');
		failure(msg, 1, 400);
	}
}
