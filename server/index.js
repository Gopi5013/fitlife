import { createApp } from './app.js';
import { openDatabase } from './database.js';

const db = openDatabase();
const port = Number(process.env.PORT || 3001);
const server = createApp(db).listen(port, '0.0.0.0', () => {
  console.log(`FitLife server listening on port ${port}`);
});

function shutdown() {
  server.close((error) => {
    db.close();
    if (error) {
      console.error('Could not shut down the server cleanly.', error);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
