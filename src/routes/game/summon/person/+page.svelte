<script lang="ts">
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { person_attr, person_attr_zod, type AttrDescArr } from '$lib/game/attrs';
	import { Icon } from '@steeze-ui/svelte-icon';
	import AttrEdit from './AttrEdit.svelte';
	import { InformationCircle } from '@steeze-ui/heroicons';
	import { apiGameSummonPerson } from '$lib/api';
	import { dev } from '$app/environment';
	import type { z } from 'zod';
	import AttrDisplay from './AttrDisplay.svelte';
	import type { zRandomPersonResp } from '$lib/game/api.server';
	import defaults from './defaults.json';

	type PersonAttrDescs = AttrDescArr<keyof typeof person_attr>;

	let user_input: string = $state('');
	let user_define: Partial<Record<keyof typeof person_attr, string>> = $state(
		Object.fromEntries(Object.entries(person_attr).map(([name]) => [name, ''])),
	);

	// 模拟生成的AI身份数据
	let generatedPlayers: z.infer<typeof zRandomPersonResp.shape.result> = $state(
		// 随机从defaults选取3名
		(defaults as z.infer<typeof zRandomPersonResp.shape.result>)
			.slice()
			.sort(() => 0.5 - Math.random())
			.slice(0, 3),
	);

	let loading = $state(false);

	// 模拟用户操作按钮
	const handleGenerate = async () => {
		if (loading) return;
		loading = true;
		try {
			const resp = await apiGameSummonPerson(user_input, user_define);
			if (dev) console.log('生成结果:', resp);
			if (!resp?.success) return;
			generatedPlayers = resp.parsed.result;
		} finally {
			loading = false;
		}
		// const resp = await fetch('/game/summon/person', {
		// 	method: 'POST',
		// });
		// console.log(resp);
		// temp = await resp.json();
	};

	const handleUseConfig = (player: (typeof generatedPlayers)[0]) => {
		console.log('Using configuration: ', player);
	};

	const handleExpand = () => {
		console.log('Expanding configuration...');
	};
</script>

<div class="h-screen w-screen">
	<div class="mb-4 flex w-full justify-center">
		<div class="bg-warm-beige m-4 w-1/4 rounded-md border border-black p-2">
			<h3 class="mb-4 text-center text-xl font-bold">玩家配置</h3>
			<textarea
				placeholder="你想要什么样的玩家？"
				class="h-10 w-full rounded border border-black p-2"
				bind:value={user_input}
			></textarea>
			<h6 class="mb-1 mt-2 flex items-center justify-center text-center text-lg font-bold">
				针对字段设定
				<Tooltip
					class="ml-2 inline-block"
					tooltip={'生成档案: 提供一些字段描述供AI参考\n直接使用: 确保字段格式正确'}
					toolTipPre
				>
					<Icon class="h-5 w-5" src={InformationCircle} />
				</Tooltip>
			</h6>
			{#each Object.entries(person_attr) as PersonAttrDescs as [name, attr], i}
				{#if person_attr.hasOwnProperty(name) && attr.init === undefined}
					<AttrEdit {name} {attr} bind:value={user_define[name]} />
				{/if}
			{/each}
			<div class="mt-2 flex justify-center gap-2">
				<button
					class="rounded-lg bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
					class:loading
					onclick={handleGenerate}
					disabled={loading}
				>
					生成档案
				</button>

				<button
					class="rounded-lg bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
					onclick={handleGenerate}
				>
					直接使用
				</button>
			</div>
		</div>
		{#each [0, 1, 2] as idx}
			<div class="bg-light-beige m-4 w-1/4 rounded-md border border-black p-2">
				{#if generatedPlayers[idx]}
					<h3 class="mb-4 text-center text-xl font-bold">生成档案{idx + 1}</h3>
					<p class="text-md m-2">{generatedPlayers[idx].desc}</p>
					{#each Object.entries(person_attr) as PersonAttrDescs as [name, attr], i}
						{#if person_attr.hasOwnProperty(name) && attr.init === undefined}
							<AttrDisplay {name} {attr} value={generatedPlayers[idx][name]} />
						{/if}
					{/each}
				{:else}
					TODO: 未生成时显示点什么
				{/if}
			</div>
		{/each}
	</div>
</div>
