<script lang="ts">
	import type { Snippet } from 'svelte';
	import ClickListener from '../Global/ClickListener.svelte';
	import KeyListener from '../Global/KeyListener.svelte';
	import { fly } from 'svelte/transition';
	import Openable, { type OpenableProps } from '../base/Openable.svelte';

	let {
		children,
		closeOnOutsideClick = true,
		closeOnEscape = true,
		this: box = $bindable(),

		open = $bindable(false),
		controls,
		preOpen,
		postOpen,
		preClose,
		postClose,
	}: {
		children: Snippet<[(open?: boolean) => void]>;
		/**是否允许点击外面关闭面板 (默认true) */
		closeOnOutsideClick?: boolean;
		/**是否允许按Esc关闭面板 (默认true) */
		closeOnEscape?: boolean;
		this?: HTMLDivElement;
	} & OpenableProps = $props();

	// 用于控制菜单是否打开
	function toggleMenu(o?: boolean) {
		open = o ?? !open;
	}
</script>

<!-- @component
菜单组件, 展示一个菜单按钮和菜单列表, 内容由`<MenuItem/>`, `<MenuPlain/>`, `<MenuDivider/>`等组成

example:

```svelte
<Menu>
	{#snippet controls(toggleMenu)}
		<IconBtn icon={PersonIcon} content={user?.name} onclick={() => toggleMenu()} />
	{/snippet}
	<MenuPlain title>标题</MenuPlain>
	<MenuItem href="/">主页</MenuItem>
</Menu>
```
 -->

<div class="relative inline-block text-left" bind:this={box}>
	<Openable bind:open {controls} {preOpen} {postOpen} {preClose} {postClose}>
		<!-- Dropdown Menu -->
		<div
			class="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white p-2 shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700"
			style:z-index="999"
			in:fly={{ y: 5, opacity: 0.5, duration: 40 }}
			out:fly={{ y: -5, opacity: 0.3, duration: 40 }}
		>
			<div class="py-1" role="menu" aria-orientation="vertical" aria-labelledby="menu-button">
				{@render children(toggleMenu)}
			</div>
		</div>

		{#if closeOnOutsideClick}
			<ClickListener handler={() => (open = false)} exclude={box} />
		{/if}
		{#if closeOnEscape}
			<KeyListener handler={() => (open = false)} key="Escape" />
		{/if}
	</Openable>
</div>
