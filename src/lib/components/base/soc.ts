import type { Component, Snippet } from 'svelte';

export type SoC<Params extends unknown[] = [], Props extends Record<string, any> = object> =
	| Snippet<Params>
	| Component<Props>;

type Others = string | number | boolean | undefined | null | Record<string, any> | unknown[];

export function isSnippet<Params extends unknown[]>(
	item: SoC<Params, any> | Others,
): item is Snippet<Params> {
	return typeof item === 'function' ? item.length === 1 : false;
}

export function isComponent<Props extends Record<string, any>>(
	item: SoC<any, Props> | Others,
): item is Component<Props> {
	return typeof item === 'function' ? item.length === 2 : false;
}
