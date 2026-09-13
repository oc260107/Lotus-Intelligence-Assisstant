# LIA — Lotus Intelligent Assistant

LIA is a full-stack prototype for a **personalised Vietnam Airlines direct-booking assistant**. It is designed to reduce search and decision friction, learn what matters to each traveller, surface relevant Vietnam Airlines options, use Lotusmiles context as part of the decision, and move the traveller toward direct booking.

This repository is a **functional demo/MVP**, not a connection to live Vietnam Airlines reservation, payment, inventory or Lotusmiles systems. Flight records, seat availability, Lotusmiles balances/redemption rules and payment confirmation are synthetic/demo data unless explicitly stated otherwise.

---

## 1. Fastest way to run the project

### Prerequisites

Use:

- **Node.js 22.13+ or Node.js 24.x**
- Internet access for the first dependency install
- Optional but recommended for the full AI demo: an **OpenAI API key** with access to the configured model

You do **not** need a Cloudflare account. D1 and R2 run locally through Wrangler/Miniflare.

### Recommended judge setup

From the repository root:

```bash
npm run demo
```

`npm run demo` is intentionally the one-command judge path. It:

1. uses the pinned `pnpm@11.19.0` toolchain;
2. installs dependencies from `pnpm-lock.yaml` with a frozen lockfile;
3. creates local runtime configuration if missing;
4. generates a private `PROFILE_ENCRYPTION_KEY` when needed;
5. builds the application;
6. applies all local D1 migrations;
7. starts the app at **http://localhost:5173/**.

If no OpenAI key is configured, the application still starts and the deterministic/demo features remain available, but OpenAI chat/explanation actions are disabled until a key is added and the app is restarted.

### Enable the OpenAI features

Copy the safe template:

**Windows PowerShell**

```powershell
Copy-Item .dev.vars.example .dev.vars
notepad .dev.vars
```

**macOS / Linux**

```bash
cp .dev.vars.example .dev.vars
```

Set only your own key:

```dotenv
OPENAI_API_KEY=YOUR_KEY_HERE
OPENAI_MODEL=gpt-5.6-terra
PROFILE_ENCRYPTION_KEY=
```

Do not commit `.dev.vars`. `npm run demo` / `pnpm setup:local` will generate the encryption key if it is blank.

You can also provide the API key through the shell for a temporary judge session. The launcher copies it into the ignored local `.dev.vars` file:

**PowerShell**

```powershell
$env:OPENAI_API_KEY="YOUR_KEY_HERE"
npm run demo
```

**macOS / Linux**

```bash
OPENAI_API_KEY="YOUR_KEY_HERE" npm run demo
```

For API/model information, use the official OpenAI Platform documentation: https://platform.openai.com/docs/

---

## 2. Technical quality

### A working product — functional demo/MVP

The repository contains an end-to-end working prototype rather than static wireframes. The main demonstrated flow is:

```text
Natural-language or manual Travel Intent
        ↓
Synthetic VNA flight retrieval
        ↓
Personalised deterministic ranking
        ↓
OpenAI explanation / intent interpretation
        ↓
Optional Lotusmiles smart-value option
        ↓
Passenger details
        ↓
Per-passenger seat selection
        ↓
Demo payment
        ↓
Receipt + notification + completed journey state
```

If the customer is not ready to pay, the selected itinerary can instead become a monitored Travel Intent. A later demo check can create a personalised “Why now?” opportunity notification and bring the customer back into the booking flow.

### Repository + one-command setup

The reproducible judge command is:

```bash
npm run demo
```

The project pins:

- Node compatibility in `package.json`;
- `pnpm@11.19.0` in `packageManager`;
- exact dependency resolutions in `pnpm-lock.yaml`;
- local database migrations in `drizzle/`;
- a deterministic synthetic flight dataset in `data/`.

For manual setup, the equivalent commands are:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm setup:local
corepack pnpm dev
```

Then open:

```text
http://localhost:5173/
```

### Clear system architecture

```text
┌──────────────────────────────────────────────────────┐
│ Browser UI — React / Vinext                         │
│ Chat · Trips · Notifications · Profile · Booking    │
└───────────────────────┬──────────────────────────────┘
                        │ HTTPS/API calls
                        ▼
┌──────────────────────────────────────────────────────┐
│ Server API routes / orchestration                    │
│ auth · profile · state · LLM health · uploads        │
│ Zod validation · ownership checks · state revision   │
└───────────────┬───────────────────┬──────────────────┘
                │                   │
                │                   ├──────────────► OpenAI API
                │                   │                NL intent + explanation
                │                   │
                ▼                   ▼
┌─────────────────────────┐   ┌────────────────────────┐
│ Deterministic decision  │   │ Synthetic VNA dataset  │
│ and ranking layer       │   │ fares/schedules/demo   │
│ constraints + weights   │   └────────────────────────┘
└─────────────┬───────────┘
              │
              ▼
