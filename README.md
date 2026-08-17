# Mixtape

A tactile digital mixtape creator, with Spotify as the playback layer.

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://127.0.0.1:3000`. Without credentials the app runs as a complete demo, including the editor and public share page.

## Connect services

Copy `.env.example` to `.env.local`, add a Spotify app and Supabase project, then run `supabase/schema.sql` in the Supabase SQL editor. Set the Spotify redirect URI to `http://127.0.0.1:3000/api/auth/callback`.

Spotify tokens are issued only through server routes and stored in HTTP-only cookies. For production, encrypt refresh tokens at rest and persist them through a server-only Supabase client.
