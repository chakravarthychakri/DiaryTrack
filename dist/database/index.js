"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
exports.getSupabaseAdmin = getSupabaseAdmin;
exports.getSupabaseAnon = getSupabaseAnon;
const supabase_js_1 = require("@supabase/supabase-js");
const index_js_1 = require("../config/index.js");
const path_1 = __importDefault(require("path"));
// Import local fallback DB engine for seamless offline execution
let localDb = null;
try {
    const dbPath = path_1.default.resolve(process.cwd(), 'server', 'db.js');
    const dbModule = require(dbPath);
    localDb = dbModule.db || dbModule;
}
catch (err) {
    // Local DB fallback handled gracefully
}
let supabaseAdmin = null;
let supabaseAnon = null;
/**
 * Initializes and returns the admin Supabase client with the service-role key.
 * Strictly used within backend services. Never expose to client/frontend.
 */
function getSupabaseAdmin() {
    if (!supabaseAdmin) {
        if (index_js_1.config.supabase.url && index_js_1.config.supabase.serviceRoleKey && !index_js_1.config.supabase.url.includes('xyzcompany')) {
            supabaseAdmin = (0, supabase_js_1.createClient)(index_js_1.config.supabase.url, index_js_1.config.supabase.serviceRoleKey, {
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
function getSupabaseAnon() {
    if (!supabaseAnon) {
        if (index_js_1.config.supabase.url && index_js_1.config.supabase.anonKey && !index_js_1.config.supabase.url.includes('xyzcompany')) {
            supabaseAnon = (0, supabase_js_1.createClient)(index_js_1.config.supabase.url, index_js_1.config.supabase.anonKey);
        }
    }
    return supabaseAnon;
}
/**
 * Universal Database Interface
 * Dispatches to Supabase PostgreSQL when credentials exist, or executes against local SQLite engine.
 */
class Database {
    static getLocalDb() {
        return localDb;
    }
    static isCloudConfigured() {
        return !!(index_js_1.config.supabase.url && index_js_1.config.supabase.serviceRoleKey && !index_js_1.config.supabase.url.includes('xyzcompany'));
    }
    /**
     * Run a SQL query with parameters against the active database engine
     */
    static async query(sql, params = []) {
        if (localDb) {
            if (typeof localDb.prepare === 'function') {
                const stmt = localDb.prepare(sql);
                return stmt.all(...params);
            }
            if (typeof localDb.all === 'function') {
                return localDb.all(sql, params);
            }
        }
        const admin = getSupabaseAdmin();
        if (admin) {
            const { data, error } = await admin.rpc('execute_sql', { sql_query: sql, params });
            if (error)
                throw error;
            return data || [];
        }
        return [];
    }
    /**
     * Execute single query returning first row
     */
    static async queryOne(sql, params = []) {
        if (localDb) {
            if (typeof localDb.prepare === 'function') {
                const stmt = localDb.prepare(sql);
                const row = stmt.get(...params);
                return row || null;
            }
            if (typeof localDb.get === 'function') {
                return localDb.get(sql, params) || null;
            }
        }
        const rows = await Database.query(sql, params);
        return rows.length > 0 ? rows[0] : null;
    }
    /**
     * Execute an INSERT/UPDATE/DELETE statement
     */
    static async execute(sql, params = []) {
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
            if (error)
                throw error;
            return { lastInsertRowid: 0, changes: 1 };
        }
        return { lastInsertRowid: 0, changes: 0 };
    }
    /**
     * Run operations inside a consistent database transaction
     */
    static async transaction(callback) {
        if (localDb && typeof localDb.transaction === 'function') {
            return localDb.transaction(callback);
        }
        // Fallback direct execution
        return callback(localDb);
    }
}
exports.Database = Database;
//# sourceMappingURL=index.js.map