# FitLife

FitLife is a React fitness site with an Express authentication API and a SQLite user database.
Choose Cardio, Workout, or Yoga to see a daily activity list. Signed-in users can start an activity timer; finishing it automatically records the completion and updates daily and weekly progress.

## Requirements

- Node.js 22 or newer
- npm

## Run locally

Install dependencies once:

```sh
npm install
```

Start the API and frontend in separate terminals:

```sh
npm run dev:server
```

```sh
npm run dev
```

Open the Vite URL printed by the frontend. Vite forwards `/api` requests to the backend at `http://127.0.0.1:3001`.

By default, the SQLite database is created at `server/data/fitlife.sqlite`. Set `FITLIFE_DB_PATH` to use another database file and `PORT` to change the server port.

## Authentication API

- `POST /api/auth/register` — create an account and sign in
- `POST /api/auth/login` — sign in
- `GET /api/auth/me` — return the current account
- `POST /api/auth/logout` — revoke the current session
- `GET /api/progress` — return today's completed activities, all-time totals, and a seven-day summary
- `POST /api/progress/complete` — record a completed activity for the signed-in user
- `GET /api/health` — server health check

Passwords are hashed with bcrypt. Sessions use random, HttpOnly, SameSite cookies; only SHA-256 hashes of session tokens are stored in the database. Sessions expire after seven days, and authentication endpoints are rate-limited.

## Production

Build the frontend and start the server:

```sh
npm run build
npm start
```

The server serves the built site and API from the same origin. Set `NODE_ENV=production` behind HTTPS so authentication cookies use the `Secure` flag.

## Netlify

The included `netlify.toml` configures Netlify to build and publish the frontend. Netlify runs this project in browser-only demo mode: workout timers and progress work without the Express API, and completed workouts are stored in the visitor's browser. Browser demo data is not shared across devices and does not provide accounts.

For account sign-in and server-backed progress, deploy the Express API and a persistent database separately; Netlify static hosting does not run the Express server or persist the local SQLite database.

## Validation

```sh
npm test
npm run lint
npm run build
```
