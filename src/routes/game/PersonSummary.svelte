<script lang="ts">
	import Tooltip from '$lib/components/Tooltip.svelte';
	import type { Person } from '$lib/game/core';

	const { person }: { person: Person } = $props();
	const { 性别, 名称 } = person.attr;
	const sex = $derived(性别 == '男' ? 2 : 性别 == '女' ? 1 : 0);
	const displayAttr = ['名称', '生日', '职业', '情绪'] satisfies (keyof typeof person.attr)[];
	const tooltip = $derived.by(() => {
		return [
			...displayAttr.map((key) => `${key}:${person.attr[key]}`),
			`位置: ${person.location.join(' → ')}`,
			`状态: ${person.status}`,
			`小记忆: ${person.short_term_memory.length}条: ${person.short_term_memory[0]?.content ?? ''}`,
			`大记忆: ${person.long_term_memory.length}条: ${person.long_term_memory[0]?.content ?? ''}`,
		].join('\n');
	});
</script>

<Tooltip {tooltip} toolTipPre>
	<div
		class="person-card mt-3 flex cursor-pointer items-center rounded-md border border-gray-200 p-2"
		class:bg-blue-50={sex == 2}
		class:bg-pink-50={sex == 1}
		class:bg-gray-50={sex == 0}
		class:hover:bg-blue-100={sex == 2}
		class:hover:bg-pink-100={sex == 1}
		class:hover:bg-gray-100={sex == 0}
	>
		<span class="font-bold">{名称}</span>
		<pre class="ml-2 flex-1 text-sm text-slate-800">{person.location
				.slice()
				.reverse()
				.join('<')}</pre>
		<span class="ml-2 text-gray-500">{person.status}</span>
	</div>
</Tooltip>
