import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import app from './app.js';
import { initDatabase } from './db/database.js';
import { startScoreResetScheduler } from './services/scoreResetService.js';

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await initDatabase();
    console.log('Database initialized successfully');

    startScoreResetScheduler();

    const server = app.listen(PORT, () => {
      console.log(`Server ready on port ${PORT}`);
    });

    // Allow large file uploads to complete
    server.timeout = 600_000; // 10 minutes
    server.headersTimeout = 610_000;
    server.keepAliveTimeout = 120_000;

    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT signal received');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
