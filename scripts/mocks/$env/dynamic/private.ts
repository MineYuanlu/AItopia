/**
 * Mock for SvelteKit's $env/dynamic/private module.
 * Used by CLI scripts that run outside of Vite/SvelteKit.
 *
 * IMPORTANT: This returns a Proxy so that process.env mutations
 * made AFTER this module is imported are still visible.
 */
export const env = new Proxy({} as Record<string, string | undefined>, {
	get(_target, prop) {
		if (typeof prop === 'string') {
			return process.env[prop];
		}
		return undefined;
	},
	has(_target, prop) {
		if (typeof prop === 'string') {
			return prop in process.env;
		}
		return false;
	}
});
