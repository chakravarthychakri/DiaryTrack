const express = require('express');
const cors = require('cors');
const path = require('node:path');
const {
  db,
  formatDate,
  addDays,
  hashPassword,
  verifyPassword,
  generateToken,
  logAudit,
  createDatabaseBackup,
  listDatabaseBackups
} = require('./db');
const {
  getSupabaseConfig,
  getSupabaseClient,
  supabaseSignIn,
  supabaseSignUp,
  supabaseResetPassword
} = require('./supabase');
const {
  generateSalesReport,
  generateInventoryReport,
  generateWasteReport,
  generatePurchasesReport,
  generateMasterBusinessReport,
  generateMovementsReport,
  generateSupplierPurchasesReport,
  generateCustomerSalesReport,
  generateAnalyticsReport
} = require('./reports');
const registerDashboardRoutes = require('./dashboard_routes');
const registerProductRoutes = require('./product_routes');
const registerInventoryRoutes = require('./inventory_routes');
const registerSalesRoutes = require('./sales_routes');
const registerPurchasesRoutes = require('./purchases_routes');
const registerMovementsRoutes = require('./movements_routes');
const registerSupplierRoutes = require('./supplier_routes');
const registerCustomerRoutes = require('./customer_routes');
const registerExpiryRoutes = require('./expiry_routes');
const registerAnalyticsRoutes = require('./analytics_routes');
const { registerNotificationRoutes, emitNotification } = require('./notification_routes');
const {
  generateMasterExcelJSWorkbook,
  generateSingleSheetExcelJS,
  getReportPreviewData,
  generatePrintableSummaryHtml
} = require('./excel_reports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Module 18: Security Headers Middleware (OWASP Hardening)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self';"
  );
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Helper to sanitize date strings
function getTodayDate() {
  return formatDate(new Date());
}

// -------------------------------------------------------------
// AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC) MIDDLEWARE
// -------------------------------------------------------------
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
  }

  // Find active session
  const session = db.prepare(`
    SELECT s.*, u.id as user_id, u.name, u.email, u.username, u.role, u.branch_id, u.is_active
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP
  `).get(token);

  if (!session) {
    return res.status(401).json({ success: false, error: 'Session expired or invalid. Please log in again.' });
  }

  if (!session.is_active) {
    return res.status(403).json({ success: false, error: 'Your account has been deactivated. Contact an Administrator.' });
  }

  req.user = {
    id: session.user_id,
    name: session.name,
    email: session.email,
    username: session.username,
    role: session.role,
    branch_id: session.branch_id
  };
  req.sessionToken = token;
  next();
}

// Optional Auth (for initial loads / public view transition)
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (token) {
    const session = db.prepare(`
      SELECT s.*, u.id as user_id, u.name, u.email, u.username, u.role, u.branch_id, u.is_active
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP
    `).get(token);

    if (session && session.is_active) {
      req.user = {
        id: session.user_id,
        name: session.name,
        email: session.email,
        username: session.username,
        role: session.role,
        branch_id: session.branch_id
      };
      req.sessionToken = token;
    }
  }
  next();
}

// Strict Role Enforcement Middleware
function requireRole(...roles) {
  const allowedRoles = Array.isArray(roles[0]) ? roles[0] : roles;
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logAudit(req.user.id, req.user.name, req.user.role, 'UNAUTHORIZED_ACCESS_ATTEMPT', req.baseUrl + req.path, null, `Denied access. Required: [${allowedRoles.join(', ')}]`, req.ip);
      return res.status(403).json({
        success: false,
        error: `Access Denied: Your role '${req.user.role}' lacks permission for this operation. Required role(s): ${allowedRoles.join(' or ')}.`
      });
    }

    next();
  };
}

// -------------------------------------------------------------
// MODULE 2.1: AUTHENTICATION ROUTES
// -------------------------------------------------------------

