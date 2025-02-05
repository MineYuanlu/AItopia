<script lang="ts">
	import { apiGameLog } from '$lib/api';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import type { GameScene } from '$lib/game/core';
	import { get_time_str } from '$lib/utils';
	import type { Resp as LogResp } from '../api/game/log/+server';

	const { gameID }: { gameID: number } = $props();

	let roles = ['user1', 'user2', 'events', 'judge', 'god'];
	let system_logs = Array(100)
		.fill(0)
		.map(
			() =>
				`[${new Date((Math.random() * 1000000) | 0).toLocaleString()}] [${roles[Math.floor(Math.random() * roles.length)]}] Messages`,
		);
	let game_logs = system_logs.slice().sort(() => Math.random() - 0.5);

	let targets: [string | null, string | null] = [null, 'system'];
</script>

{#snippet logs(idx: 0 | 1)}
	<div class="logs h-full overflow-auto border-r border-gray-800 p-1 text-sm">
		{#await apiGameLog({ game: gameID, target: targets[idx] ?? undefined, getTo: true })}
			<div class="loading">LOADING</div>
		{:then { logs, cursor }}
			{#each logs.sort( (a, b) => (a.time !== b.time ? a.time - b.time : a.id - b.id), ) as { id, time, type, src, msg, target }}
				{@const log = `[${get_time_str(time)}] [${type}] [${src}] ${msg}`}
				<Tooltip tooltip={(target ?? []).slice().sort().join(', ')} toolTipPre pos="inner-right">
					<pre class="inline-block w-full hover:bg-gray-200">{log}</pre>
				</Tooltip>
			{/each}
		{/await}
	</div>
{/snippet}

{@render logs(0)}

<!-- {@render logs(1)} -->

<style>
	.logs {
		/* width: 50%; */
		width: 100%;
	}
</style>