┌──────────────────────────────────────────────────────┐
│ Local Cloudflare runtime                             │
│ D1: users, sessions, encrypted profiles, workspaces  │
│ R2: temporary uploaded objects                       │
└──────────────────────────────────────────────────────┘
```

The production integration boundary is deliberate: live VNA fares, inventory, Lotusmiles, PSS/reservation and payment would replace the demo providers without giving the LLM direct control over commercial systems.

### Effective and technically appropriate AI/ML integration

LIA separates **language understanding** from **commercial decision logic**.

OpenAI is used for tasks where generative AI is useful:

- converting natural-language travel requests into a structured Travel Intent;
- interpreting conversational changes to trip requirements;
- asking clarification questions;
- explaining a recommendation in natural language.

OpenAI is **not** the source of flight prices, availability, Lotusmiles balances or payment state. Those values are provided by the server-side demo dataset and business logic.

The core recommendation is an explainable personalised ranking layer. It combines trip constraints and customer-specific preference evidence across dimensions such as:

- price;
- total journey time;
- transit;
- baggage;
- flexibility;
- Lotusmiles value.

Behavioural evidence can update the customer-specific weighting, so “Best Match” does not have to equal “Cheapest”. The prototype does **not** falsely claim a trained conversion-probability model without VNA historical/experimental data. A future learning-to-rank model can replace the transparent weight updater when authorised production data is available.

The LLM explanation layer is constrained to the server-selected offer. It cannot silently replace the deterministic winner with an invented flight.

### Information security and data privacy

The prototype includes several concrete controls:

- passwords are hashed with **PBKDF2-SHA256 (210,000 iterations)** plus per-password salt;
- authentication sessions use random tokens, with only token hashes stored server-side;
- the browser session cookie is `HttpOnly` and `SameSite=Lax`;
- date of birth, address and passport/CCCD profile payloads are encrypted at rest using **AES-GCM**;
- identity-document matching uses a keyed fingerprint rather than storing a plaintext lookup index;
- pre-account traveller profiles are encrypted and require explicit consent;
- account/trip state is isolated by server-side owner identity;
- state writes use revision checks to reduce accidental concurrent overwrites;
- `OPENAI_API_KEY` and `PROFILE_ENCRYPTION_KEY` are server-side secrets and are excluded from Git;
- passport/CCCD, date of birth and home address are not included in the OpenAI recommendation context;
- the model never receives payment-card credentials and cannot issue a real ticket;
- user-controlled state and model output are validated on the server before mutation.

For a real airline deployment, additional controls would still be required: VNA identity/OAuth, OTP verification for claimed traveller profiles, enterprise secrets management, malware scanning, production audit/monitoring, formal retention rules, PCI-compliant payment, and approved VNA data governance.

---

## 3. What is implemented

Key working prototype capabilities include:

- Guest exploration plus local account registration/login with email and phone.
- Persistent per-user Trip Threads and Travel Intents.
- Natural-language Vietnamese/English trip conversation through OpenAI.
- Synthetic one-way and round-trip flight search.
- Constraint filtering for budget, baggage, transit and route/date requirements.
- Personalised ranking using declared preferences and behavioural evidence.
- “Cheapest” and “LIA Best Match” as separate concepts.
- Explainable recommendations grounded in server-selected demo offers.
- Lotusmiles demo profile and selectable Business redemption opportunity when eligible.
- Passenger-first booking flow for multiple travellers.
- Independent seat selection per traveller with optional seat recommendation.
- Consent-based encrypted pre-account traveller profile storage.
- Monitoring state, fare observations and personalised opportunity notifications.
- Demo payment, receipt and retained payment notification.
- Local D1 persistence and R2-compatible temporary object storage.

### Deliberately mocked / not live

The repository does not claim live access to:

- Vietnam Airlines fares or seat inventory;
- official fare families/rules;
- live Lotusmiles balance or redemption tables;
- PSS/GDS reservation systems;
- real payment processing;
- real ticket issuance;
- scheduled background fare monitoring;
- external email/SMS/push delivery.

These are represented by explicit integration boundaries and demo data.

---

## 4. Verification commands

After dependencies are installed:

```bash
pnpm build
pnpm test:api
```

Or:

```bash
pnpm verify
```

`test:api` runs a local API smoke test against an in-memory SQLite database and checks core auth/profile/workspace security behaviours without requiring a live OpenAI response.

For a fresh judge run, `pnpm setup:local` applies migrations `0000` through `0006`, including the encrypted pending-traveller-profile table.

---

## 5. Troubleshooting

### `ECONNRESET`, `EAI_AGAIN`, DNS or registry errors during dependency install

This normally means the npm registry connection was interrupted, blocked by a proxy/VPN, or DNS temporarily failed. It is not an application-code error.

First retry on a stable connection:

```bash
npm run demo
```

If it persists, verify the registry and remove stale proxy settings:

```bash
corepack pnpm config set registry https://registry.npmjs.org/
corepack pnpm config delete proxy
corepack pnpm config delete https-proxy
corepack pnpm store prune
```

Then retry:

```bash
corepack pnpm install --frozen-lockfile
```

If you are on a university/corporate network, try another network or disable a misconfigured VPN/proxy. Do not disable TLS verification.

### `ECONNRESET` / `workerd` / local Cloudflare dev process fails on Windows

Close the old local Worker process and remove only generated caches:

```bat
taskkill /IM workerd.exe /F

