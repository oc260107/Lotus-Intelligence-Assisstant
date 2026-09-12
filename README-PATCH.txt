LIA - Secure Travel Profile patch

Apply this patch to the CURRENT working project:
C:\Tran Minh Duc\Code\Project\LIA-Qwen-Vietnamese-auth-phone\LIA-Qwen-Vietnamese

What it adds
- Mandatory personal-information onboarding for registered accounts.
- Required: full name, DOB, Passport or CCCD/National ID, email, phone, home address.
- Existing email/phone/name are prefilled.
- User may switch the current session to Guest instead of completing onboarding.
- Personal profile persists across sign-ins and remains editable.
- DOB, home address and identity-document details are AES-GCM encrypted at rest.
- Encryption key is generated into .dev.vars and is never stored in D1.
- Identity fields are never sent to Qwen/Ollama.
- Preferences unlock after personal information is completed: seat, baggage, family, personalisation, alerts and demo Lotusmiles.
- Save actions show success notifications.

IMPORTANT
- Do NOT delete .wrangler\state (your local accounts/trips live there).
- Do NOT overwrite/delete your real .dev.vars after PROFILE_ENCRYPTION_KEY is generated.
- Do NOT commit/share .dev.vars.

After copying the patch files over the project, run in CMD:

cd /d "C:\Tran Minh Duc\Code\Project\LIA-Qwen-Vietnamese-auth-phone\LIA-Qwen-Vietnamese"
if exist .vinext rmdir /s /q .vinext
if exist .next rmdir /s /q .next
pnpm setup:local
if exist .vinext rmdir /s /q .vinext
if exist .next rmdir /s /q .next
pnpm dev

pnpm setup:local is required ONCE for this patch. It applies migration 0004 and creates PROFILE_ENCRYPTION_KEY if missing.
