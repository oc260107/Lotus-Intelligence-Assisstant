# LIA local account authentication

This version replaces the starter mock identity flow with a local prototype account system.

## Behaviour

- `/` shows Sign in / Register / Continue as guest.
- Register now requires **both email and phone number** for one account. Email is normalised to lowercase; phone numbers are normalised to international E.164-style form and require a country code (for example +84 or +61). Duplicate email or duplicate phone registration is rejected. Sign in can then use either the registered email or the registered phone number with the same password.
- Passwords are hashed with PBKDF2-SHA256 (210,000 iterations + random salt); plaintext passwords are never stored.
- Successful login/register creates a random HttpOnly, SameSite=Lax session cookie. Only a SHA-256 hash of the session token is stored in D1.
- Account workspaces use `user:<UserID>` as owner.
- Guest workspaces use `guest:<GuestSessionID>` as owner.
- Trips, chat history, preferences, uploads and LLM quotas remain isolated because the existing backend already keys them by owner.
- New accounts and new guest sessions start with an empty workspace instead of the old seeded demo trip.
- `/workspace` redirects to `/` if there is no valid LIA session.
- The workspace now shows whether the current session is SIGNED IN or GUEST and includes a sign-out button.
- Starter ChatGPT mock-auth is disabled in `vite.config.ts`; the browser no longer needs `/signin-with-chatgpt`.

## First run after replacing the project

Because `node_modules` and local runtime caches are intentionally not included, run:

```cmd
cd /d "C:\Tran Minh Duc\Code\Project\LIA-Qwen-Vietnamese\LIA-Qwen-Vietnamese"
pnpm install
pnpm setup:local
pnpm dev
```

Then open:

```text
http://localhost:5173/
```

`pnpm setup:local` is important this time because migration `drizzle/0002_lia_auth.sql` creates the local auth tables and `drizzle/0003_auth_phone.sql` upgrades accounts to support phone-number login.

## Scope

This is real local prototype authentication, but it is not Vietnam Airlines production identity. A production deployment should replace the local account layer with the approved VNA identity/OAuth system and add production controls such as login rate limiting, password reset/email verification, account recovery, audit/monitoring and managed secret/session policies.

## Mandatory personal profile onboarding

Registered accounts now have a protected Personal information step before the normal travel workspace can be used. The form requires full name, date of birth, Passport or CCCD/National ID number, email, phone number and home address. Existing email/phone values are prefilled. The user can instead switch the current session to Guest.

Sensitive profile fields (date of birth, home address and Passport/CCCD details) are stored in `user_profiles` as an AES-GCM encrypted payload. The encryption key is generated into ignored `.dev.vars` by `pnpm setup:local`; it is not stored in D1. Do not delete or replace that key while encrypted profile data exists. Personal identity fields are never included in the Qwen/Ollama chat context.

After the personal profile is complete, Travel profile exposes a second Preferences tab for seat, baggage, family travel, personalisation, alerts and the demo Lotusmiles toggle. Both personal information and preferences remain editable and show a success notification after saving.
