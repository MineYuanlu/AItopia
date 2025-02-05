<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import {
		color2Class,
		type BackgroundColor,
		type Color,
		type ColorLightable,
		type PreableColorPacks,
		type TextColor,
	} from '../color';
	import Button from '../Form/Button.svelte';
	import { fade, fly } from 'svelte/transition';
	import KeyListener from '../Global/KeyListener.svelte';
	import Openable, { type OpenableProps } from '../base/Openable.svelte';

	type OnClick = (e: MouseEvent) => boolean | void;

	type BtnProp = {
		label?: string;
		onClick?: OnClick;
		color?: PreableColorPacks;
	};
	type Toggle = (open?: boolean) => void;
	let {
		class: className,
		icon: Icon,
		iconColor = 'blue',
		iconSnippet,
		title,
		content,
		body,
		btns: _btns = [],
		footer,
		onCancel = () => toggleModal(false),
		onConfirm = () => toggleModal(false),
		closeOnOutsideClick = true,
		closeOnEscape = true,

		open = $bindable(false),
		controls,
		preOpen,
		postOpen,
		preClose,
		postClose,
	}: {
		/** 弹窗类名 */
		class?: string;
		/** 图标组件 */
		icon?: Component | any;
		/** 图标颜色 / [文字颜色/背景颜色]*/
		iconColor?: ColorLightable | [TextColor | Color, BackgroundColor | Color];
		iconSnippet?: Snippet<[Toggle]>;
		title?: Snippet<[Toggle]> | string;
		content?: Snippet<[Toggle]> | string;
		body?: Snippet<[Toggle]>;
		/**
		 * 按钮组, 将从右向左依次渲染, 支持以下类型数据:
		 * - 按钮文本: `string` / `[string]` / `[string, string]` 按钮文本, 使用内置 `blue`,`secondary` 颜色
		 * - 按钮配置: `{ label; onClick?; color? }` 按钮配置, 自定义颜色和事件
		 *
		 * 如果前2个按钮未设置onClick, 将使用默认的onConfirm和onCancel事件
		 *
		 * `onClick`: 按钮点击事件, 返回 `false` 可阻止关闭弹窗
		 */
		btns?:
			| { label: string; onClick?: OnClick; color?: PreableColorPacks }[]
			| string
			| [string]
			| [string, string];
		footer?: Snippet;
		/** 取消按钮事件, 返回`false`可阻止关闭弹窗, 可以被`btns`内的`onClick`覆盖 */
		onCancel?: OnClick;
		/** 确认按钮事件, 返回`false`可阻止关闭弹窗, 可以被`btns`内的`onClick`覆盖 */
		onConfirm?: OnClick;
		/**是否允许点击外面关闭面板 (默认true) */
		closeOnOutsideClick?: boolean;
		/**是否允许按Esc关闭面板 (默认true) */
		closeOnEscape?: boolean;
	} & OpenableProps = $props();

	const _fallbackBtns: BtnProp[] = $derived([
		{ onClick: onConfirm, color: 'blue' },
		{ onClick: onCancel, color: 'secondary' },
	]);

	const _getBtns = (() => {
		function merge(btn: (typeof _btns)[number], fb: (typeof _fallbackBtns)[number]): BtnProp {
			if (typeof btn === 'string') btn = { label: btn };
			return {
				label: btn.label,
				onClick: btn?.onClick || fb.onClick,
				color: btn?.color || fb.color,
			};
		}
		return (btns: typeof _btns, fbs: typeof _fallbackBtns): BtnProp[] => {
			if (typeof btns === 'string') btns = [btns];
			return btns.map((btn, i) => (i < fbs.length ? merge(btn, fbs[i]) : btn)) as BtnProp[];
			// if (btns.length === 1) return [merge(btns[0], fbs[0])];
			// else if (btns.length === 2) return [merge(btns[0], fbs[0]), merge(btns[1], fbs[1])];
			// else return btns as BtnProp[];
		};
	})();

	const btns = $derived(_getBtns(_btns, _fallbackBtns));
	/**
	 * 切换弹窗状态
	 * @param o 弹窗状态, 传入`true`打开弹窗, 传入`false`关闭弹窗, 不传入则切换弹窗状态
	 */
	function toggleModal(o?: boolean) {
		open = o ?? !open;
	}
