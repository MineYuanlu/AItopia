<script lang="ts">
	import { setOverBoxs, type OverBox } from '$lib/stores/common';

	const { children }: { children: OverBox } = $props();
	setOverBoxs(children);
</script>

<!-- @component
这是全局组件，用于在页面上层显示一个覆盖层, 脱离页面布局
 -->
