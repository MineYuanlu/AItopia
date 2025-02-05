import type { DefaultColors } from 'tailwindcss/types/generated/colors';

export const specialColors = ['black', 'white'] as const;

/** `black`/`white` 等颜色名 */
export type ColorSpecial = (typeof specialColors)[number];
/** `gray-100`/`gray-200`/`red-500` 等颜色名的前半部分 */
export type ColorLightable = {
	[K in keyof DefaultColors]: DefaultColors[K] extends Record<string, any> ? K : never;
}[keyof DefaultColors];
/** `gray-100`/`gray-200`/`red-500` 等颜色名 */
export type ColorNormal = {
	[K in ColorLightable]: {
		[L in keyof DefaultColors[K]]: L extends string ? `${K}-${L}` : never;
	}[keyof DefaultColors[K]];
}[ColorLightable];
/** `gray-100`/`gray-200`/`red-500`/`white`/`black` 等颜色名 */
export type Color = ColorSpecial | ColorNormal;

export type TextColor<T extends string = Color> = `text-${T}`;
export type DarkTextColor<T extends string = Color> = `dark:text-${T}`;
export type BackgroundColor<T extends string = Color> = `bg-${T}`;
export type HoverBackgroundColor<T extends string = Color> = `hover:bg-${T}`;
export type DarkBackgroundColor<T extends string = Color> = `dark:bg-${T}`;
export type DarkHoverBackgroundColor<T extends string = Color> = `dark:hover:bg-${T}`;
export type BorderColor<T extends string = Color> = `border-${T}`;
export type DarkBorderColor<T extends string = Color> = `dark:border-${T}`;

/** 颜色用途 */
export type ColorUsage =
	| 'text'
	| 'dark:text'
	| 'bg'
	| 'hover:bg'
	| 'dark:hover:bg'
	| 'border'
	| 'dark:border';

export const ColorUsages: readonly ColorUsage[] = [
	'text',
	'dark:text',
	'bg',
	'hover:bg',
	'dark:hover:bg',
	'border',
	'dark:border',
];

/**
 * 所有亮度类型, 数字/字符串
 */
export type AllLight =
	| { [K in ColorLightable]: keyof DefaultColors[K] }[ColorLightable]
	| ({
			[K in ColorLightable]: keyof DefaultColors[K];
	  }[ColorLightable] extends `${infer N extends number}`
			? N
			: never);

/**
 * 颜色包, 描述了一个组件的颜色风格
 */
export type ColorPack = {
	/** 文字颜色 */
	t?: TextColor;
	/** 暗色模式下文字颜色 */
	dt?: DarkTextColor;
	/** 背景颜色 */
	bg?: BackgroundColor;
	/** 悬浮背景颜色 */
	hbg?: HoverBackgroundColor;
	/** 暗色模式下背景颜色 */
	dbg?: DarkBackgroundColor;
	/** 暗色模式下悬浮背景颜色 */
	dhbg?: DarkHoverBackgroundColor;
	/** 边框颜色 */
	b?: BorderColor;
	/** 暗色模式下边框颜色 */
	db?: DarkBorderColor;
};

