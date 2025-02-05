<script lang="ts">
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { jsonable_attr_type, zods, type AttrDesc2 } from '$lib/game/attrs';
	import { InformationCircle } from '@steeze-ui/heroicons';
	import { Icon } from '@steeze-ui/svelte-icon';

	let {
		name,
		attr,
		value = $bindable(),
		checkValue = false,
	}: {
		name: string;
		attr: AttrDesc2;
		value: any;
		checkValue?: boolean;
	} = $props();
	const { type, example, desc, range, summon, init, edit, zod } = $derived(attr);
	let innerValue = $state('');
	let error: null | string = $state(null);
	const invalid = $derived(checkValue && error != null);

	$effect(() => {
		if (init === undefined) return;
		let val;
		if (typeof init === 'function') val = init();
		else val = init;
		if (jsonable_attr_type[type]) innerValue = JSON.stringify(val);
		else innerValue = String(val);
	});

	$effect(() => {
		let val;
		if (jsonable_attr_type[type]) {
			try {
				val = JSON.parse(innerValue);
			} catch (e) {
				error = '无效json';
				return;
			}
		} else val = innerValue;
		const ret = (zod ?? zods[type]).safeParse(val);
		if (ret.success) {
			value = ret.data;
			error = null;
		} else {
			error = ret.error.format()._errors.join('\n');
		}
	});

	let tooltipInfo = $derived.by(() => {
		return [
			`类型: ${type}`,
			`描述: ${desc}`,
			`样例: ${example}`,
			range && `范围: ${range}`,
			summon && `生成规则: ${summon}`,
			init && `初始设定: ${init}`,
			edit && `编辑规则: ${edit}`,
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
		class="input-group mb-1 flex w-full items-center rounded border"
		class:border-gray-500={!invalid}
		class:border-red-500={invalid}
		class:bg-gray-100={init !== undefined}
	>
		<label for="edit-field-{name}" class="px-2">{name}</label>
		<input
			id="edit-field-{name}"
			class="w-48 flex-grow border-x border-y-0 px-2 py-1"
			class:border-gray-500={!invalid}
			class:border-red-500={invalid}
			class:bg-gray-100={init !== undefined}
			class:cursor-not-allowed={init !== undefined}
			placeholder={jsonable_attr_type[type] ? JSON.stringify(example) : String(example)}
			bind:value={innerValue}
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
