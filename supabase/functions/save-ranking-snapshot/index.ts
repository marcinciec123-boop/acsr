import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEAMS = 500;
const MAX_ROSTER_SIZE = 20;
const MAX_NAME_LEN = 80;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function validateNumberMap(v: unknown): v is Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const entries = Object.entries(v as Record<string, unknown>);
  if (entries.length > MAX_TEAMS) return false;
  return entries.every(
    ([k, val]) => typeof k === "string" && k.length <= MAX_NAME_LEN && isFiniteNumber(val),
  );
}

function validateRosterMap(v: unknown): v is Record<string, string[]> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const entries = Object.entries(v as Record<string, unknown>);
  if (entries.length > MAX_TEAMS) return false;
  return entries.every(
    ([k, val]) =>
      typeof k === "string" &&
      k.length <= MAX_NAME_LEN &&
      Array.isArray(val) &&
      val.length <= MAX_ROSTER_SIZE &&
      val.every(p => typeof p === "string" && p.length <= MAX_NAME_LEN),
  );
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { snapshot_date, points, ranks, rosters, source } = (body ?? {}) as Record<string, unknown>;

  if (typeof snapshot_date !== "string" || !DATE_RE.test(snapshot_date)) {
    return new Response(JSON.stringify({ error: "Invalid snapshot_date" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!validateNumberMap(points) || Object.keys(points).length === 0) {
    return new Response(JSON.stringify({ error: "Invalid points" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (ranks !== undefined && !validateNumberMap(ranks)) {
    return new Response(JSON.stringify({ error: "Invalid ranks" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (rosters !== undefined && !validateRosterMap(rosters)) {
    return new Response(JSON.stringify({ error: "Invalid rosters" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const safeSource = source === "historical" ? "historical" : "daily";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supabase
    .from("ranking_snapshots")
    .upsert(
      {
        snapshot_date,
        points,
        ranks: ranks ?? {},
        rosters: rosters ?? {},
        source: safeSource,
      },
      { onConflict: "snapshot_date" },
    );

  if (error) {
    return new Response(JSON.stringify({ error: "Save failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
