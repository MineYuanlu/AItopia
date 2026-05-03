// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			sql_info?: {
				sql?: string;
				sqlState: string;
				sqlMessage: string;
				code: string;
				errno: number;
			};
			/** 错误类型 */
			error_type?: string;
			/** 错误堆栈跟踪(仅dev模式) */
			stack?: string;
		}

		/** 通用成功响应 */
		interface CommonSuccess {
			/** 成功消息 */
			message: string;
			/** 针对不同情况的code */
			code: number;
			/** 附带的响应数据 */
			data?: any;
		}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
