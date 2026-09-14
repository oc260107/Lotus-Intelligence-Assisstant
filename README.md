# LIA — Lotus Intelligent Assistant

LIA is a full-stack prototype for a **personalised Vietnam Airlines direct-booking assistant**. It is designed to reduce search and decision friction, learn what matters to each traveller, surface relevant Vietnam Airlines options, use Lotusmiles context as part of the decision, and move the traveller toward direct booking.

This repository is a **functional demo/MVP**. It does **not** connect to live Vietnam Airlines reservation, payment, inventory, seat-map or Lotusmiles systems. Flight records, seat availability, Lotusmiles balances/redemption rules and payment confirmation are synthetic/demo data unless explicitly stated otherwise.

---

## 1. Judge setup — recommended stable path

### Prerequisites

Install:

- **Node.js 22.13+ or Node.js 24.x**
- **pnpm 11.19.0**
- Internet access for the first dependency install
- Optional, for the full conversational-AI demo: an **OpenAI API key** that can access the configured model

A Cloudflare account is **not** required. The app uses local Wrangler/Miniflare with local D1 and R2 bindings.

If `pnpm` is not installed yet:

```bash
npm install -g pnpm@11.19.0
```

### Recommended first run

From the repository root, install the locked dependencies:

```bash
pnpm install --frozen-lockfile
```

On a fresh installation, pnpm may block native dependency build scripts for security and show `ERR_PNPM_IGNORED_BUILDS`. If that happens, run:

```bash
pnpm approve-builds
```

When prompted, approve the native dependencies required by this project:

```text
esbuild
sharp
unrs-resolver
workerd
```

Then complete setup and start the application:

```bash
pnpm install --frozen-lockfile
pnpm setup:local
pnpm dev
```

Then open:

```text
http://localhost:5173/
```

For **Windows Command Prompt**, run the same commands one by one:

```bat
pnpm install --frozen-lockfile
pnpm approve-builds
pnpm install --frozen-lockfile
pnpm setup:local
pnpm dev
```

`pnpm approve-builds` is normally required only on a fresh dependency installation when pnpm blocks native build scripts. `pnpm setup:local` prepares the local environment, generates `PROFILE_ENCRYPTION_KEY` when required, builds the application, and applies the local D1 migrations. `pnpm dev` then starts the same LIA application used during development.

> **Windows note:** use the `pnpm` commands above as the recommended evaluator path. The repository may contain a legacy `npm run demo` helper, but it is not required and should not be used as the primary Windows setup path.

Press `Ctrl+C` to stop the development server.

### Enable the OpenAI features

The application can start without an OpenAI key. Deterministic ranking, synthetic flights, Trip Threads, monitoring, seat selection, Lotusmiles demo logic and the booking flow still work. **Natural-language chat intent interpretation and AI-generated explanations require a valid OpenAI API key.**

Create the local secret file:

**Windows PowerShell**

```powershell
Copy-Item .dev.vars.example .dev.vars
notepad .dev.vars
```

**Windows Command Prompt**

```bat
copy .dev.vars.example .dev.vars
notepad .dev.vars
```

**macOS / Linux**

```bash
cp .dev.vars.example .dev.vars
```

Set:

```dotenv
OPENAI_API_KEY=your_own_key_here
OPENAI_MODEL=gpt-5.6-terra
PROFILE_ENCRYPTION_KEY=
```

Leave `PROFILE_ENCRYPTION_KEY` blank on the first setup if needed; `pnpm setup:local` generates a local key automatically. After changing `.dev.vars`, restart `pnpm dev`.

`.dev.vars` is local-only and should never be committed to GitHub. The repository should contain only `.dev.vars.example` with blank placeholders.

OpenAI model/API documentation: https://platform.openai.com/docs/models

---

## 2. Technical quality

### A working product — functional demo/prototype/MVP

LIA is an end-to-end working prototype, not a static mock-up. The main direct-booking journey is:

```text
Natural-language or manual Travel Intent
        ↓
Synthetic Vietnam Airlines flight retrieval
        ↓
Personalised deterministic ranking
        ↓
OpenAI intent interpretation / explanation
        ↓
Optional Lotusmiles smart-value booking option
        ↓
Passenger details
        ↓
Per-passenger seat selection
        ↓
Demo payment
        ↓
Receipt + notification + completed journey state
```

