<script module lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { cubicIn, cubicOut } from 'svelte/easing';
	import { writable } from 'svelte/store';
	import { fly } from 'svelte/transition';
	import type { NotificationProps } from './Notification.svelte';
	import { isSnippet } from '../SoC/soc';

	type NotificationInfo = {
		/** 通知ID 递增 */
		id: number;
		/** 通知内容 @render(id, data) */
		snippet?: Snippet<[number, any]>;
		/** 通知数据 */
		data: any;
		/** 是否被强制关闭 */
		force_close?: boolean;
		/** 通知显示时间 */
		show_time: number;
		/** 通知关闭时间, null 表示持续显示 */
		close_time: number | null;
	};

	/**
	 * 全局通知列表, 用于存储当前显示的通知信息
	 *
	 * 除了初始为空, 其余均要保存最后一个元素, 用于实现下一个通知的ID分配
	 */
	const notifications = writable<NotificationInfo[]>([]);

	/** 要显示 */
	const inTime = ({ show_time, close_time, force_close }: NotificationInfo, now: number) =>
		show_time <= now && (close_time === null || close_time > now) && !force_close;

	/** 未来显示 */
	const isFuture = ({ show_time, close_time, force_close }: NotificationInfo, now: number) =>
		show_time > now && (close_time === null || close_time > now) && !force_close;

	/**
	 * 添加全局通知信息
	 *
	 * 若设置持续显示, 需要使用 `removeNotification` 关闭, 否则会占用内存
	 * @param notification 通知内容 @render(id, data)
	 * @param data 通知数据
	 * @param duration 通知显示时间, 单位: 毫秒, null 表示持续显示, 默认 5000ms
	 * @param delay 通知显示延迟, 单位: 毫秒, 默认 0ms
	 */
	export function addNotification(
		notification: Snippet<[number, any]>,
		data: any,
		duration?: number | null,
		delay?: number,
	): void;

	/**
	 * 添加全局通知信息
	 *
	 * 若设置持续显示, 需要使用 `removeNotification` 关闭, 否则会占用内存
	 * @param data 通知内容
	 * @param duration 通知显示时间, 单位: 毫秒, null 表示持续显示, 默认 5000ms
	 * @param delay 通知显示延迟, 单位: 毫秒, 默认 0ms
	 */
	export function addNotification(
		data: NotificationProps,
		duration?: number | null,
		delay?: number,
	): void;

	export function addNotification(
		notification: Snippet<[number, any]> | NotificationProps | undefined,
		data?: any,
		duration?: number | null,
		delay?: number,
	) {
		if (!isSnippet(notification)) {
			delay = duration as number;
			duration = data;
			data = notification;
			notification = undefined;
		}
		if (delay === undefined) delay = 0;
		if (duration === undefined) duration = 5000;

		const now = Date.now();
		const show_time = now + delay;
		const close_time = duration ? show_time + duration : null;
		notifications.update((n) => {
			const oldId = n[n.length - 1]?.id;
			const id = oldId ? oldId + 1 : 1;
			return [
				...n.filter((n) => inTime(n, now)),
				{ id, snippet: notification, data, show_time, close_time },
			];
		});
	}

	export const removeNotification = (id: number) => {
		notifications.update((all) => {
			const now = Date.now();
			for (const n of all) {
				if (n.id === id) {
					n.force_close = true;
					break;
				}
			}
			return all.filter((n, i) => i == all.length - 1 || inTime(n, now));
		});
	};
</script>

<script lang="ts">
	import Notification from './Notification.svelte';

	let list: Record<number, NotificationInfo> = $state({});
	onMount(() => {
		notifications.subscribe((all) => {
			const time = Date.now();
			const avaiable = all.filter((n) => inTime(n, time));

			const regClose = ({ id, close_time }: NotificationInfo) => {
				if (close_time !== null) {
					setTimeout(() => {
						delete list[id];
					}, close_time! - time);
				}
			};

			const news = avaiable.filter(({ id }) => !list[id]);
			news.forEach(regClose);

			const obj: typeof list = {};
			avaiable.forEach((n) => (obj[n.id] = n));
			list = obj;

			all
				.filter((n) => isFuture(n, time))
				.forEach((n) => {
					setTimeout(() => {
						regClose(n);
						list[n.id] = n;
					}, n.show_time - time);
				});
		});
	});
</script>

<!-- @component
通知列表, 用于全局显示通知信息, 此组件只应由顶层组件调用, 页面中只能存在一个
 -->

<div
	class="fixed bottom-0 right-0 flex h-screen w-screen flex-col-reverse items-end"
	style="pointer-events: none;z-index: 10000"
>
	{#each Object.values(list) as { id, snippet, data } (id)}
		<div
			class="relative mr-2 mt-4 w-full max-w-sm rounded-lg shadow-lg shadow-gray-400 dark:shadow-gray-700"
			style="pointer-events: auto;"
			in:fly={{ x: 384, y: 0, duration: 100, easing: cubicOut }}
			out:fly={{ x: 0, y: 100, duration: 100, easing: cubicIn }}
		>
			{#if snippet}
				{@render snippet(id, data)}
			{:else}
				<Notification {...data} />
			{/if}
		</div>
	{/each}
</div>
