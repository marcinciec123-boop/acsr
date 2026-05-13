// Edge function: generate-news
// Generates AI-written CS:GO news posts in many flavours: rumours, meta analysis,
// memes, MVP profiles, power rankings, "beef", hot takes, fun facts, recaps.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SnapshotPayload {
  topTeams: { name: string; points: number; country: string }[];
  recentTransfers: { player: string; oldTeam: string; newTeam: string }[];
  tournaments: { name: string; status: string; tier: string; teams: number; winner?: string | null; runnerUp?: string | null; participants?: string[]; topPlacements?: { team: string; placement: number }[] }[];
  topPlayers?: { player: string; team: string; rating: number; role?: string }[];
  count?: number;
  /** Optional: bias the generator toward a specific post type */
  mode?: "mixed" | "memes" | "mvp" | "power-ranking" | "beef" | "hot-take" | "fun-fact" | "recap" | "preview";
  /** Optional: concrete event context (e.g. tournament summary) used as the spine of the posts */
  context?: string;
}

const POST_CATEGORIES = [
  "transfer",     // ruchy zawodników
  "rumor",        // nieoficjalne plotki
  "analysis",     // analiza meta / formy
  "tournament",   // newsy turniejowe
  "rating",       // komentarz do ratingów
  "opinion",      // hot takes
  "meme",         // żart, mem tekstowy
  "mvp",          // sylwetka MVP / rising star
  "power-ranking", // top 5/10 z komentarzem
  "beef",         // konflikt, dramat między graczami/teamami
  "fun-fact",     // ciekawostka, statystyka
  "recap",        // podsumowanie turnieju
  "preview",      // zapowiedź meczu/turnieju
  "interview",    // wymyślony cytat z gracza/coacha
];

function buildSystemPrompt(mode: string): string {
  const base = `Jesteś dziennikarzem sceny CS:GO piszącym dla portalu fanowskiego po polsku. \
Piszesz krótkie, soczyste posty z różnorodnym tonem — czasem analitycznie, czasem prowokacyjnie, \
czasem z humorem. NIE używaj hashtagów. Emoji używaj OSZCZĘDNIE (max 1 na post, tylko jeśli pasuje). \
Każdy post to 2-5 zdań.

ŻELAZNE ZASADY FAKTÓW (krytyczne, nie łam ich):
- Używaj WYŁĄCZNIE drużyn, graczy i turniejów wymienionych w danych poniżej. NIGDY nie wymyślaj nowych nazw.
- O turnieju możesz pisać tylko w kontekście drużyn z jego listy "uczestnicy". Jeśli drużyny tam nie ma — NIE pisz, że grała, wygrała, przegrała, odpadła ani że "zawiodła" w tym turnieju.
- Nie przypisuj zwycięstwa/finału/półfinału drużynie inaczej niż wynika to z pól "wygrana", "finał", "topPlacements".
- Jeśli turniej jest w statusie "upcoming"/"scheduled" (jeszcze się nie zaczął) — NIE pisz o wynikach, MVP, formie z tego turnieju. Możesz tylko zapowiadać.
- Nie wymieniaj wyników liczbowych map (np. 16:14), bo nie masz tych danych.
- Spekulacje (transfery, plotki, beef) zawsze oznaczaj słowami "podobno", "krążą plotki", "źródła sugerują", "ponoć" — i tylko między prawdziwymi z danych podmiotami.`;

  const modeHints: Record<string, string> = {
    memes: "Skup się na memach i żartach — krótkie, dosadne, czasem z dystansem do sceny. Możesz parodiować typowe zachowania pro-graczy, fanów, casterów.",
    mvp: "Pisz sylwetki MVP / rising star — konkretne osiągnięcia, styl gry, rola w teamie, dlaczego błyszczy.",
    "power-ranking": "Twórz mini-rankingi (top 3/5) z krótkim uzasadnieniem przy każdym miejscu. Format: '1. Team — powód. 2. Team — powód.' itd.",
    beef: "Pisz o tarciach, konfliktach, podjazdach między graczami / teamami — bazuj na transferach i wynikach. Lekko prowokacyjny ton.",
    "hot-take": "Kontrowersyjne opinie, przewidywania, niepopularne tezy. Bądź odważny ale uzasadnij.",
    "fun-fact": "Statystyczne ciekawostki, nietypowe rekordy, dziwne zbiegi okoliczności. Bazuj na danych z snapshotu.",
    recap: "Podsumowanie turnieju — najważniejsze momenty, MVP, niespodzianki, co dalej dla zwycięzców.",
    preview: "Zapowiedź nadchodzącego turnieju lub meczu — kto faworytem, na co zwracać uwagę, kto może zaskoczyć.",
    mixed: "Mieszaj typy postów: plotki, analizy, memy, MVP, power-rankingi, beef, hot takes, ciekawostki, recapy, zapowiedzi, cytaty z 'wywiadów'. Zachowuj różnorodność tonu i formy.",
  };

  return `${base}\n\nTRYB: ${modeHints[mode] || modeHints.mixed}`;
}

