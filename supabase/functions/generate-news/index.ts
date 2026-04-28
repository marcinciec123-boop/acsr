// Edge function: generate-news
// Generates AI-written CS:GO news posts (rumours, meta analysis, opinion pieces)
// based on the world snapshot the client sends in.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SnapshotPayload {
  /** Top ~10 teams by points */
  topTeams: { name: string; points: number; country: string }[];
  /** Most recent transfers */
  recentTransfers: { player: string; oldTeam: string; newTeam: string }[];
  /** Recent / upcoming tournaments */
  tournaments: { name: string; status: string; tier: string; teams: number }[];
  /** Top players by rating (optional) */
  topPlayers?: { player: string; team: string; rating: number }[];
  /** How many posts to generate */
  count?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as SnapshotPayload;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const count = Math.min(Math.max(body.count ?? 5, 1), 10);

    const systemPrompt = `Jesteś dziennikarzem sceny CS:GO piszącym dla portalu fanowskiego. \
Piszesz krótkie newsy, plotki i analizy meta po polsku. Każdy post ma 2-4 zdania, \
konkretny ton, czasem prowokacyjny, czasem analityczny. NIE używaj emoji ani hashtagów. \
NIE wymyślaj wydarzeń sprzeczne z danymi. Możesz spekulować ("podobno", "krążą plotki", \
"źródła sugerują") ale tylko bazując na rzeczywistych transferach/turniejach z danych.`;

    const userPrompt = `Wygeneruj ${count} różnorodnych newsów. Mix typów: \
plotki transferowe, analizy formy zespołów, komentarze do wyników turniejów, opinie o ratingach graczy.

DANE ŚWIATA:

Top drużyny:
${body.topTeams.slice(0, 10).map((t, i) => `${i + 1}. ${t.name} (${t.points} pkt, ${t.country})`).join("\n")}

Ostatnie transfery:
${body.recentTransfers.slice(0, 10).map(t => `${t.player}: ${t.oldTeam || "FA"} → ${t.newTeam || "FA"}`).join("\n")}

Turnieje:
${body.tournaments.slice(0, 8).map(t => `${t.name} [${t.tier}] — ${t.status}, ${t.teams} dr.`).join("\n")}
${body.topPlayers?.length ? `\nTop gracze (rating):\n${body.topPlayers.slice(0, 8).map(p => `${p.player} (${p.team}) — ${p.rating}`).join("\n")}` : ""}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "publish_news",
              description: "Publish a batch of news posts.",
              parameters: {
                type: "object",
                properties: {
                  posts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: {
                          type: "string",
                          enum: ["transfer", "rumor", "analysis", "tournament", "rating", "opinion"],
                        },
                        content: { type: "string", description: "Treść newsa, 2-4 zdania, po polsku" },
                      },
                      required: ["category", "content"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["posts"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "publish_news" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit przekroczony, spróbuj później." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Brak kredytów AI. Doładuj w Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const txt = await aiResp.text();
      console.error("AI error:", aiResp.status, txt);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "Brak tool_call w odpowiedzi" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const args = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ posts: args.posts || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-news error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
