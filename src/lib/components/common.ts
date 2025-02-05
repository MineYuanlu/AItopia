import { onMount, type Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { writable, type Writable } from 'svelte/store';

export const navbar = writable<[Snippet, HTMLAttributes<HTMLElement> | undefined] | undefined>(
	undefined,
);

export const setNavBar = (_navbar: Snippet, attr?: HTMLAttributes<HTMLElement>) => {
	onMount(() => {
		navbar.set([_navbar, attr]);
		return () => navbar.set(undefined);
	});
};

export type Setting = Snippet<[(v?: boolean) => void]>;
export type Settings = Record<string, Setting>;
/** 全局设置菜单 */
export const settings = writable<Settings>({});
/** 添加全局设置菜单 */
export const setSettings = (v: Setting) => setAValue(settings, v);

export type OverBox = Snippet<[]>;
export type OverBoxs = Record<string, OverBox>;
/** 全局覆盖层 */
export const overBoxs = writable<OverBoxs>({});
/** 添加全局覆盖层 */
export const setOverBoxs = (v: OverBox) => setAValue(overBoxs, v);

const setAValue = <T>(all: Writable<Record<string, T>>, value: T) => {
	onMount(() => {
		let id: string | undefined = undefined;
		all.update((v) => {
			do id = randId();
			while (v[id]);
			v[id] = value;
			return v;
		});
		return () =>
			all.update((v) => {
				if (id) delete v[id];
				return v;
			});
	});
};

const randId = () => Math.random().toString(36).substring(2);