function buildUserPrompt(body: SnapshotPayload, count: number): string {
  const parts: string[] = [];
  parts.push(`Wygeneruj ${count} ${count === 1 ? "post" : "różnorodnych postów"}.`);

  if (body.context) {
    parts.push(`\nKONTEKST WYDARZENIA (najważniejsze!):\n${body.context}`);
  }

  parts.push(`\nTop drużyny:\n${body.topTeams.slice(0, 12).map((t, i) => `${i + 1}. ${t.name} (${t.points} pkt, ${t.country})`).join("\n")}`);

  if (body.recentTransfers.length) {
    parts.push(`\nOstatnie transfery:\n${body.recentTransfers.slice(0, 12).map(t => `${t.player}: ${t.oldTeam || "FA"} → ${t.newTeam || "FA"}`).join("\n")}`);
  }

  if (body.tournaments.length) {
    parts.push(`\nTurnieje (KAŻDA wzmianka o turnieju MUSI dotyczyć drużyny z jego listy "uczestnicy"):\n${body.tournaments.slice(0, 10).map(t => {
      const participants = t.participants?.length ? `\n   uczestnicy: ${t.participants.join(", ")}` : "";
      const top = t.topPlacements?.length ? `\n   miejsca: ${t.topPlacements.map(p => `${p.placement}. ${p.team}`).join(", ")}` : "";
      const w = t.winner ? ` — wygrana: ${t.winner}${t.runnerUp ? ` (finał vs ${t.runnerUp})` : ""}` : "";
      return `- ${t.name} [${t.tier}] — status: ${t.status}, ${t.teams} dr.${w}${participants}${top}`;
    }).join("\n")}`);
  }

  if (body.topPlayers?.length) {
    parts.push(`\nTop gracze (rating):\n${body.topPlayers.slice(0, 12).map(p => `${p.player} (${p.team})${p.role ? ` [${p.role}]` : ""} — ${p.rating.toFixed(2)}`).join("\n")}`);
  }

  parts.push(`\nUŻYWAJ WYŁĄCZNIE NAZW Z POWYŻSZYCH DANYCH. Jeśli post dotyczy turnieju, sprawdź że drużyna jest na liście "uczestnicy" tego turnieju — inaczej nie pisz o niej w kontekście tego turnieju. Każdy post musi mieć inny temat lub inny ton.`);

  return parts.join("\n");
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

    const count = Math.min(Math.max(body.count ?? 6, 1), 12);
    const mode = body.mode || "mixed";

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: buildSystemPrompt(mode) },
          { role: "user", content: buildUserPrompt(body, count) },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "publish_news",
              description: "Publish a batch of varied CS:GO news posts.",
              parameters: {
                type: "object",
                properties: {
                  posts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string", enum: POST_CATEGORIES },
                        content: { type: "string", description: "Treść posta po polsku, 2-5 zdań" },
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
