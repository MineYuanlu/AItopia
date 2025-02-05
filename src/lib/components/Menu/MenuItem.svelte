<script lang="ts">
	import { Icon, type IconSource } from '@steeze-ui/svelte-icon';
	import type { Snippet } from 'svelte';
	import type { MouseEventHandler } from 'svelte/elements';
	import { isSnippet } from '../base/soc';

	let {
		icon,
		children,
		onclick,
		onmouseenter,
		onmouseleave,
		hover = $bindable(false),
		href,
		hreflang,
	}: {
		/**左侧图标 icon(hover: boolean)*/
		icon?: Snippet<[boolean]> | IconSource;
		/**菜单项内容 children()*/
		children: Snippet;
		onclick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement> | undefined | null;
		onmouseenter?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement> | undefined | null;
		onmouseleave?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement> | undefined | null;
		hover?: boolean;
		/** 菜单项链接, 指定此值后菜单项将从button变为a标签 */
		href?: string;
		hreflang?: string;
	} = $props();
</script>

{#snippet content()}
	{#if icon}
		<!-- 图标槽 -->
		<span class="mr-2">
			{#if isSnippet(icon)}
				{@render icon(hover)}
			{:else}
				<Icon src={icon} class="h-4 w-4" />
			{/if}
		</span>
	{/if}
	<!-- 菜单项内容 -->
	{@render children()}
{/snippet}

{#if href}
	<a
		{href}
		{hreflang}
		class="flex w-full items-center px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 focus:outline-none dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
		{onclick}
		onmouseenter={(e) => {
			hover = true;
			if (onmouseenter) onmouseenter(e);
		}}
		onmouseleave={(e) => {
			hover = false;
			if (onmouseleave) onmouseleave(e);
		}}
	>
		{@render content()}
	</a>
{:else}
	<button
		{onclick}
		onmouseenter={(e) => {
			hover = true;
			if (onmouseenter) onmouseenter(e);
		}}
		onmouseleave={(e) => {
			hover = false;
			if (onmouseleave) onmouseleave(e);
		}}
		class="flex w-full items-center px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 focus:outline-none dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
	>
		{@render content()}
	</button>
{/if}
