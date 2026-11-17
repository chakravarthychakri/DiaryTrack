import { app } from './app.js';
import { config } from './config/index.js';

const PORT = config.port || 3000;

const server = app.listen(PORT, () => {
  console.log(`🥛 DairyTrack TypeScript Backend running on http://localhost:${PORT}`);
  console.log(`   Environment: ${config.env}`);
  console.log(`   Supabase Cloud Configured: ${!config.supabase.url.includes('xyzcompany')}`);
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

export default server;
