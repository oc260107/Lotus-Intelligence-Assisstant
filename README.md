# LIA — Lotus Intelligent Assistant

A responsive full-stack demonstration based on the supplied LIA mobile prototype, customer workflow and system architecture. Teal/gold Vietnam Airlines direction, desktop trip workspace and mobile navigation.

## Working features

- Local prototype accounts with unique email, PBKDF2 password hashes, HttpOnly sessions and private per-user D1 workspaces; guest sessions use separate owner IDs.
- Create, edit, version, pause, resume and delete named Trip Threads and Travel Intents.
- Vietnamese conversations with Qwen3 via Ollama, retained history, validated intent proposals and explicit confirmation.
- Constraint-filtered sample flight offers, budgets for the whole party and baggage per passenger.
- On-demand sample price checks, saved observations and linked in-app notifications.
- R2 screenshot/quotation upload with size/type/signature checks and explicit deletion. OCR is left unconnected; offer fields are manually confirmed.
- OTA total-cost comparison with transparent sample direct fares.
- Opt-in preference and sample Lotusmiles profile.
- Booking review, seat preference, optional baggage, server-side price calculation and saved demo review history. No ticket issuance, payment or fabricated confirmation number.
- Server-side ownership checks and optimistic concurrency control for all state mutations.

## API boundary

`GET /api/state` returns the current user workspace and revision. `POST /api/state` takes `{ action, revision, tripId?, ... }`. Actions: create, edit, status, delete, chat, check, profile, read, booking. Intent fields are validated on the server. Updates require the most recent revision; conflicts return 409.

`POST /api/upload` accepts multipart `file`. `DELETE /api/upload?id=...` deletes an owned upload. Uploaded binary objects are never rendered or executed. Production malware scanning should be part of the approved ingest service before OCR. The stored expiry is metadata; automatic cleanup is not yet scheduled.

`GET /api/integrations` exposes connection status. `POST /api/integrations` deliberately returns 501 instead of simulating payment success.

`lib/integration-contracts.ts` defines the unconnected server-only ports for live search, OCR, Lotusmiles and booking/payment hand-off. Replace the sample provider only after VNA supplies approved API contracts. Never put keys in the client.

## Deliberately pending external integrations

Production VNA OAuth/identity integration, passenger vault, live fare/inventory/repricing, actual fare rules and miles eligibility, OCR, secure payment, scheduled background monitoring and external push/email/SMS. The local prototype now includes its own account/session layer only for development and demonstration. In-app notifications work after an explicit sample check; this app does not claim to monitor live fares while closed. Private hosting identity isolates workspaces and is not presented as VNA authentication. The member toggle is a labelled demonstration.

The original architecture's PostgreSQL/FastAPI/Redis/Kafka deployment is represented here using a Worker API, D1 and R2 supported by the hosting environment. This is a functional demonstration, not a deployed replica of VNA infrastructure. Production adapters can retain the frontend contracts while moving orchestration into the proposed services.

## Development

Use the package manager in package.json. `pnpm install`, `pnpm dev`, `pnpm build`; `pnpm db:generate` generates schema-only Drizzle migrations. Hosted identity is supplied through trusted dispatcher headers; do not accept those headers from arbitrary public clients in a self-hosted deployment.

Bindings are DB (D1) and BUCKET (R2). Migrations in `drizzle/` must be applied before using the API. No external API key is required in demo mode.

## Assets

Ha Long Bay photo: https://www.kimkim.com/c/ho-chi-minh-city-hoi-an-hanoi-hue-ha-long-bay-best-itinerary-ideas (editorial demo reference; verify licence before wider publication). UI icons: lucide-react.

## Vietnamese open-source LLM

Start with [HUONG-DAN-CHAY.md](HUONG-DAN-CHAY.md). Qwen3 via Ollama replaces the keyword chatbot; no OpenAI key or paid LLM API is required. Set OLLAMA_BASE_URL and OLLAMA_MODEL on the server. Local setup and migration automation are included. The hosted site needs a reachable, authenticated model service; local Ollama cannot automatically be used by the hosted Worker.

LLM route tests use mocked model responses; live generation was not tested in the authoring environment because Ollama and model weights were unavailable.


## Email or phone authentication

The local prototype account layer now requires **both an email address and an international phone number when registering one account**. Both identifiers are unique. After registration, the same account can sign in with either its email or its phone number plus the password. Phone numbers must include a country code, for example `+84912345678` or `+61412345678`. Guest sessions remain isolated from registered-user workspaces.

## Protected personal profile

Registered users must complete a Personal information profile before account workspace actions are enabled. Saved fields include name, DOB, Passport/CCCD or National ID, email, phone and home address. DOB, address and identity-document data are encrypted at rest with AES-GCM in `user_profiles`; the key is kept separately in the ignored local `.dev.vars`. These identity fields are not passed to the local LLM. Once onboarding is complete, users can edit personal information and save travel preferences such as seat, baggage and family travel.