If the customer is not ready to pay, the selected itinerary can instead become a monitored Travel Intent. A later demo check re-ranks suitable options, explains **why** the leading option matches the traveller, and creates a personalised “Why now?” notification that can reopen the booking flow.

### Repository + reproducible setup instructions

The recommended evaluator setup is:

```bash
pnpm install --frozen-lockfile
pnpm approve-builds   # only if pnpm reports ERR_PNPM_IGNORED_BUILDS on a fresh install
pnpm install --frozen-lockfile
pnpm setup:local
pnpm dev
```

On Windows Command Prompt, run the same sequence one command at a time. `pnpm approve-builds` is interactive and is only needed when pnpm blocks required native build scripts such as `esbuild`, `sharp`, `unrs-resolver` or `workerd`.

Reproducibility is supported by:

- a pinned Node compatibility range in `package.json`;
- `pnpm@11.19.0` in `packageManager`;
- exact dependency resolutions in `pnpm-lock.yaml`;
- ordered local D1 migrations in `drizzle/`;
- a deterministic synthetic flight dataset in `data/`;
- a generated local encryption key stored only in ignored `.dev.vars`;
- local Cloudflare D1/R2 bindings defined in source, with no private hosted-project identifier required.

If `pnpm` is not installed, install the pinned version first:

```bash
npm install -g pnpm@11.19.0
```

Then open:

```text
http://localhost:5173/
```

### Clear system architecture, clean code and reproducibility

```text
┌──────────────────────────────────────────────────────┐
│ Browser UI — React / Vinext                         │
│ Chat · Trips · Notifications · Profile · Booking    │
└───────────────────────┬──────────────────────────────┘
                        │ API calls
                        ▼
┌──────────────────────────────────────────────────────┐
│ Server API routes / orchestration                    │
│ auth · profile · state · LLM health · uploads        │
│ Zod validation · ownership checks · state revision   │
└───────────────┬───────────────────┬──────────────────┘
                │                   │
                │                   ├──────────────► OpenAI API
                │                   │                language understanding
                │                   │                + explanation only
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
│ D1: users, sessions, profiles, Trip Threads/state    │
│ R2: temporary uploaded objects                       │
└──────────────────────────────────────────────────────┘
```

The architecture intentionally separates:

- **language understanding**;
- **commercial/demo facts**;
- **ranking and validation**;
- **persistence**;
- **future airline integration boundaries**.

This allows the demo providers to be replaced later by authorised Vietnam Airlines fare, inventory, Lotusmiles, PSS/reservation and payment APIs without allowing the LLM to directly control those systems.

### Effective AI/ML integration — technically sound and appropriate

LIA deliberately separates **generative AI** from **commercial decision logic**.

OpenAI is used where natural language adds value:

- converting free-text travel requests into a structured Travel Intent;
- interpreting conversational updates to travel requirements;
- asking or supporting clarification when needed;
- producing a concise explanation of a recommendation that the server has already selected.

OpenAI is **not** the source of fares, availability, Lotusmiles balance, seat availability or payment state. Those values come from server-side demo data and deterministic business logic.

The recommendation layer is explainable and personalised. It combines trip constraints with customer-specific evidence across dimensions such as:

- price;
- total journey time;
- transit;
- baggage;
- flexibility;
- Lotusmiles value.

Behavioural evidence can update the customer-specific weighting, so **Best Match does not have to equal Cheapest**. The same itinerary can therefore rank differently for two customers with different preference histories.

The prototype does **not** falsely claim to have trained a production conversion-probability model without historical Vietnam Airlines interaction/booking data. A future learning-to-rank or preference-learning model can replace the transparent weight updater when authorised production data is available.

The OpenAI explanation layer is also constrained to the server-selected offer; it cannot silently replace the deterministic winner with an invented flight.

### Information security and data privacy

The prototype includes concrete security/privacy controls:

