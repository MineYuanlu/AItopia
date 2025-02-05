<script>
	/**是否以title形式展示*/
	export let title = false;
</script>

<div
	class={`w-full px-4 py-2 text-left ${title ? 'pt-2 text-xs text-gray-500 dark:text-gray-300' : 'text-sm font-medium text-gray-700 dark:text-gray-200'}`}
>
	<slot />
</div>
