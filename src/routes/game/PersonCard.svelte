<script lang="ts">
	import type { Person } from '$lib/game/core';

	const { person }: { person: Person } = $props();
</script>

<div class="person-card rounded-md border border-gray-200 p-4">
	<h6>{person.attr.名称}</h6>
</div>
