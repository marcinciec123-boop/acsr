// Shared abuse guard for AI-generating edge functions.
// The app has no user accounts, so instead of auth we bound AI spend:
// per-caller (IP) hourly limit + a global daily cap, tracked in the
// service-role-only table public.ai_rate_limits.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PER_CALLER_HOURLY_LIMIT = 30;
const GLOBAL_DAILY_LIMIT = 300;

export interface RateLimitResult {
  allowed: boolean;
  status: number;
  message: string;
}

export async function checkAiRateLimit(req: Request, endpoint: string): Promise<RateLimitResult> {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    // Misconfiguration — fail closed to avoid unbounded AI spend.
    return { allowed: false, status: 500, message: "Server configuration error" };
  }

  const caller =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  const key = `${endpoint}:${caller}`;

  const supabase = createClient(url, serviceKey);

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [callerRes, globalRes] = await Promise.all([
    supabase
      .from("ai_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("caller", key)
      .gte("created_at", hourAgo),
    supabase
      .from("ai_rate_limits")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo),
  ]);

  if (callerRes.error || globalRes.error) {
    console.error("rate limit check failed:", callerRes.error || globalRes.error);
    return { allowed: false, status: 500, message: "Rate limit check failed" };
  }

  if ((callerRes.count ?? 0) >= PER_CALLER_HOURLY_LIMIT) {
    return { allowed: false, status: 429, message: "Za dużo żądań — spróbuj ponownie za jakiś czas." };
  }
  if ((globalRes.count ?? 0) >= GLOBAL_DAILY_LIMIT) {
    return { allowed: false, status: 429, message: "Dzienny limit generowania AI został osiągnięty." };
  }

  // Record this call, then opportunistically clean old rows (~5% of calls).
  const { error: insertError } = await supabase.from("ai_rate_limits").insert({ caller: key });
  if (insertError) {
    console.error("rate limit insert failed:", insertError);
    return { allowed: false, status: 500, message: "Rate limit check failed" };
  }
  if (Math.random() < 0.05) {
    await supabase.from("ai_rate_limits").delete().lt("created_at", dayAgo);
  }

  return { allowed: true, status: 200, message: "ok" };
}
