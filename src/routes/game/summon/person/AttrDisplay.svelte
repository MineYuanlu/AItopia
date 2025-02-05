<script lang="ts">
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { jsonable_attr_type, type AttrDesc2 } from '$lib/game/attrs';
	import { InformationCircle } from '@steeze-ui/heroicons';
	import { Icon } from '@steeze-ui/svelte-icon';

	let {
		name,
		attr,
		value,
	}: {
		name: string;
		attr: AttrDesc2;
		value: any;
	} = $props();
	const { type, example, desc, init } = $derived(attr);

	let tooltipInfo = $derived.by(() => {
		return [
			`类型: ${type}`,
			`描述: ${desc}`,
			`生成的值:\n${jsonable_attr_type[type] ? JSON.stringify(value, null, 2) : String(value)}`,
		]
			.filter(Boolean)
			.join('\n');
	});

	let isHoverTip = $state(false);
	let isClickTip = $state(false);
	let showTip = $derived(isHoverTip || isClickTip);
</script>

<Tooltip ignoreHover display={showTip} toolTipClass="w-full" toolTipPre tooltip={tooltipInfo}>
	<div
		class="input-group mb-1 flex w-full items-center rounded border border-gray-500"
		class:bg-gray-100={init !== undefined}
	>
		<label for="edit-field-{name}" class="px-2">{name}</label>
		<input
			id="edit-field-{name}"
			class="w-48 flex-grow border-x border-y-0 border-gray-500 px-2 py-1"
			class:bg-gray-100={init !== undefined}
			class:cursor-not-allowed={init !== undefined}
			placeholder={jsonable_attr_type[type] ? JSON.stringify(example) : String(example)}
			value={jsonable_attr_type[type] ? JSON.stringify(value) : String(value)}
			disabled={init !== undefined}
		/>
		<button
			class="cursor-pointer p-1 text-xs text-gray-500"
			onclick={() => {
				isClickTip = !isClickTip;
			}}
			onmouseover={() => {
				isHoverTip = true;
			}}
			onmouseout={() => {
				isHoverTip = false;
			}}
			onfocus={() => {}}
			onblur={() => {}}
		>
			<Icon class="h-5 w-5" src={InformationCircle} />
		</button>
	</div>
</Tooltip>
