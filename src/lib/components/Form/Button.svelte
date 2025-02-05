<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { colorPack2Class, type PreableColorPacks } from '../color';

	const {
		children,
		class: className,
		color = 'blue',
		disabled,
		animated = 0,
		...props
	}: {
		children: Snippet<[]>;
		class?: string | undefined;
		color?: PreableColorPacks;
		disabled?: boolean | undefined | null;
		animated?: boolean | number;
	} & HTMLAttributes<HTMLButtonElement> = $props();
	const { t, dt, bg, hbg, dbg, dhbg, b, db } = $derived(colorPack2Class(color));
</script>

<button
	{disabled}
	class:border-2={!!b}
	class:dark:border-2={!!db}
	class:opacity-50={disabled}
	class:cursor-not-allowed={disabled}
	class:animated={typeof animated === 'number' ? animated > 0 : animated}
	style:--animate-duration={animated === true ? '1s' : `${animated}s`}
	class="btn rounded-lg px-4 py-2 focus:outline-none {t} {dt} {bg} {hbg} {dbg} {dhbg} {b} {db} {className}"
	{...props}
>
	{@render children()}
</button>

<style>
	.animated {
		position: relative;
		overflow: hidden; /* 隐藏超出部分 */
	}
	.animated:before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 400%;
		height: 100%;
		background: linear-gradient(
			45deg,
			rgba(255, 255, 255, 0.1) 25%,
			transparent 25%,
			transparent 50%,
			rgba(255, 255, 255, 0.2) 50%,
			rgba(255, 255, 255, 0.2) 75%,
			transparent 75%,
			transparent
		);
		background-size: 10px 10px; /* 斜线的大小 */
		animation: moveStripes var(--animate-duration, 1s) linear infinite; /* 动画 */
	}

	@keyframes moveStripes {
		0% {
			transform: translateX(0); /* 初始位置 */
		}
		100% {
			transform: translateX(-40px); /* 向左移动，形成滚动效果 */
		}
	}
</style>
