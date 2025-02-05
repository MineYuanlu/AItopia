<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	const {
		children,
		class: clazz,
		noborder = false,
		...props
	}: {
		children: Snippet;
		class?: string;
		noborder?: boolean;
	} & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div
	class="btn-group flex overflow-hidden rounded-md {clazz}"
	class:btn-group-noborder={noborder}
	{...props}
>
	{@render children()}
</div>

<style>
	.btn-group > :global(.btn) {
		border-radius: 0;
		flex: 1 1 0%;
	}
	.btn-group > :global(.btn):not(:first-child) {
		border-left: 0;
	}
	.btn-group > :global(.btn):first-child {
		border-top-left-radius: 0.375rem;
		border-bottom-left-radius: 0.375rem;
	}
	.btn-group > :global(.btn):last-child {
		border-top-right-radius: 0.375rem;
		border-bottom-right-radius: 0.375rem;
	}
	.btn-group.btn-group-noborder > :global(.btn) {
		border: 0;
	}
</style>
