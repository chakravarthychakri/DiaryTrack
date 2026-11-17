import { Database } from '../database/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/index.js';
import crypto from 'crypto';

export interface UserRecord {
  id: string | number;
  name: string;
  email: string;
  username: string;
  role: string;
  shop_id?: string | number;
}

export class AuthService {
  /**
   * User login with username/email and password
   */
  public static async login(credentials: { username: string; password: string }): Promise<{ token: string; user: UserRecord }> {
    const { username, password } = credentials;

    const user = await Database.queryOne<any>(
      `SELECT id, name, email, username, password_hash, salt, role, is_active FROM users 
       WHERE username = ? OR email = ?`,
      [username.trim(), username.trim()]
    );

    if (!user) {
      throw new AppError('Invalid username or password', 401);
    }

    if (user.is_active === 0) {
      throw new AppError('Account is deactivated. Please contact your store administrator.', 403);
    }

    // Verify Password (pbkdf2 with salt)
    let isPasswordValid = false;
    if (user.password_hash && user.salt) {
      const check = crypto.pbkdf2Sync(password, user.salt, 10000, 64, 'sha512').toString('hex');
      isPasswordValid = check === user.password_hash;
    } else if (user.password_hash) {
      const hashed = crypto.createHash('sha256').update(password).digest('hex');
      isPasswordValid = user.password_hash === password || user.password_hash === hashed;
    }

    if (!isPasswordValid) {
      throw new AppError('Invalid username or password', 401);
    }

    // Generate JWT-compatible secure Bearer token payload
    const tokenPayload = {
      sub: String(user.id),
      id: String(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      shop_id: config.defaultShopId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    };

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', config.jwt.secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    const token = `${header}.${payload}.${signature}`;

    const userRecord: UserRecord = {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      shop_id: config.defaultShopId,
    };

    return { token, user: userRecord };
  }

  /**
   * Register new user profile
   */
  public static async register(data: {
    username: string;
    password: string;
    name: string;
    email: string;
    role?: string;
    shop_id?: string;
  }): Promise<UserRecord> {
    const existing = await Database.queryOne(
      `SELECT id FROM users WHERE username = ? OR email = ?`,
      [data.username.trim(), data.email.trim()]
    );

    if (existing) {
      throw new AppError('Username or email already in use', 409);
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const password_hash = crypto.pbkdf2Sync(data.password, salt, 10000, 64, 'sha512').toString('hex');
    const role = data.role || 'Shopkeeper';

    const result = await Database.execute(
      `INSERT INTO users (username, password_hash, salt, name, email, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [data.username.trim(), password_hash, salt, data.name.trim(), data.email.trim(), role]
    );

    return {
      id: result.lastInsertRowid,
      name: data.name,
      email: data.email,
      username: data.username,
      role,
      shop_id: config.defaultShopId,
    };
  }

  /**
   * Logout helper (clears session context)
   */
  public static async logout(): Promise<{ loggedOut: boolean }> {
    return { loggedOut: true };
  }
}
