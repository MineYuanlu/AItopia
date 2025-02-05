export class Command {
	constructor(
		public name: string,
		public args: (string | { n: string; d: string })[],
		public desc: string,
	) {}
	public toString() {
		const args = this.args
			.map((arg) => (typeof arg === 'string' ? `<${arg}>` : arg.d ? `[${arg.n}]` : `<${arg.n}>`))
			.join(' ');
		return `\`${this.name} ${args}\` ; ${this.desc}`;
	}
	/**
	 * 解析单行单条命令参数
	 * @param src 命令行
	 * @returns 解析结果: `-2` = 参数缺失; `args[]` = 解析成功
	 */
	public parseArgs(args: string[]) {
		args = this.args.map((arg, index) => {
			if (typeof arg === 'string') return args[index] ?? null;
			else return args[index] ?? arg.d;
		});
		if (args.some((arg) => arg === null)) return -2;
		return args;
	}
	/**
	 * 解析多条命令
	 * @param src 命令行(可以有多行)
	 * @param cmds 所有命令
	 * @returns 解析结果; 对于`failed`: `-1` = 命令名错误; `-2` = 参数缺失;
	 */
	public static parseCommands(src: string, cmds: Command[]) {
		const resp: { cmds: string[][]; failed: [string, -1 | -2][] } = { cmds: [], failed: [] };
		for (const line of src
			.trim()
			.split('\n')
			.map((l) => l.trim())
			.filter((l) => l)) {
			let [cmdName, ...args] = line.split(' ');
			cmdName = cmdName
				.trim()
				.replace(/[`\s!.,?;:]*$/, '')
				.replace(/^[`\s!.,?;:]*/, '');
			const cmd = cmds.find((c) => c.name === cmdName);
			const parsed = cmd ? cmd.parseArgs(args) : -1;
			if (typeof parsed === 'number') resp.failed.push([line, parsed]);
			else resp.cmds.push(parsed);
		}

		return resp;
	}
}
