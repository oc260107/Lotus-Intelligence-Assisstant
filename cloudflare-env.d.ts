declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    OLLAMA_BASE_URL?: string;
    OLLAMA_MODEL?: string;
    OLLAMA_API_KEY?: string;
    PROFILE_ENCRYPTION_KEY?: string;
    BUCKET?: R2Bucket;
  }
}