export const colorPacks = {
	blue: {
		t: 'text-white',
		dt: 'dark:text-gray-100',
		bg: 'bg-blue-500',
		hbg: 'hover:bg-blue-700',
		dbg: 'dark:bg-blue-600',
		dhbg: 'dark:hover:bg-blue-800',
	},
	red: {
		t: 'text-white',
		dt: 'dark:text-gray-100',
		bg: 'bg-red-500',
		hbg: 'hover:bg-red-700',
		dbg: 'dark:bg-red-600',
		dhbg: 'dark:hover:bg-red-800',
	},
	yellow: {
		t: 'text-gray-900',
		dt: 'dark:text-gray-100',
		bg: 'bg-yellow-500',
		hbg: 'hover:bg-yellow-600',
		dbg: 'dark:bg-yellow-700',
		dhbg: 'dark:hover:bg-yellow-800',
	},
	orange: {
		t: 'text-white',
		dt: 'dark:text-gray-100',
		bg: 'bg-orange-500',
		hbg: 'hover:bg-orange-700',
		dbg: 'dark:bg-orange-600',
		dhbg: 'dark:hover:bg-orange-800',
	},
	white: {
		t: 'text-gray-900',
		dt: 'dark:text-gray-100',
		bg: 'bg-white',
		hbg: 'hover:bg-gray-100',
		dbg: 'dark:bg-gray-800',
		dhbg: 'dark:hover:bg-gray-900',
		b: 'border-gray-800',
		db: 'dark:border-gray-50',
	},
	warning: {
		t: 'text-gray-900',
		dt: 'dark:text-gray-100',
		bg: 'bg-yellow-400',
		hbg: 'hover:bg-yellow-500',
		dbg: 'dark:bg-yellow-600',
		dhbg: 'dark:hover:bg-yellow-700',
	},
	error: {
		t: 'text-white',
		dt: 'dark:text-gray-100',
		bg: 'bg-red-500',
		hbg: 'hover:bg-red-600',
		dbg: 'dark:bg-red-700',
		dhbg: 'dark:hover:bg-red-800',
	},
	info: {
		t: 'text-white',
		dt: 'dark:text-gray-100',
		bg: 'bg-blue-500',
		hbg: 'hover:bg-blue-600',
		dbg: 'dark:bg-blue-700',
		dhbg: 'dark:hover:bg-blue-800',
	},
	primary: {
		t: 'text-white',
		dt: 'dark:text-gray-100',
		bg: 'bg-blue-600',
		hbg: 'hover:bg-blue-700',
		dbg: 'dark:bg-blue-800',
		dhbg: 'dark:hover:bg-blue-900',
	},
	secondary: {
		t: 'text-gray-800',
		dt: 'dark:text-gray-50',
		bg: 'bg-gray-200',
		hbg: 'hover:bg-gray-300',
		dbg: 'dark:bg-gray-600',
		dhbg: 'dark:hover:bg-gray-700',
	},
	green: {
		t: 'text-white',
		dt: 'dark:text-gray-100',
		bg: 'bg-green-500',
		hbg: 'hover:bg-green-600',
		dbg: 'dark:bg-green-700',
		dhbg: 'dark:hover:bg-green-800',
	},
	success: {
		t: 'text-white',
		dt: 'dark:text-gray-100',
		bg: 'bg-green-400',
		hbg: 'hover:bg-green-500',
		dbg: 'dark:bg-green-600',
		dhbg: 'dark:hover:bg-green-700',
	},
	'success-border': {
		t: 'text-white',
		dt: 'dark:text-gray-100',
		bg: 'bg-green-400',
		hbg: 'hover:bg-green-500',
		dbg: 'dark:bg-green-600',
		dhbg: 'dark:hover:bg-green-700',
		b: 'border-gray-800',
		db: 'dark:border-gray-50',
	},
} as const satisfies Record<string, ColorPack>;

/** 预设颜色包名 */
export type PreSetColorPacks = keyof typeof colorPacks;
/** 预设颜色包名/颜色包 */
export type PreableColorPacks = PreSetColorPacks | ColorPack;
export const colorPackNames = Object.keys(colorPacks) as PreSetColorPacks[];

/**
 * 将(预设)颜色包转换为颜色类名
 * @param v (预设)颜色包
 * @param str 以一个字符串形式返回
 * @returns 颜色类名字符串, 将所有class属性合并为一个字符串, 跳过undefined
 */
export function colorPack2Class(v: ColorPack | PreSetColorPacks | undefined, str: true): string;
/**
 * 将(预设)颜色包转换为颜色类名
 * @param v (预设)颜色包
 * @returns 颜色类名, 不存在的将为undefined
 */
export function colorPack2Class(
	v: ColorPack | PreSetColorPacks | undefined,
	str?: false,
): ColorPack;
export function colorPack2Class(
	v: ColorPack | PreSetColorPacks | undefined,
	str = false,
): ColorPack | string {
	v = (typeof v === 'string' ? colorPacks[v] : v) ?? {};
	return str
		? Object.values(v)
				.filter((v) => v)
				.join(' ')
		: v;
}

/**
 * 将颜色转换为颜色类名
 *
 * 对于已指定亮度的颜色或特殊颜色, 则不会再添加亮度
 * @param usage 颜色用途
 * @param color 颜色
 * @param light 默认亮度
 * @returns 颜色类名
 */
export const color2Class = <U extends ColorUsage>(
	usage: U,
	color: ColorLightable | Color | `${U}-${ColorLightable}` | `${U}-${Color}`,
	light: AllLight,
): `${U}-${Color}` => {
	if (!color.includes('-') && !specialColors.includes(color as ColorSpecial))
		color = `${color}-${light}` as ColorNormal;

	return (color.startsWith(usage) ? color : `${usage}-${color}`) as any;
};
