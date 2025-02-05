/** 返回 `YYYY年MM月DD日 星期X HH时mm分ss秒` 格式的当前时间字符串 */
export function get_time_str(time: Date | number): string {
	if (typeof time === 'number') time = new Date(time);
	const week = ['日', '一', '二', '三', '四', '五', '六'];
	const year = time.getFullYear().toString().padStart(4, '0');
	const month = (time.getMonth() + 1).toString().padStart(2, '0');
	const date = time.getDate().toString().padStart(2, '0');
	const hour = time.getHours().toString().padStart(2, '0');
	const minute = time.getMinutes().toString().padStart(2, '0');
	const second = time.getSeconds().toString().padStart(2, '0');
	const weekday = week[time.getDay()];
	return `${year}年${month}月${date}日 星期${weekday} ${hour}时${minute}分${second}秒`;
}
