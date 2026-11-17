import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import path from 'path';

// Import local fallback DB engine for seamless offline execution
let localDb: any = null;
try {
  const dbPath = path.resolve(process.cwd(), 'server', 'db.js');
  const dbModule = require(dbPath);
  localDb = dbModule.db || dbModule;
} catch (err) {
  // Local DB fallback handled gracefully
}

let supabaseAdmin: SupabaseClient | null = null;
let supabaseAnon: SupabaseClient | null = null;

/**
 * Initializes and returns the admin Supabase client with the service-role key.
 * Strictly used within backend services. Never expose to client/frontend.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!supabaseAdmin) {
    if (config.supabase.url && config.supabase.serviceRoleKey && !config.supabase.url.includes('xyzcompany')) {
      supabaseAdmin = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
  }
  return supabaseAdmin;
}

/**
 * Returns the public anonymous Supabase client.
 */
export function getSupabaseAnon(): SupabaseClient | null {
  if (!supabaseAnon) {
    if (config.supabase.url && config.supabase.anonKey && !config.supabase.url.includes('xyzcompany')) {
      supabaseAnon = createClient(config.supabase.url, config.supabase.anonKey);
    }
  }
  return supabaseAnon;
}

/**
 * Universal Database Interface
 * Dispatches to Supabase PostgreSQL when credentials exist, or executes against local SQLite engine.
 */
export class Database {
  public static getLocalDb() {
    return localDb;
  }

  public static isCloudConfigured(): boolean {
    return !!(config.supabase.url && config.supabase.serviceRoleKey && !config.supabase.url.includes('xyzcompany'));
  }

  /**
   * Run a SQL query with parameters against the active database engine
   */
  public static async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (localDb) {
      if (typeof localDb.prepare === 'function') {
        const stmt = localDb.prepare(sql);
        return stmt.all(...params) as T[];
      }
      if (typeof localDb.all === 'function') {
        return localDb.all(sql, params);
      }
    }
    const admin = getSupabaseAdmin();
    if (admin) {
      const { data, error } = await admin.rpc('execute_sql', { sql_query: sql, params });
      if (error) throw error;
      return (data as T[]) || [];
    }
    return [];
  }

  /**
   * Execute single query returning first row
   */
  public static async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    if (localDb) {
      if (typeof localDb.prepare === 'function') {
        const stmt = localDb.prepare(sql);
        const row = stmt.get(...params);
        return (row as T) || null;
      }
      if (typeof localDb.get === 'function') {
        return localDb.get(sql, params) || null;
      }
    }
    const rows = await Database.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Execute an INSERT/UPDATE/DELETE statement
   */
  public static async execute(sql: string, params: any[] = []): Promise<{ lastInsertRowid: number | string; changes: number }> {
    if (localDb) {
      if (typeof localDb.prepare === 'function') {
        const stmt = localDb.prepare(sql);
        const info = stmt.run(...params);
        return {
          lastInsertRowid: info.lastInsertRowid !== undefined ? Number(info.lastInsertRowid) : 0,
          changes: info.changes !== undefined ? Number(info.changes) : 0,
        };
      }
      if (typeof localDb.run === 'function') {
        return localDb.run(sql, params);
      }
    }
    const admin = getSupabaseAdmin();
    if (admin) {
      const { error } = await admin.rpc('execute_sql', { sql_query: sql, params });
      if (error) throw error;
      return { lastInsertRowid: 0, changes: 1 };
    }
    return { lastInsertRowid: 0, changes: 0 };
  }

  /**
   * Run operations inside a consistent database transaction
   */
  public static async transaction<T>(callback: (db: typeof localDb) => Promise<T>): Promise<T> {
    if (localDb && typeof localDb.transaction === 'function') {
      return localDb.transaction(callback);
    }
    // Fallback direct execution
    return callback(localDb);
  }
}