// 1. Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const login = req.body.login || req.body.email || req.body.username;
    const { password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ success: false, error: 'Email or Username and password are required.' });
    }

    // Try Supabase Auth first if configured
    let supabaseUser = null;
    try {
      const supaResult = await supabaseSignIn(login, password);
      if (supaResult && supaResult.user) {
        supabaseUser = supaResult.user;
      }
    } catch {
      // Fallback to local authentication
    }

    // Find local user record
    const user = db.prepare(`
      SELECT * FROM users
      WHERE email = ? OR username = ?
    `).get(login.toLowerCase().trim(), login.trim());

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid login credentials.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, error: 'Account is deactivated. Please contact an Administrator.' });
    }

    // Verify password hash
    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid && !supabaseUser) {
      logAudit(user.id, user.name, user.role, 'FAILED_LOGIN_ATTEMPT', 'USER', user.id, 'Incorrect password entered.', req.ip);
      return res.status(401).json({ success: false, error: 'Invalid login credentials.' });
    }

    // Create session token (expires in 7 days)
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES (?, ?, ?)
    `).run(user.id, token, expiresAt);

    // Update last_login
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    logAudit(user.id, user.name, user.role, 'LOGIN', 'USER', user.id, 'User logged in successfully.', req.ip);

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        branch_id: user.branch_id
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    const username = req.body.username || (email ? email.split('@')[0] : 'user_' + Date.now());

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
    }

    // Check duplicate
    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email.toLowerCase().trim(), username.trim());
    if (existing) {
      return res.status(400).json({ success: false, error: 'A user with this email or username already exists.' });
    }

    // Optional Supabase signup sync
    try {
      await supabaseSignUp(email, password, { name, role: role || 'Shopkeeper' });
    } catch {
      // Continue with local registration
    }

    const { hash, salt } = hashPassword(password);
    const assignedRole = role || 'Shopkeeper';

    const result = db.prepare(`
      INSERT INTO users (name, email, username, password_hash, salt, role, phone, branch_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)
    `).run(
      name,
      email.toLowerCase().trim(),
      username.trim(),
      hash,
      salt,
      assignedRole,
      phone || ''
    );

    const newUserId = Number(result.lastInsertRowid);

    // Generate session token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)').run(newUserId, token, expiresAt);

    logAudit(newUserId, name, assignedRole, 'REGISTRATION', 'USER', newUserId, 'New account registered.', req.ip);

    res.status(201).json({
      success: true,
      message: 'Account registered successfully!',
      token,
      user: {
        id: newUserId,
        name,
        email,
        username,
        role: assignedRole,
        branch_id: 1
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  try {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
    logAudit(req.user.id, req.user.name, req.user.role, 'LOGOUT', 'USER', req.user.id, 'User logged out.', req.ip);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email address is required.' });

    const user = db.prepare('SELECT id, name FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
      // Return generic message for security
      return res.json({ success: true, message: 'If an account exists with this email, password reset instructions have been generated.' });
    }

    // Try Supabase Auth password reset if configured
    try {
      await supabaseResetPassword(email);
    } catch { }

    // Generate 6-digit reset code & token (expires in 1 hour)
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run(resetToken, expiresAt, user.id);

    logAudit(user.id, user.name, 'Unknown', 'FORGOT_PASSWORD_REQUEST', 'USER', user.id, 'Password reset code generated.', req.ip);

    res.json({
      success: true,
      message: 'Password reset code generated successfully.',
      resetCode: resetToken // surfaced for testing in the UI
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Password Reset
app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { email, resetCode, newPassword } = req.body;
    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email, reset code, and new password are required.' });
    }

    const user = db.prepare(`
      SELECT * FROM users
      WHERE email = ? AND reset_token = ? AND reset_token_expires > CURRENT_TIMESTAMP
    `).get(email.toLowerCase().trim(), resetCode.trim());

    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset code.' });
    }

    const { hash, salt } = hashPassword(newPassword);

    db.prepare(`
      UPDATE users SET
        password_hash = ?,
        salt = ?,
        reset_token = NULL,
        reset_token_expires = NULL
      WHERE id = ?
    `).run(hash, salt, user.id);

    // Invalidate existing sessions for security
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

    logAudit(user.id, user.name, user.role, 'PASSWORD_RESET', 'USER', user.id, 'Password was reset successfully.', req.ip);

    res.json({ success: true, message: 'Password has been reset successfully! Please log in with your new password.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Current User Session Check
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

// -------------------------------------------------------------
// MODULE 2.3: USER MANAGEMENT & AUDIT LOGS (ADMINISTRATOR ONLY)
// -------------------------------------------------------------
app.get('/api/users', authenticateToken, requireRole(['Administrator']), (req, res) => {
  try {
    const users = db.prepare(`
      SELECT 
        u.id, u.name, u.username, u.email, u.role, u.phone, u.branch_id, u.is_active,
        u.last_login, u.created_at,
        br.name as branch_name,
        (SELECT COUNT(*) FROM sales WHERE cashier_id = u.id) as sales_count,
        (SELECT COUNT(*) FROM purchases WHERE created_by = u.name) as purchases_count
      FROM users u
      LEFT JOIN branches br ON u.branch_id = br.id
      ORDER BY u.id ASC
    `).all();

    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/users', authenticateToken, requireRole(['Administrator']), (req, res) => {
  try {
    const { name, email, username, password, role, branch_id, phone } = req.body;

    if (!name || !email || !username || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, username, and password are required.' });
    }

    const validRoles = ['Administrator', 'Manager', 'Shopkeeper'];
    const assignedRole = validRoles.includes(role) ? role : 'Shopkeeper';

    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email.toLowerCase().trim(), username.trim());
    if (existing) {
      return res.status(400).json({ success: false, error: 'A user with this email or username already exists.' });
    }

    const { hash, salt } = hashPassword(password);

    const result = db.prepare(`
      INSERT INTO users (name, email, username, password_hash, salt, role, branch_id, phone, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      name,
      email.toLowerCase().trim(),
      username.trim(),
      hash,
      salt,
      assignedRole,
      Number(branch_id) || 1,
      phone || ''
    );

    const newUserId = Number(result.lastInsertRowid);
    logAudit(req.user.id, req.user.name, req.user.role, 'CREATE_EMPLOYEE', 'USER', newUserId, `Created employee: ${name} (${assignedRole})`, req.ip);

    res.json({ success: true, id: newUserId, message: `Employee ${name} registered with role ${assignedRole}!` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/users/:id', authenticateToken, requireRole(['Administrator']), (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, email, username, role, branch_id, phone, password } = req.body;

    const validRoles = ['Administrator', 'Manager', 'Shopkeeper'];
    const assignedRole = validRoles.includes(role) ? role : 'Shopkeeper';

    if (password) {
      const { hash, salt } = hashPassword(password);
      db.prepare(`
        UPDATE users SET
          name = ?, email = ?, username = ?, role = ?, branch_id = ?, phone = ?,
          password_hash = ?, salt = ?
        WHERE id = ?
      `).run(name, email.toLowerCase().trim(), username.trim(), assignedRole, Number(branch_id) || 1, phone || '', hash, salt, id);
    } else {
      db.prepare(`
        UPDATE users SET
          name = ?, email = ?, username = ?, role = ?, branch_id = ?, phone = ?
        WHERE id = ?
      `).run(name, email.toLowerCase().trim(), username.trim(), assignedRole, Number(branch_id) || 1, phone || '', id);
    }

    logAudit(req.user.id, req.user.name, req.user.role, 'UPDATE_EMPLOYEE', 'USER', id, `Updated employee details: ${name} (${assignedRole})`, req.ip);

    res.json({ success: true, message: 'Employee updated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Activate or Deactivate Employee Account
app.patch('/api/users/:id/status', authenticateToken, requireRole(['Administrator']), (req, res) => {
  try {
    const id = Number(req.params.id);
    const { is_active } = req.body;

    if (id === req.user.id && !is_active) {
      return res.status(400).json({ success: false, error: 'You cannot deactivate your own Administrator account!' });
    }

    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, id);

    // If deactivating, kill their active sessions immediately
    if (!is_active) {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    }

    const actionText = is_active ? 'ACTIVATED' : 'DEACTIVATED';
    logAudit(req.user.id, req.user.name, req.user.role, `USER_${actionText}`, 'USER', id, `Account was ${actionText.toLowerCase()}`, req.ip);

    res.json({ success: true, message: `Employee account ${actionText.toLowerCase()} successfully!` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Audit Trail History
app.get('/api/audit-logs', authenticateToken, requireRole(['Administrator', 'Manager']), (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT * FROM audit_logs
      ORDER BY id DESC
      LIMIT 150
    `).all();

    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// MODULE 3: COMPLETE DASHBOARD & ANALYTICS API ROUTES
// -------------------------------------------------------------
registerDashboardRoutes(app, optionalAuth);

// -------------------------------------------------------------
// MODULE 4: COMPLETE PRODUCT & CATEGORY MANAGEMENT ROUTES
// -------------------------------------------------------------
registerProductRoutes(app, authenticateToken, requireRole, optionalAuth);

// -------------------------------------------------------------
// MODULE 5: INVENTORY MANAGEMENT, FEFO ALLOCATION & STOCK LEDGER
// -------------------------------------------------------------
registerInventoryRoutes(app, authenticateToken, requireRole, optionalAuth);

// -------------------------------------------------------------
// MODULE 6: SALES & BILLING (POS) API ROUTES
// -------------------------------------------------------------
registerSalesRoutes(app, authenticateToken, requireRole, optionalAuth);

// -------------------------------------------------------------
// MODULE 7: PURCHASES & PROCUREMENT API ROUTES
// -------------------------------------------------------------
registerPurchasesRoutes(app, authenticateToken, requireRole, optionalAuth);

// -------------------------------------------------------------
// MODULE 8: STOCK MOVEMENT MANAGEMENT API ROUTES
// -------------------------------------------------------------
registerMovementsRoutes(app, authenticateToken, requireRole, optionalAuth);

// -------------------------------------------------------------
// MODULE 9: SUPPLIER MANAGEMENT API ROUTES
// -------------------------------------------------------------
registerSupplierRoutes(app, authenticateToken, requireRole, optionalAuth);

// -------------------------------------------------------------
// MODULE 10: CUSTOMER MANAGEMENT & UDHAR API ROUTES
// -------------------------------------------------------------
registerCustomerRoutes(app, authenticateToken, requireRole, optionalAuth);

// -------------------------------------------------------------
// MODULE 11: EXPIRY & WASTAGE MANAGEMENT API ROUTES
// -------------------------------------------------------------
registerExpiryRoutes(app, authenticateToken, requireRole, optionalAuth);

// -------------------------------------------------------------
// MODULE 12: ANALYTICS & BUSINESS INTELLIGENCE API ROUTES
// -------------------------------------------------------------
registerAnalyticsRoutes(app, authenticateToken, requireRole, optionalAuth);

// -------------------------------------------------------------
// MODULE 14: IN-APP NOTIFICATION CENTER & ALERT ENGINE ROUTES
// -------------------------------------------------------------
registerNotificationRoutes(app, authenticateToken, requireRole, optionalAuth);

// -------------------------------------------------------------
// MODULE 13: EXCEL REPORT GENERATION & PREVIEW APIS
// -------------------------------------------------------------
app.get('/api/reports/preview', optionalAuth, (req, res) => {
  try {
    const sheetType = req.query.sheet || req.query.type || 'dashboard';
    const data = getReportPreviewData(sheetType, req.query);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/reports/print-view', optionalAuth, (req, res) => {
  try {
    const html = generatePrintableSummaryHtml(req.query);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send(`<h3>Error generating report preview: ${err.message}</h3>`);
  }
});

// Excel Reports: Accessible by Administrator & Manager
app.get('/api/reports/download/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { range } = req.query;

    let buffer;
    let filename = `DairyTrack_${type}_${getTodayDate()}.xlsx`;

    // 13.2 Complete Master 10-Sheet Workbook
    if (type === 'master' || type === 'complete' || type === 'business') {
      buffer = await generateMasterExcelJSWorkbook(req.query);
      filename = `DairyTrack_Master_Complete_Report_${range || 'all'}_${getTodayDate()}.xlsx`;
    } else {
      // Check if it's an ExcelJS individual sheet
      const excelJsSheets = [
        'dashboard', 'summary',
        'products', 'product-master',
        'sales', 'daily-sales',
        'purchases', 'purchase-history',
        'inventory', 'current-inventory',
        'movements', 'stock-movement',
        'top-selling',
        'pnl', 'profit-and-loss',
        'waste', 'expired-damaged',
        'suppliers', 'supplier-report'
      ];

      if (excelJsSheets.includes(type.toLowerCase())) {
        buffer = await generateSingleSheetExcelJS(type.toLowerCase(), req.query);
        filename = `DairyTrack_${type}_${getTodayDate()}.xlsx`;
      } else {
        // Fallback to legacy generators
        switch (type) {
          case 'customer-sales':
          case 'customers':
            buffer = generateCustomerSalesReport(req.query);
            filename = `DairyTrack_Customer_Sales_${getTodayDate()}.xlsx`;
            break;
          case 'supplier-purchases':
            buffer = generateSupplierPurchasesReport(req.query);
            filename = `DairyTrack_Supplier_Purchases_${getTodayDate()}.xlsx`;
            break;
          case 'analytics':
          case 'bi':
            buffer = generateAnalyticsReport(req.query);
            filename = `DairyTrack_Analytics_BI_${getTodayDate()}.xlsx`;
            break;
          default:
            buffer = await generateMasterExcelJSWorkbook(req.query);
            filename = `DairyTrack_Master_Executive_Report_${getTodayDate()}.xlsx`;
            break;
        }
      }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Report download error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Branches
app.get('/api/branches', (req, res) => {
  try {
    const branches = db.prepare('SELECT * FROM branches ORDER BY is_main DESC, id ASC').all();
    res.json({ success: true, data: branches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Settings: Modifiable only by Administrator
app.get('/api/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings', authenticateToken, requireRole(['Administrator']), (req, res) => {
  try {
    const settings = req.body;
    const updateStmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const [k, v] of Object.entries(settings)) {
      updateStmt.run(k, String(v));
    }
    logAudit(req.user.id, req.user.name, req.user.role, 'UPDATE_SETTINGS', 'SETTINGS', '1', 'Updated shop settings & configuration', req.ip);

    // Module 14: Emit System Event Notification
    emitNotification({
      type: 'system_event',
      category: 'system',
      title: 'Shop Settings Updated',
      message: `System configuration updated by ${req.user.name} (${req.user.role}).`,
      severity: 'info',
      link_view: 'settings'
    });

    res.json({ success: true, message: 'Settings saved successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// MODULE 18: SYSTEM BACKUPS & AUDIT LOGS APIS
// -------------------------------------------------------------
// Trigger manual database backup (Admin / Manager only)
app.post('/api/system/backup', authenticateToken, requireRole('Administrator', 'Manager'), (req, res) => {
  try {
    const user = req.user ? req.user.name : 'Administrator';
    const backup = createDatabaseBackup('manual', user);
    res.json({
      success: true,
      message: 'Database backup created and verified successfully.',
      data: backup
    });
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// List existing database backups
app.get('/api/system/backups', authenticateToken, requireRole('Administrator', 'Manager'), (req, res) => {
  try {
    const backups = listDatabaseBackups();
    res.json({
      success: true,
      data: backups
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Queryable Audit Logs (Admin / Manager only)
app.get('/api/audit-logs', authenticateToken, requireRole('Administrator', 'Manager'), (req, res) => {
  try {
    const { action, entityType, limit = 50, page = 1 } = req.query;
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const p = Math.max(1, parseInt(page, 10));
    const offset = (p - 1) * l;

    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    if (action) {
      sql += ' AND action LIKE ?';
      params.push(`%${action}%`);
    }
    if (entityType) {
      sql += ' AND entity_type = ?';
      params.push(entityType);
    }
    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(l, offset);

    const logs = db.prepare(sql).all(...params);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Global Search
app.get('/api/search', (req, res) => {
  try {
    const q = req.query.q;
    if (!q || q.length < 2) return res.json({ success: true, data: [] });

    const term = `%${q}%`;
    const products = db.prepare('SELECT id, name as title, sku as subtitle, "product" as type FROM products WHERE name LIKE ? OR sku LIKE ? OR barcode LIKE ? LIMIT 5').all(term, term, term);
    const sales = db.prepare('SELECT id, invoice_no as title, ("₹" || net_amount || " - " || sale_date) as subtitle, "sale" as type FROM sales WHERE invoice_no LIKE ? LIMIT 5').all(term);
    const customers = db.prepare('SELECT id, name as title, phone as subtitle, "customer" as type FROM customers WHERE name LIKE ? OR phone LIKE ? LIMIT 5').all(term, term);
    const suppliers = db.prepare('SELECT id, name as title, phone as subtitle, "supplier" as type FROM suppliers WHERE name LIKE ? OR contact_person LIKE ? LIMIT 5').all(term, term);

    res.json({
      success: true,
      data: [...products, ...sales, ...customers, ...suppliers]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🥛 DairyTrack Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
