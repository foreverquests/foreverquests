# ForeverScout accounts – setup

Supabase project: `aycbvnzqofjnecyoefqp` (https://aycbvnzqofjnecyoefqp.supabase.co).
No Edge Function needed: Supabase Auth supports **custom OIDC providers** natively
([docs](https://supabase.com/docs/guides/auth/custom-oauth-providers)), and Battle.net publishes OIDC discovery at
https://oauth.battle.net/.well-known/openid-configuration (issuer `https://oauth.battle.net`, RS256, JWKS).

## 1. Database (SQL Editor)
Dashboard → SQL Editor → New query → paste `supabase/schema.sql` → Run. Creates `progress`, `profiles`,
`battlenet_characters` (placeholder) with RLS (each user can only read/write their own rows) and a trigger that
fills `profiles.battletag` from the Battle.net login.

## 2. Auth URLs
Authentication → URL Configuration:
- **Site URL:** `https://foreverscout.com`
- **Redirect URLs:** `https://foreverscout.com/**` and `http://localhost:4321/**` (local testing)

## 3. Email magic link (fallback, works now)
Authentication → Sign In / Providers → **Email**: enabled (default). "Confirm email" can stay on.
Note: Supabase's built-in mailer is heavily rate limited (a few emails per hour) and meant for testing.
Before launch, set Authentication → Emails → SMTP Settings to a real sender (e.g. Resend, Postmark, SES).
Optional: edit the "Magic Link" email template to say ForeverScout.

## 4. Battle.net developer portal
1. Go to https://develop.battle.net/access/clients → log in with a Battle.net account → **Create Client**.
2. Client name: `ForeverScout`. Website: `https://foreverscout.com`. Intended use: "Log in with Battle.net for a WoW: Forever progress tracker".
3. **Redirect URL:** `https://aycbvnzqofjnecyoefqp.supabase.co/auth/v1/callback`
   (confirm it matches the read-only *Callback URL* Supabase shows in step 5).
4. Save, then copy the **Client ID** and **Client Secret** (keep these as `BNET_CLIENT_ID` / `BNET_CLIENT_SECRET`
   in a password manager; they go only into the Supabase dashboard, never into the site code).

## 5. Battle.net provider in Supabase
Authentication → Sign In / Providers → **Custom Providers** → **New Provider** → *Auto-discovery (OIDC)*:
- Identifier: `custom:battlenet`  (the site code expects exactly this)
- Name: `Battle.net`
- Client ID / Client Secret: from step 4
- Issuer URL: `https://oauth.battle.net`
- Scopes: `openid` (add `wow.profile` later when we pull characters)
- **Email optional: ON** – Battle.net never returns an email address, so sign-in fails without this.
  If the dashboard form has no such toggle, tell me; it's an `email_optional: true` field on the provider
  (admin API `updateProvider`) and needs a one-off call with the service_role key.
- PKCE: leave default (on). Create and enable.

## 6. Turn the button on
In `src/account.js` set `battlenet:true`, commit, push. (Until then the Battle.net button is hidden and only the
email link is offered.)

## How sync works
- Logged out: unchanged; checklist lives in localStorage `fq-done`, supabase-js is not even downloaded.
- First login on a device: local checks and account checks are unioned (nothing lost) and saved to the account.
- Later visits on a known device: the account is the source of truth (unchecks made elsewhere stick); edits are
  pushed ~1s after each change.
