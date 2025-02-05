<script lang="ts" module>
	export type MainTypes = 'log' | 'details';
</script>

<script lang="ts">
	import { browser } from '$app/environment';
	import { Env, GameScene, House, loadGame, Person, Room } from '$lib/game/core';
	import persons_attr from './summon/person/defaults.json';
	import defaultGame from './defaults.json';
	import Controls from './Controls.svelte';
	import LogPanel from './LogPanel.svelte';

	const persons = (() => {
		const persons = persons_attr
			.map((person) => new Person(person as any))
			.sort(() => Math.random() - 0.5);
		let split = 5;
		const groups: Person[][] = Array.from({ length: split }, () => []);
		for (let i = 0; i < persons.length; i++) {
			groups[i % split].push(persons[i]);
		}
		return groups;
	})();

	let gameID = 1;
	let game = $state(
		new GameScene(
			{ name: '全局' },
			[],
			[...persons[0]],
			[
				new House(
					{
						名称: '温馨小屋101',
						地址: '北京市海淀区西二旗北路10号院1号楼1单元101室',
						户型: '1室1厅1卫',
						面积: 120,
						朝向: '南',
						描述: '精装',
						房间: [],
					},
					[],
					[...persons[1]],
					[
						new Room(
							{
								房子: '温馨小屋101',
								名称: '客厅',
								位置: '东南角',
								描述: '客厅',
								物品: [],
							},
							[],
							[...persons[2]],
						),
						new Room(
							{
								房子: '温馨小屋101',
								名称: '卧室',
								位置: '东南角',
								描述: '卧室',
								物品: [],
							},
							[],
							[...persons[3]],
						),
						new Room(
							{
								房子: '温馨小屋101',
								名称: '厨房',
								位置: '东南角',
								描述: '厨房',
								物品: [],
							},
							[],
							[...persons[4]],
						),
					],
				),
			],
		),
	);
	game = loadGame(defaultGame);
	// svelte-ignore state_referenced_locally
	if (browser) console.log(game);

	let main_type: MainTypes = $state('log');

	function doRun() {}
</script>

<div class="flex h-screen w-screen">
	<div class="main flex border-r border-gray-200">
		{#if main_type === 'log'}
			<LogPanel {gameID} />
		{:else}
			TODO
		{/if}
	</div>
	<div class="controls">
		<Controls {game} bind:main_type />
	</div>
</div>

<style>
	.main {
		width: 80%;
	}
	.controls {
		/* flex: 0 0 20%; */
		width: 20%;
	}
</style>
