<script lang="ts">
	import type { Snippet } from 'svelte';

	const { children, title }: { children: Snippet; title?: string } = $props();
</script>

<div class="container mx-auto p-6">
	{#if title}
		<h1 class="mb-8 text-3xl font-bold text-gray-800 dark:text-gray-100">{title}</h1>
	{/if}
	{@render children()}
</div>
