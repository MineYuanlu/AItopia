import { dev } from '$app/environment';
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { error, isHttpError, json, redirect } from '@sveltejs/kit';
import z from 'zod';

export function success({ message = 'OK', data }: Partial<App.CommonSuccess>, init?: ResponseInit) {
	return json({ ok: true, message, data }, init);
}
/**
 * 执行断言, 如果expr为falsey, 则抛出`HttpError`错误
 * @param expr 断言表达式
 * @param message 错误信息
 * @param status 错误返回状态码, 默认500
 */
export function assert(expr: unknown, message: string, status = 500): asserts expr {
	if (!expr) {
		const err = new Error(message);
		throw error(status, {
			message,
			error_type: 'assert',
			stack: err.stack,
		});
	}
}
function merge(user: any, intern: any) {
	if (intern === undefined) return user;
	assert(typeof user === 'object' && user !== null, 'Bad Request', 400);
	assert(typeof intern === 'object' && intern !== null, 'Internal Server Error');
	return { ...user, ...intern };
}
/**
 * 按照zod的schema解析请求体
 *
 * 请求体通过`getRequestEvent`获取
 *
 * @param schema 解析schema
 * @param extra 额外参数 (若指定, 则请求体必须是object)
 * @returns 解析结果
 * @throws 400 解析失败
 */
export async function parseBody<Schema extends z.ZodType>(schema: Schema, extra?: Partial<z.input<Schema>>) {
	const raw = merge(await getRequestEvent().request.json(), extra);
	const result = await schema.spa(raw);
	if (!result.success) return error(400, { message: z.prettifyError(result.error) });
	return result.data;
}

/**
 * 按照zod的schema解析请求参数
 *
 * 请求参数通过`getRequestEvent`获取
 *
 * @param req 请求
 * @param schema 解析schema
 * @param extra 额外参数
 * @returns 解析结果
 * @throws 400 解析失败
 */
export async function parseSearchParams<Schema extends z.ZodType>(schema: Schema, extra?: Partial<z.input<Schema>>) {
	const raw = merge(Object.fromEntries(getRequestEvent().url.searchParams), extra);
	const result = await schema.spa(raw);
	if (!result.success) return error(400, { message: z.prettifyError(result.error) });
	return result.data;
}

/**
 * 将请求重定向到Python API
 */
export function toPyAPI(status: 300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308 = 308): never {
	const url = new URL(getRequestEvent().url);
	const match = url.pathname.match(/^\/api\/(v\d+)\/(.*)$/);
	assert(match, 'Invalid API path', 500);
	url.pathname = `/api/${match[1]}/py/${match[2]}`;
	if (dev) url.port = env.PYTHON_PORT ?? '3001'; // 开发环境下, python不和nodejs共用端口
	redirect(status, url);
}

/** 自定义处理函数, 接收错误信息并返回任意值 */
export type ErrorHandlerFunc<Ret = never> = (body: App.Error) => Ret;
/**
 * 错误处理函数类型
 * - 数字: 返回指定状态码的HttpError
 * - 函数: 自定义处理函数, 接收错误信息并返回任意值
 */
export type ErrorHandler<Ret = never> = number | ErrorHandlerFunc<Ret>;
export type ErrorMsg = (param: { msg: string }) => string;

function getDBError(e: unknown) {
	if (!(e instanceof Error)) return;
	const { code, errno, sql, sqlState, sqlMessage } = e as any;
	if (!code || typeof errno !== 'number' || !sql || !sqlState || !sqlMessage) {
		if (e.cause) return getDBError(e.cause);
		else return;
	} else {
		return e;
	}
}

/**
 * 尝试捕获`Error`错误
 * @param e 错误
 * @param msg 错误信息模板, `{}`代表原始错误信息
 * @param handler 捕获处理函数, 默认抛出500`HttpError`错误
 */
export function catchError<Ret = never>(
	e: any,
	msg: ErrorMsg = ({ msg }) => `内部错误: ${msg}`,
	handler: ErrorHandler<Ret> = 500,
) {
	if (e instanceof Error) {
		return getHandler(handler)({
			message: msg({ msg: e.message }),
			error_type: e.name,
			stack: e.stack,
		});
	}
}

export function catchHttpError<Ret = never>(
	e: any,
	status: number | number[] | true = 5,
	handler: ErrorHandler<Ret> = 500,
) {
	if (isHttpError(e)) {
		const s = e.status;
		if (typeof status === 'number') status = [status];
		if (status === true || status.some((v) => v === s || ((s / 100) | 0) === v)) return getHandler(handler)(e.body);
	}
}

/**
 * 尝试捕获所有错误
 * @param e 错误
 * @param msg 错误信息模板, `{}`代表原始错误信息
 * @param handler 捕获处理函数, 默认抛出500`HttpError`错误
 * @see catchGitlabError
 * @see catchDbError
 * @see catchError
 */
export function catchAnyError<Ret = never>(e: any, msg?: ErrorMsg, handler: ErrorHandler<Ret> = 500) {
	return catchHttpError(e, true, handler) || catchError(e, msg, handler);
}

function getHandler<Ret = never>(handler: ErrorHandler<Ret>): ErrorHandlerFunc<Ret> {
	return typeof handler === 'number' ? (body) => error(handler, body) : handler;
}
