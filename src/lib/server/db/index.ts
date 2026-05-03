import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env for test environments where SvelteKit hasn't set up $env/dynamic/private.
// Prefer process.env directly since $env/dynamic/private may not see dotenv results
// in some build/test contexts.
config({ path: resolve(process.cwd(), '.env') });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbInstance = BetterSQLite3Database<any>;

let clientInstance: Database.Database | null = null;
let dbInstance: DbInstance | null = null;

export function getDb(): DbInstance {
	if (!dbInstance) {
		// Priority: process.env (set by CLI/test runner first), then $env/dynamic/private fallback
		const dbUrl = process.env.DATABASE_URL || env.DATABASE_URL;
		if (!dbUrl) {
			throw new Error('DATABASE_URL is not set');
		}
		clientInstance = new Database(dbUrl);
		clientInstance.pragma('foreign_keys = ON');
		dbInstance = drizzle(clientInstance, { schema });
	}
	return dbInstance;
}

export function closeDb(): void {
	if (clientInstance) {
		clientInstance.close();
		clientInstance = null;
	}
	dbInstance = null;
}

export const db: DbInstance = new Proxy({} as DbInstance, {
	get(_target, prop) {
		const instance = getDb();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return (instance as any)[prop];
	}
});
