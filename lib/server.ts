import { bucket, database } from '@/lib/server-db';
import { requireIdentity } from '@/lib/auth';

export { bucket, database };

// A signed-in account is enough to use LIA. Passenger identity details are
// deliberately NOT an onboarding gate; they can be collected later when the
// traveller chooses to continue to booking.
export async function owner(request: Request) {
  return (await requireIdentity(request)).owner;
}

export async function authIdentity(request: Request) {
  return requireIdentity(request);
}

// Kept as a compatibility alias for routes created before profile onboarding
// became optional. It no longer checks user_profiles.
export async function completeIdentity(request: Request) {
  return requireIdentity(request);
}

export function mutationGuard(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    throw new Error('FORBIDDEN');
  }
}

export function failure(error: unknown) {
  console.error(error);
  const m = error instanceof Error ? error.message : '';
  return Response.json(
    {
      error:
        m === 'UNAUTHORIZED'
          ? 'Please sign in or continue as guest to access LIA.'
          : m === 'FORBIDDEN'
            ? 'Request not permitted.'
            : m === 'PROFILE_KEY_MISSING'
              ? 'Protected profile storage is not configured. Run pnpm setup:local once, then restart LIA.'
              : m === 'PROFILE_DECRYPT'
                ? 'Your protected profile could not be opened. Check the local profile encryption key.'
                : m.startsWith('VALIDATION:')
                  ? m.slice(11)
                  : 'Unable to save right now. Your input is still available; please try again.',
    },
    {
      status:
        m === 'UNAUTHORIZED'
          ? 401
          : m === 'FORBIDDEN'
            ? 403
            : m === 'PROFILE_KEY_MISSING' || m === 'PROFILE_DECRYPT'
              ? 503
              : m.startsWith('VALIDATION:')
                ? 400
                : 503,
    },
  );
}
