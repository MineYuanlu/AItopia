<script lang="ts">
	import { onMount } from 'svelte';

	let {
		key,
		handler,
		handlerDown,
		handlerUp,
		down = $bindable(false),
		downs = $bindable({}),
	}: {
		/** 监听的按键 */
		key: string | string[];
		/** 按键按下/松开时触发 */
		handler?: (e: KeyboardEvent) => void;
		/** 按键按下时触发 */
		handlerDown?: (e: KeyboardEvent) => void;
		/** 按键松开时触发 */
		handlerUp?: (e: KeyboardEvent) => void;
		/** 按键是否按下 */
		down?: boolean;
		/** 按键是否按下, `{key: boolean}` */
		downs?: Record<string, boolean>;
	} = $props();

	function handleKeyDown(event: KeyboardEvent) {
		if (Array.isArray(key) ? key.includes(event.key) : event.key === key) {
			down = true;
			downs[event.key] = true;
			handler?.(event);
			handlerDown?.(event);
		}
	}

	function handleKeyUp(event: KeyboardEvent) {
		if (Array.isArray(key) ? key.includes(event.key) : event.key === key) {
			down = false;
			downs[event.key] = false;
			handler?.(event);
			handlerUp?.(event);
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
		};
	});
</script>

<!-- @component
全局按键监听器, 仅脚本

exampe:
```svelte
<KeyDownUpListener key="Escape" bind:down />
```
 -->
