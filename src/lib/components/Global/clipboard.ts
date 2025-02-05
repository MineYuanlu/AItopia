import {
	util_copy_to_clipboard__failed_message,
	util_copy_to_clipboard__failed_title,
} from '$lib/paraglide/messages';
import { addNotification } from '../Notifications/NotificationList.svelte';

export const copyToClipboard = async (textToCopy: string) => {
	try {
		navigator.clipboard.writeText(textToCopy);
	} catch (err) {
		addNotification({
			title: util_copy_to_clipboard__failed_title(),
			message: util_copy_to_clipboard__failed_message(),
		});
		return false;
	}
	return true;
};
