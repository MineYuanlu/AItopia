<script lang="ts">
	import { apiGameActionPlayer } from '$lib/api';
	import BtnGroup from '$lib/components/Form/BtnGroup.svelte';
	import Button from '$lib/components/Form/Button.svelte';
	import { Person, type GameScene } from '$lib/game/core';
	import type { MainTypes } from './+page.svelte';
	import PersonSummary from './PersonSummary.svelte';

	let {
		game,
		main_type = $bindable(),
	}: {
		game: GameScene;
		main_type: MainTypes;
	} = $props();

	const all_person = $derived(game.findObjs((o) => o instanceof Person));

	let auto_run = $state(false);
	let auto_gen = $state(false);
</script>

<div class="flex h-full flex-col rounded-md border-gray-600 p-2">
	<div>
		<BtnGroup class="mb-2">
			<Button class="text-nowrap px-0" color="green">执行操作</Button>
			<Button class="text-nowrap px-0" color="orange">AI生成</Button>
		</BtnGroup>
		<BtnGroup>
			<Button
				class="text-nowrap border-r-2 px-0"
				color={auto_run ? 'success-border' : 'white'}
				animated={auto_run}
				onclick={() => (auto_run = !auto_run)}
			>
				自动执行
			</Button>
			<Button
				class="aaa text-nowrap px-0"
				color={auto_run && auto_gen ? 'success-border' : 'white'}
				animated={auto_run && auto_gen}
				onclick={() => (auto_run = auto_gen = !(auto_run && auto_gen))}
			>
				全自动
			</Button>
			<Button
				class="text-nowrap px-0"
				color={auto_gen ? 'success-border' : 'white'}
				animated={auto_gen}
				onclick={() => (auto_gen = !auto_gen)}
			>
				自动生成
			</Button>
		</BtnGroup>
		<h6 class="mb-1 mt-2 text-lg font-bold">游戏状态: 待开始</h6>

		<Button
			class="w-full text-nowrap border-r-2 px-0"
			onclick={() => {
				apiGameActionPlayer(1, '莉莉').then((resp) => {
					console.log(resp, resp?.req.messages[0].content, resp?.resp.message.content);
				});
				// apiGameActionPlayer(1, '元路').then((resp) => {
				// 	console.log(resp);
				// });
			}}
		>
			操控世界
		</Button>
	</div>
	<hr class="my-2" />
	<div class="flex-1 overflow-auto">
		{#each all_person as person}
			<PersonSummary {person} />
		{/each}
	</div>
	<!-- <div class="flex overflow-hidden rounded-md">
        <button
            class="flex-1 bg-blue-600 py-2 font-bold text-white hover:bg-blue-700"
            onclick={() => {}}
        >
            执行
        </button>
        <button class="flex-1 bg-gray-100 py-2 font-bold text-gray-900 hover:bg-gray-200">
            自动
        </button>
        <button class="flex-1 bg-yellow-500 py-2 font-bold text-white hover:bg-yellow-600">
            生成
        </button>
        <button class="flex-1 bg-gray-100 py-2 font-bold text-gray-900 hover:bg-gray-200">
            自动
        </button>
        <button class="flex-1 bg-green-500 py-2 font-bold text-white hover:bg-green-600">
            全自动
        </button>
    </div> -->
</div>
