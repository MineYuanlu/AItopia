<script lang="ts">
	import { onMount } from 'svelte';

	const {
		handler,
		exclude,
		nochild = false,
	}: {
		handler: (e: MouseEvent) => void;
		/**被排除的元素(数组)*/
		exclude?: HTMLElement | HTMLElement[];
		/**是否仅排除指定的元素, 不排除其子元素, 默认false*/
		nochild?: boolean;
	} = $props();

	function handleClick(event: MouseEvent) {
		const target = event.target;
		if (!handler || !target) return;
		if (exclude) {
			const isExcluded = (ex: HTMLElement) =>
				nochild ? ex === target : ex.contains(target as HTMLElement);
			if (Array.isArray(exclude) ? exclude.some(isExcluded) : isExcluded(exclude)) return;
		}
		handler(event);
	}

	onMount(() => {
		window.addEventListener('click', handleClick);

		return () => {
			window.removeEventListener('click', handleClick);
		};
	});
</script>

<!-- @component
全局点击监听器, 仅脚本

exampe:
```svelte
<ClickListener handler={() => (open = false)} exclude={element} />
```
 -->
