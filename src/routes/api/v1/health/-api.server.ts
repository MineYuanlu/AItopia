import z from 'zod';

/**
 * 对应`./api.remote.ts`中接口名称
 */
export const nGET = 'api_health';
/**
 * 简单的健康检查接口
 */
export function GET() {
	return 'GOOD';
}

export const zPOST = z.object({
	data: z.string().max(100),
});

export const nPOST = 'api_echo';

export function POST(req: z.infer<typeof zPOST>) {
	return req.data;
}
