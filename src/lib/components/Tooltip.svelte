<script lang="ts">
	import type { Snippet } from 'svelte';

	const {
		children,
		tooltip,
		pos = 'top', // 默认位置为底部
		display = $bindable(false),
		ignoreHover = false,
		padding = '1px',
		class: boxClass = '',
		toolTipClass = '',
		contentClass = '',
		toolTipPre = false,
	}: {
		children: Snippet;
		tooltip: string | Snippet;
		pos?: `${'' | 'inner-'}${'top' | 'bottom' | 'left' | 'right'}`;
		display?: boolean;
		ignoreHover?: boolean;
		padding?: string;
		class?: string;
		toolTipClass?: string;
		contentClass?: string;

		/** 是否使用pre标签包裹tooltip内容 */
		toolTipPre?: boolean;
	} = $props();

	let hover = $state(false);
	let tooltipRef = $state<HTMLDivElement | null>(null);
	let tooltipStyle = $state<string>('');

	// 根据 tooltipPosition 计算 Tooltip 的位置
	function calculateTooltipPosition() {
		if (!tooltipRef) return '';

		const rect = tooltipRef.getBoundingClientRect();

		switch (pos) {
			case 'top':
				return `top: calc( -${rect.height}px - ${padding} ); left: 50%; transform: translateX(-50%);`;
			case 'inner-top':
				return `top: 0; left: 50%; transform: translateX(-50%);`;
			case 'bottom':
				return `bottom: calc( -${rect.height}px - ${padding} ); left: 50%; transform: translateX(-50%);`;
			case 'inner-bottom':
				return `bottom: 0; left: 50%; transform: translateX(-50%);`;
			case 'left':
				return `top: 50%; left: calc( -${rect.width}px - ${padding} ); transform: translateY(-50%);`;
			case 'inner-left':
				return `top: 50%; left: 0; transform: translateY(-50%);`;
			case 'right':
				return `top: 50%; right: calc( -${rect.width}px - ${padding} ); transform: translateY(-50%);`;
			case 'inner-right':
				return `top: 50%; right: 0; transform: translateY(-50%);`;
		}
		return '';
	}

	// 监听 hover 变化，重新计算位置
	$effect(() => {
		if (display || (!ignoreHover && hover)) {
			tooltipStyle = calculateTooltipPosition();
		}
	});
</script>

<div class="relative {boxClass}">
	<div
		role="tooltip"
		class="relative contents bg-transparent {contentClass}"
		onmouseover={() => {
			if (!ignoreHover) hover = true;
		}}
		onmouseout={() => {
			if (!ignoreHover) hover = false;
		}}
		onfocus={() => {
			if (!ignoreHover) hover = true;
		}}
		onblur={() => {
			if (!ignoreHover) hover = false;
		}}
	>
		{@render children()}
	</div>

	{#if display || (!ignoreHover && hover)}
		<div
			bind:this={tooltipRef}
			class="absolute z-10 whitespace-nowrap rounded-md border border-gray-300 bg-gray-800 p-2 text-sm text-white shadow-lg {toolTipClass}"
			style={tooltipStyle}
		>
			{#if typeof tooltip === 'string'}
				{#if toolTipPre}
					<pre class="text-left text-xs text-gray-100">{tooltip}</pre>
				{:else}
					{tooltip}
				{/if}
			{:else}
				{@render tooltip()}
			{/if}
		</div>
	{/if}
</div>
