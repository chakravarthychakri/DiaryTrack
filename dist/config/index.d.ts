/**
 * DairyTrack Application Configuration
 * Secure Supabase credentials & Environment Settings
 */
export interface AppConfig {
    env: string;
    port: number;
    corsOrigin: string | string[];
    supabase: {
        url: string;
        anonKey: string;
        serviceRoleKey: string;
    };
    jwt: {
        secret: string;
        expiresIn: string;
    };
    defaultShopId: string;
    rateLimit: {
        windowMs: number;
        maxRequests: number;
        authMaxRequests: number;
    };
}
export declare const config: AppConfig;
