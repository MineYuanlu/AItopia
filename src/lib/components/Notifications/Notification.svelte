<script module lang="ts">
	type NotiType = 'info' | 'success' | 'warning' | 'error' | 'normal';
	export const notiTypes = ['info', 'success', 'warning', 'error', 'normal'] as const;

	export type NotificationProps = {
		type?: NotiType;
		icon?: AnyIconType | boolean;
		title?: string | Snippet;
		message?: string | Snippet;
		content?: SoC;
		btn1?: string | SoC;
		btnColor1?: ColorPack | PreSetColorPacks;
		action1?: () => void;
		btn2?: string | SoC;
		btnColor2?: ColorPack | PreSetColorPacks;
		action2?: () => void;
		showClose?: boolean;
	};

	const borderColors: Record<NotiType, string> = {
		info: 'border-blue-500',
		success: 'border-green-500',
		warning: 'border-yellow-500',
		error: 'border-red-500',
		normal: 'border-gray-200 dark:border-gray-600',
	};

	const bgColors: Record<NotiType, string> = {
		info: 'bg-blue-500',
		success: 'bg-green-500',
		warning: 'bg-yellow-500',
		error: 'bg-red-500',
		normal: 'bg-gray-200 dark:bg-gray-600',
	};
	const textColors: Record<NotiType, string> = {
		info: 'text-blue-500',
		success: 'text-green-500',
		warning: 'text-yellow-500',
		error: 'text-red-500',
		normal: 'text-gray-200 dark:text-gray-600',
	};
</script>

<script lang="ts">
	import { isComponent, isSnippet, type SoC } from '../SoC/soc';
	import AnyIcon, { type AnyIconType } from '../Icons/AnyIcon.svelte';
	import type { Snippet } from 'svelte';
	import Button from '../Form/Button.svelte';
	import { type ColorPack, type PreSetColorPacks } from '../color';
	import Openable, { type OpenableProps } from '../base/Openable.svelte';

	let {
		type = 'info',

		icon,
		title,
		message,
		content: Content,
		btn1,
		btnColor1 = 'info',
		action1,
		btn2,
		btnColor2 = 'secondary',
		action2,
		showClose = false,

		open = $bindable(true),
		preOpen,
		postOpen,
		preClose,
		postClose,
	}: NotificationProps & OpenableProps = $props();
</script>

<Openable bind:open {preOpen} {postOpen} {preClose} {postClose}>
	<div
		class="relative w-full max-w-sm rounded-lg border-l-4 bg-white p-4 shadow-lg dark:bg-gray-800 {borderColors[
			type
		]}"
	>
		{#if isSnippet(Content)}
			{@render Content()}
		{:else if isComponent(Content)}
			<Content />
		{:else}
			{#if icon || title}
				<div class="flex items-center">
					<!-- 图标 -->
					{#if icon}
						{#if icon === true}
							<div class="mr-3 rounded-full {bgColors[type]} p-2"></div>
						{:else}
							<AnyIcon {icon} class="mr-2 h-4 w-4 {textColors[type]}" />
						{/if}
					{/if}

					<!-- 标题 -->
					{#if typeof title === 'string'}
						<div class="text-lg font-semibold text-gray-800 dark:text-gray-200">{title}</div>
					{:else if isSnippet(title)}
						{@render title()}
					{/if}
				</div>
			{/if}

			<!-- 消息正文 -->
			{#if typeof message === 'string'}
				<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
					{message}
				</p>
			{:else if isSnippet(message)}
				{@render message()}
			{/if}

			<!-- 按钮组 -->
			{#if btn1 || btn2}
				<div class="mt-4 flex space-x-2">
					{#snippet btns(
						Btn?: string | SoC,
						color?: ColorPack | PreSetColorPacks,
						action?: () => void,
					)}
						{#if typeof Btn === 'string'}
							<Button class="rounded-md px-4 py-2" onclick={action} {color}>
								{Btn}
							</Button>
						{:else if isSnippet(Btn)}
							{@render Btn()}
						{:else if isComponent(Btn)}
							<Btn onclick={action} {color} />
						{/if}
					{/snippet}
					{#if btn1}{@render btns(btn1, btnColor1, action1)}{/if}
					{#if btn2}{@render btns(btn2, btnColor2, action2)}{/if}
				</div>
			{/if}

			<!-- 关闭按钮 -->
			{#if showClose}
				<div class="absolute right-2 top-2">
					<button
						type="button"
						class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
						onclick={() => (open = false)}
					>
						<span class="sr-only">Close</span>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
							aria-hidden="true"
							class="h-5 w-5"
						>
							<path
								d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
							></path>
						</svg>
					</button>
				</div>
			{/if}
		{/if}
	</div>
</Openable>
