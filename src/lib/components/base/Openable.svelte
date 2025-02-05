<script module lang="ts">
	export type ToggleFunc = (open?: boolean) => void;
	export type PreFunc = () => boolean | unknown;
	export type PostFunc = () => unknown;
	export type OpenableProps = {
		/** 打开状态, 可绑定*/
		open?: boolean;

		/** 控制按钮, Snippet / Component / string / undefined */
		controls?: SoC<[ToggleFunc], { onclick: ToggleFunc }> | null | undefined | string;

		/** 打开前回调, 返回 false 则不打开 */
		preOpen?: PreFunc;
		/** 打开后回调 */
		postOpen?: PostFunc;
		/** 关闭前回调, 返回 false 则不关闭 */
		preClose?: PreFunc;
		/** 关闭后回调 */
		postClose?: PostFunc;

		/** 是否脱离当前页面布局, 脱离后, 打开时会显示在页面最上层 */
		overBox?: boolean;
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { isComponent, isSnippet, type SoC } from './soc';
	import Button from '../Form/Button.svelte';
	import OverBox from '../Global/OverBox.svelte';

	let {
		open: outerOpen = $bindable(true),

		children,

		controls: Controls,

		preOpen,
		postOpen,
		preClose,
		postClose,

		overBox,
	}: OpenableProps & {
		/** 子组件 */
		children: Snippet;
	} = $props();

	/** 内部实际状态, **不可直接修改** */
	let open = $state(false);
	function toggleOpen(o?: boolean) {
		if (o === undefined) o = !open;
		if (o === open) {
			outerOpen = open;
			return;
		}

		const pre = o ? preOpen : preClose;
		if (pre && pre() === false) {
			outerOpen = open;
			return;
		}

		outerOpen = open = o;

		const post = o ? postOpen : postClose;
		if (post) post();
	}
	$effect(() => {
		if (outerOpen !== open) toggleOpen(outerOpen); // 同步外部
	});
</script>

<!-- @component
基础组件: 可展开收起的容器
 -->

{#if isSnippet(Controls)}
	{@render Controls(toggleOpen)}
{:else if isComponent(Controls)}
	<Controls onclick={toggleOpen} />
{:else if typeof Controls === 'string'}
	<Button onclick={() => toggleOpen()}>{Controls}</Button>
{/if}

{#if open}
	{#if overBox}
		<OverBox {children} />
	{:else}
		{@render children()}
	{/if}
{/if}
