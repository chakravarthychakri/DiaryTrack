"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_js_1 = require("./app.js");
const index_js_1 = require("./config/index.js");
const PORT = index_js_1.config.port || 3000;
const server = app_js_1.app.listen(PORT, () => {
    console.log(`🥛 DairyTrack TypeScript Backend running on http://localhost:${PORT}`);
    console.log(`   Environment: ${index_js_1.config.env}`);
    console.log(`   Supabase Cloud Configured: ${!index_js_1.config.supabase.url.includes('xyzcompany')}`);
});
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});
process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});
exports.default = server;
//# sourceMappingURL=server.js.map