</script>

<Openable bind:open {controls} {preOpen} {postOpen} {preClose} {postClose} overBox>
	<div class="contents" aria-labelledby="modal-title" role="dialog" aria-modal="true">
		<!--
      Background backdrop, show/hide based on modal state.
  
      Entering: "ease-out duration-300"
        From: "opacity-0"
        To: "opacity-100"
      Leaving: "ease-in duration-200"
        From: "opacity-100"
        To: "opacity-0"
    -->
		<div
			class="backdrop-blur-xs fixed inset-0 bg-gray-500/75 transition-opacity"
			aria-hidden="true"
			transition:fade={{ duration: 100 }}
		>
			{#if closeOnEscape}
				<KeyListener handler={() => toggleModal(false)} key="Escape" />
			{/if}

			<div class="fixed inset-0 z-10 w-screen overflow-y-auto">
				<div
					class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0"
					aria-hidden="true"
					onclick={(e) => {
						if (closeOnOutsideClick && e.target === e.currentTarget) toggleModal(false);
					}}
				>
					<!--
          Modal panel, show/hide based on modal state.
  
          Entering: "ease-out duration-300"
            From: "opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            To: "opacity-100 translate-y-0 sm:scale-100"
          Leaving: "ease-in duration-200"
            From: "opacity-100 translate-y-0 sm:scale-100"
            To: "opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
        -->
					<div
						class="relative w-full transform overflow-visible rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:max-w-xl lg:max-w-5xl dark:bg-gray-800 {className}"
						in:fly={{ y: 50, opacity: 0.5, duration: 100 }}
						out:fly={{ y: -50, opacity: 0, duration: 100 }}
					>
						{#if body}
							{@render body(toggleModal)}
						{:else}
							<div class="w-full bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4 dark:bg-gray-800">
								<div class="sm:flex sm:items-start">
									{#if iconSnippet}
										{@render iconSnippet(toggleModal)}
									{:else if Icon}
										{@const txtColor = color2Class(
											'text',
											typeof iconColor === 'string' ? iconColor : iconColor[0],
											'600',
										)}
										{@const bgColor = color2Class(
											'bg',
											typeof iconColor === 'string' ? iconColor : iconColor[1],
											'100',
										)}
										<div
											class="mx-auto flex size-12 shrink-0 items-center justify-center rounded-full {bgColor} sm:mx-0 sm:size-10"
										>
											<Icon class="size-6 {txtColor}" />
										</div>
									{/if}
									<div class="mt-3 text-center sm:mt-0 sm:flex-1 sm:text-left">
										{#if typeof title === 'string'}
											<h3
												class="text-base font-semibold text-gray-900 dark:text-gray-100"
												id="modal-title"
											>
												{title}
											</h3>
										{:else if title}
											{@render title(toggleModal)}
										{/if}

										{#if typeof content === 'string'}
											<div class="mt-2">
												<p class="text-sm text-gray-500 dark:text-gray-400">
													{content}
												</p>
											</div>
										{:else if content}
											{@render content(toggleModal)}
										{/if}
									</div>
								</div>
							</div>
						{/if}
						{#if footer}
							{@render footer()}
						{:else}
							<div
								class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 dark:bg-gray-700"
							>
								{#each btns as { label, onClick, color = 'blue' }}
									<Button
										class="ml-3 justify-center"
										{color}
										onclick={(e) => {
											if (onClick && onClick(e) === false) return;
											toggleModal(false);
										}}
									>
										{label}
									</Button>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</Openable>