if exist node_modules\.vite rmdir /s /q node_modules\.vite
if exist .vinext rmdir /s /q .vinext
if exist .next rmdir /s /q .next
if exist .wrangler\dev-registry rmdir /s /q .wrangler\dev-registry
if exist .wrangler\registry rmdir /s /q .wrangler\registry

set NODE_OPTIONS=
set CLOUDFLARE_CF_FETCH_ENABLED=false
set WRANGLER_SEND_METRICS=false

pnpm dev
```

Do **not** delete `.wrangler/state` unless you intentionally want to reset the local demo database.

### OpenAI chat is unavailable

Open **Service status** inside LIA and run the OpenAI check.

Common cases:

- `401/403`: API key/project permission problem;
- `404`: configured model is not available to the project;
- `429`: rate limit or Usage/Billing limit;
- network/reset error: check Internet/VPN/firewall and retry.

Confirm `.dev.vars` contains:

```dotenv
OPENAI_API_KEY=YOUR_KEY_HERE
OPENAI_MODEL=gpt-5.6-terra
```

Restart `pnpm dev` after changing `.dev.vars`.

### `no such table ...`

Run migrations again:

```bash
pnpm setup:local
```

For a completely disposable fresh-demo reset only:

```text
1. stop the dev server
2. delete .wrangler/state
3. run pnpm setup:local
4. run pnpm dev
```

Deleting `.wrangler/state` removes local accounts/trips/demo data.

### `PROFILE_DECRYPT` or profile data cannot be opened

The encrypted D1 profile was created with a different `PROFILE_ENCRYPTION_KEY`.

- If you need the existing data, restore the original key.
- If this is only a disposable judge demo, reset `.wrangler/state` and rerun `pnpm setup:local` so the new database and key start together.

Never commit or share the real key.

### Port 5173 is already in use

Stop the older LIA/Vite process, then start again. On Windows:

```bat
netstat -ano | findstr :5173
```

Then terminate the relevant PID if it is an old local dev process.

---

## 6. Repository structure

```text
app/                    React/Vinext pages + server API routes
components/             UI components
lib/                    ranking, OpenAI client, auth, crypto, model logic
data/                   synthetic flight dataset
db/                     Drizzle schema
drizzle/                ordered D1 migrations
scripts/                setup/build/demo launch scripts
tests/                  API smoke tests
public/                 static assets
.dev.vars.example       safe local secret template
pnpm-lock.yaml          reproducible dependency lock
vite.config.ts          local Cloudflare/Vinext runtime bindings
```

### Files intentionally removed from the submission

The cleaned judge-ready repository does not include:

- `.dev.vars` or any real API/encryption key;
- generated `.wrangler/`, `.vinext/`, `.next/`, `node_modules/` or local database state;
- the old Ollama/Qwen setup guide and obsolete patch notes;
- machine-specific Windows paths;
- the previous hosting project identifier/config;
- unused starter example code;
- an unnecessary duplicate `.env.example`.

The remaining configuration files are required or useful for a reproducible local run. In particular, keep `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `vite.config.ts`, `tsconfig.json`, `drizzle.config.ts`, `.npmrc`, `.gitignore`, `.dev.vars.example` and `cloudflare-env.d.ts`.

---

## 7. Notes for evaluators

The most important technical design choice is that LIA does **not** let a generative model become the airline’s source of truth. The application uses deterministic server-side search/ranking and validation for commercial/demo facts, while OpenAI is used for natural-language understanding and explanation. This makes the AI integration useful while keeping the architecture auditable, reproducible and suitable for later replacement of demo providers with authorised Vietnam Airlines APIs.

## Reset the local demo to a completely fresh user state

To rehearse the demo from the beginning, while preserving `.dev.vars` and your local OpenAI key:

```bash
pnpm reset:demo
pnpm dev
```

`reset:demo` deletes only local runtime/database state (`.wrangler/state` plus build caches), then rebuilds the app and reapplies the D1 migrations. It clears local accounts, profiles, Trip Threads, chat history, notifications, bookings and preference-learning evidence. Do not run it against a production database.
