import type { RequestHandler } from './$types';
import { randomPersionAttr } from '$lib/game/api.server';
import { z } from 'zod';
import { failure, parseZod, success } from '$lib/api.server';

export type Resp = Awaited<ReturnType<typeof randomPersionAttr>>;

const bodySchema = z.object({
	user_input: z.string(),
	user_define: z.record(z.string()),
});

export const POST: RequestHandler = async (req) => {
	const { user_input, user_define } = await parseZod(bodySchema, req.request.json());
	try {
		const data = await randomPersionAttr(user_input, user_define);
		return success(data);
	} catch (e) {
		failure(`随机生成属性失败: ${e}`);
	}
};
