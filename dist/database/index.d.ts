import { SupabaseClient } from '@supabase/supabase-js';
declare let localDb: any;
/**
 * Initializes and returns the admin Supabase client with the service-role key.
 * Strictly used within backend services. Never expose to client/frontend.
 */
export declare function getSupabaseAdmin(): SupabaseClient | null;
/**
 * Returns the public anonymous Supabase client.
 */
export declare function getSupabaseAnon(): SupabaseClient | null;
/**
 * Universal Database Interface
 * Dispatches to Supabase PostgreSQL when credentials exist, or executes against local SQLite engine.
 */
export declare class Database {
    static getLocalDb(): any;
    static isCloudConfigured(): boolean;
    /**
     * Run a SQL query with parameters against the active database engine
     */
    static query<T = any>(sql: string, params?: any[]): Promise<T[]>;
    /**
     * Execute single query returning first row
     */
    static queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
    /**
     * Execute an INSERT/UPDATE/DELETE statement
     */
    static execute(sql: string, params?: any[]): Promise<{
        lastInsertRowid: number | string;
        changes: number;
    }>;
    /**
     * Run operations inside a consistent database transaction
     */
    static transaction<T>(callback: (db: typeof localDb) => Promise<T>): Promise<T>;
}
export {};
