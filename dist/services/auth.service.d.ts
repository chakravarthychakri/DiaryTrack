export interface UserRecord {
    id: string | number;
    name: string;
    email: string;
    username: string;
    role: string;
    shop_id?: string | number;
}
export declare class AuthService {
    /**
     * User login with username/email and password
     */
    static login(credentials: {
        username: string;
        password: string;
    }): Promise<{
        token: string;
        user: UserRecord;
    }>;
    /**
     * Register new user profile
     */
    static register(data: {
        username: string;
        password: string;
        name: string;
        email: string;
        role?: string;
        shop_id?: string;
    }): Promise<UserRecord>;
    /**
     * Logout helper (clears session context)
     */
    static logout(): Promise<{
        loggedOut: boolean;
    }>;
}
