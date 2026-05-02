import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { config } from 'dotenv';

// Load .env for test environments where SvelteKit hasn't set up $env/dynamic/private
config({ path: '.env' });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbInstance = BetterSQLite3Database<any>;

let clientInstance: Database.Database | null = null;
let dbInstance: DbInstance | null = null;

export function getDb(): DbInstance {
	if (!dbInstance) {
		// Try DATABASE_URL from various sources
		const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL;
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