- passwords are hashed with **PBKDF2-SHA256, 210,000 iterations**, with a unique random salt;
- authentication session tokens are random, while only their **SHA-256 hashes** are stored server-side;
- session cookies are `HttpOnly` and `SameSite=Lax`, and become `Secure` under HTTPS;
- date of birth, address and passport/CCCD profile payloads are encrypted at rest using **AES-GCM**;
- passport/CCCD uniqueness checks use a keyed HMAC fingerprint instead of a plaintext lookup index;
- consented pre-account traveller profiles are encrypted and can only be claimed later through matching contact details;
- sensitive identity fields are not placed into the OpenAI context;
- API mutations use server-side validation and origin protection;
- per-user workspace ownership is enforced server-side;
- local secrets are read from ignored `.dev.vars`, never from source code;
- no real API key, encryption key, local database or hosted-project identifier is included in the submission ZIP.

For a production airline deployment, further controls would still be required, including enterprise secret management, formal IAM, audit logging, retention policies, legal/privacy review, rate limiting, security testing and authorised VNA integration controls.

---

## 3. What the prototype currently demonstrates

### Implemented

- Guest and authenticated user flows.
- Natural-language Travel Intent creation and editing.
- Synthetic flight retrieval with grounded flight IDs and prices.
- Explainable personalised ranking where Best Match can differ from Cheapest.
- Behavioural preference evidence from choices, filters and bookings.
- Persistent Trip Threads.
- Monitoring with re-ranked alternatives, recommendation reasons and “Why now?” notifications.
- Lotusmiles demo context and selectable smart-value Business-upgrade option.
- Passenger-first booking flow.
- Multi-passenger passenger details and per-passenger seat selection.
- Seat recommendation based on the account holder’s paid-seat history while preserving customer choice.
- Consent-based encrypted pre-account traveller profile storage.
- Demo payment, receipt and retained payment notification.
- Local D1 persistence and R2-compatible temporary object storage.

### Deliberately mocked / not live

The repository does not claim live access to:

- Vietnam Airlines fares or inventory;
- official seat inventory or aircraft seat maps;
- official fare-family rules;
- live Lotusmiles balances or official redemption tables;
- PSS/GDS reservation systems;
- real payment processing or ticket issuance;
- scheduled background fare monitoring;
- external SMS/email/push delivery.

The current demo shows the orchestration, state changes and integration boundaries safely with synthetic data.

---

## 4. Verification commands

After dependencies are installed:

```bash
pnpm build
pnpm test:api
```

Or run both:

```bash
pnpm verify
```

`test:api` creates an in-memory SQLite database, applies migrations `0000` through `0006`, and checks core authentication/profile/workspace security behaviours without requiring a live OpenAI response.

For a clean demo reset while preserving `.dev.vars`:

```bash
pnpm reset:demo
pnpm dev
```

This deletes only generated local runtime/database state and then rebuilds/reapplies migrations. It clears local accounts, profiles, Trip Threads, chats, notifications, bookings and preference-learning evidence.

---

## 5. Troubleshooting

### `ERR_PNPM_IGNORED_BUILDS` during install or `pnpm setup:local`

On a fresh pnpm installation, native dependency build scripts may be blocked until explicitly approved. If you see `ERR_PNPM_IGNORED_BUILDS`, run:

```bash
pnpm approve-builds
```

Approve the required packages when prompted:

```text
esbuild
sharp
unrs-resolver
workerd
```

Then retry:

```bash
pnpm install --frozen-lockfile
pnpm setup:local
pnpm dev
```

This approval step is a pnpm supply-chain security control and is normally needed only on a fresh dependency installation.

### `ECONNRESET`, `EAI_AGAIN`, DNS or registry errors during install

This normally means the package-registry connection was interrupted, DNS failed temporarily, or a VPN/proxy/firewall is interfering. It is not normally an application-code error.

Retry the dependency install first:

```bash
pnpm install --frozen-lockfile
```

If it persists:

```bash
pnpm config set registry https://registry.npmjs.org/
pnpm config delete proxy
pnpm config delete https-proxy
pnpm store prune
pnpm install --frozen-lockfile
```

Also try:

- a stable non-corporate/non-university network;
- temporarily disabling a misconfigured VPN/proxy;
- checking that `https://registry.npmjs.org/` is reachable in the browser.

Do **not** disable TLS certificate verification.

### `ECONNRESET` or local `workerd` / Wrangler process errors on Windows

