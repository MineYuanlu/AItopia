<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import { overBoxs } from '$lib/components/common';
	let { children } = $props();
</script>

<main class="flex h-screen w-screen overflow-auto">
	{@render children()}
</main>
<div id="overBox" class="fixed left-0 top-0 z-50 contents size-0">
	{#each Object.values($overBoxs) as overBox}
		{@render overBox()}
	{/each}
</div>
