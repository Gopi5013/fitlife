# FitLife

FitLife is a React fitness site centered on its exercise library. The old “My workouts” plans and sign-in interface have been removed; Gym, Yoga, and Cardio exercises are available without an account.

The Exercises section includes Gym, Yoga, and Cardio libraries with ten guided movements per category. Gym and Cardio demonstrations use animated GIFs from [ExerciseDB by AscendAPI](https://exercisedb.dev/); Yoga demonstrations use on-demand videos from [Pexels](https://www.pexels.com/license/) with source links shown in the exercise guides. ExerciseDB's free GIFs are limited to non-commercial use and require the visible AscendAPI credit; obtain a commercial license before using them commercially. Exercise media URLs and instructions live in `shared/exercises.js`.

Starting an exercise opens its guided timer. When the timer finishes, the exercise is automatically recorded in the progress panel, which shows today's total and category breakdown plus a seven-day history. A day is marked “Done” after at least one exercise is completed. This data is stored locally and does not sync across devices.

## Requirements

- Node.js 22 or newer
- npm

## Run locally

Install dependencies once:

```sh
npm install
```

Start the frontend:

```sh
npm run dev
```

Open the Vite URL printed by the frontend. The exercise library does not require the API or a database.

## Optional API

The Express API remains available for existing integrations, but the FitLife browser app no longer provides account sign-in or uses these routes.
- `POST /api/auth/register` — create an account and sign in
- `POST /api/auth/login` — sign in
- `GET /api/auth/me` — return the current account
- `POST /api/auth/logout` — revoke the current session
- `GET /api/progress` — return today's completed activities, all-time totals, and a seven-day summary
- `POST /api/progress/complete` — record a completed activity for the signed-in user
- `GET /api/health` — server health check

Start the optional API with `npm run dev:server`. By default, its SQLite database is created at `server/data/fitlife.sqlite`; set `FITLIFE_DB_PATH` to use another database file and `PORT` to change the server port.

Passwords are hashed with bcrypt. Sessions use random, HttpOnly, SameSite cookies; only SHA-256 hashes of session tokens are stored in the database. Sessions expire after seven days, and authentication endpoints are rate-limited.

## Production

Build the frontend and start the server:

```sh
npm run build
npm start
```

The server serves the built site and API from the same origin. Set `NODE_ENV=production` behind HTTPS so authentication cookies use the `Secure` flag.

## Netlify

The included `netlify.toml` configures Netlify to build and publish the frontend. The exercise library works without the Express API.

## Validation

```sh
npm test
npm run lint
npm run build
```