Close stale local Cloudflare processes and remove generated registries/caches only:

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

Do **not** delete `.wrangler/state` unless you intentionally want to remove all local demo accounts/history.

### OpenAI network `ECONNRESET` / timeout

The app keeps commercial/demo state server-side, so an OpenAI network failure should not invent or mutate a flight selection. Check Internet/VPN/firewall, then use **Service status → Check OpenAI** and retry.

Common HTTP cases:

- `401/403`: invalid key or project/model permission issue;
- `404`: configured model is unavailable to that API project;
- `429`: rate/usage/billing limit;
- timeout/network reset: Internet, VPN, proxy or firewall interruption.

Check `.dev.vars`:

```dotenv
OPENAI_API_KEY=your_own_key_here
OPENAI_MODEL=gpt-5.6-terra
```

Restart the dev server after changing `.dev.vars`.

### `no such table ...`

Apply migrations again:

```bash
pnpm setup:local
```

For a disposable fresh demo:

```bash
pnpm reset:demo
pnpm dev
```

### `PROFILE_KEY_MISSING` / `PROFILE_DECRYPT`

`PROFILE_ENCRYPTION_KEY` protects local encrypted profile fields.

If this is the first run, execute:

```bash
pnpm setup:local
```

The script generates a key when the value is blank.

If old encrypted profile data was created with a different key, either restore that original key or reset the disposable local demo database:

```bash
pnpm reset:demo
pnpm dev
```

Never commit or share the real encryption key.

### Port 5173 is already in use

Stop the previous LIA/Vite process, then retry.

Windows:

```bat
netstat -ano | findstr :5173
```

Then terminate the old PID if appropriate.

### Node version error

Use Node 22.13+ or Node 24.x:

```bash
node -v
```

Using the supported Node range avoids obscure Vinext/Wrangler runtime failures.

---

## 6. Repository structure

```text
app/                    React/Vinext UI + server API routes
components/             UI components
lib/                    ranking, OpenAI client, auth, crypto, model logic
data/                   synthetic flight dataset
db/                     Drizzle schema
drizzle/                ordered D1 migrations (0000–0006)
scripts/                local setup, reset and support utilities
tests/                  API smoke tests
public/                 static assets
.dev.vars.example       safe local-secret template
pnpm-lock.yaml          reproducible dependency lock
vite.config.ts          local Cloudflare/Vinext runtime bindings
```

### Configuration files to keep

These are intentionally retained because they are required or useful for a reproducible source submission:

- `package.json`
- `pnpm-lock.yaml`
- `vite.config.ts`
- `tsconfig.json`
- `next.config.ts`
- `postcss.config.mjs`
- `eslint.config.mjs`
- `drizzle.config.ts`
- `cloudflare-env.d.ts`
- `.dev.vars.example`
- `.gitignore`
- `components.json`

### Files/configuration intentionally removed from the judge-ready package

The cleaned repository removes material that is unnecessary for local evaluation or could expose machine/project-specific information:

- `.dev.vars` and any real API/encryption key;
- `.env.example` because it was an obsolete duplicate from the earlier Ollama/Qwen prototype;
- `.openai/hosting.json`, including the previous hosted-project identifier;
- the previous site-specific install/build wrapper scripts;
- the previous site-specific Vite plugin copy;
- `pnpm-workspace.yaml` containing environment-specific install policy;
- `.npmrc` because its settings were convenience-only, not required for the build;
- old patch notes and machine-specific setup documents;
- generated `.wrangler/`, `.next/`, `.vinext/`, `.sites-runtime/`, `node_modules/` and local D1 state;
- `.git/` history from any local working copy.

No evaluator needs any of those files to run the project.

---

## 7. Notes for evaluators

The key technical design choice is that LIA does **not** let a generative model become the airline’s source of truth. The server retrieves deterministic demo records and applies constraints/ranking first; OpenAI is then used for language understanding and explanation. This keeps the prototype auditable and makes the production migration path clear: synthetic providers can be replaced with authorised Vietnam Airlines services without handing uncontrolled commercial authority to the LLM.

The project should therefore be evaluated as a **working personalised decision-support and direct-booking MVP**, with explicit integration boundaries for the real airline systems that are outside hackathon access.