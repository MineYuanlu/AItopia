<script lang="ts">
	import { onMount } from 'svelte';

	const {
		key,
		handler,
	}: {
		key: string | string[];
		handler: (e: KeyboardEvent) => void;
	} = $props();

	function handleKeyDown(event: KeyboardEvent) {
		if (handler && (Array.isArray(key) ? key.includes(event.key) : event.key === key))
			handler(event);
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

<!-- @component
全局按键监听器, 仅脚本

exampe:
```svelte
<KeyListener key="Escape" handler={() => (open = false)} />
```
 -->
