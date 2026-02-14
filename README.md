# Choose My Gift

A React + Vite web app for voting on destinations and activities, with live results and QR code sharing. Backend API is deployed as a Cloudflare Worker.

## Features

- Vote for destinations and activities
- Live results display
- QR code for easy mobile voting
- Responsive, mobile-optimized UI

## Local Development

### Prerequisites

- Node.js (v18+ recommended)
- npm

### Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Create local env file:

   ```
   cp .env.example .env
   ```

3. Start the frontend locally:

   ```
   npm run dev
   ```

   The app will be available at [http://localhost:5173](http://localhost:5173) (or the port shown in your terminal).

4. (Optional) Lint your code:

   ```
   npm run lint
   ```

### Backend API (Cloudflare Worker)

The backend API is in the `worker/` directory and uses Cloudflare Workers with Wrangler.

#### Setup & Run Locally

1. Install Wrangler globally if not already:

   ```
   npm install -g wrangler
   ```

2. Install worker dependencies:

   ```
   cd worker
   npm install
   ```

3. Create local worker env file:

   ```
   cp .dev.vars.example .dev.vars
   ```

4. Start the worker locally:

   ```
   wrangler dev
   ```

   The API will be available at the local worker URL (shown in terminal).

## Secret Safety

- `.env*` and `worker/.dev.vars*` are gitignored by default.
- Git hooks block commits and pushes that include likely secrets.
- Hooks are auto-configured via `npm install` (`core.hooksPath=.githooks`).
- If a secret ever lands in git history, rotate it immediately.

## Deployment

### Frontend

- The frontend is designed to be deployed on static hosting (e.g., GitHub Pages, Vercel, Netlify).
- Build the app:

  ```
  npm run build
  ```

- Deploy the contents of the `dist/` folder to your static host.

### Backend (Cloudflare Worker)

- Deploy the worker with Wrangler:

  ```
  cd worker
  wrangler deploy
  ```

- The API will be available at your Cloudflare Worker URL.

## Configuration

- The frontend expects the API endpoints `/api/options`, `/api/results`, and `/api/vote` to be available.
- You may need to set environment variables or update URLs if deploying to custom domains.

## Data

- CSV files for activities, destinations, and votes are stored in the `DB/` folder.

## License

MIT
