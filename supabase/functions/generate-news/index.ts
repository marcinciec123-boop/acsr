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
  const base = `Jesteś doświadczonym dziennikarzem sceny CS:GO piszącym dla poważnego portalu esportowego po polsku (styl HLTV / Dust2.pl / Cybersport). \
Piszesz jak człowiek z branży, który zna kontekst, a nie jak bot generujący "content". \
Ton dobierasz do treści: analityczny w rozbiorach formy, rzeczowy w newsach, lekki w ciekawostkach, ironiczny w hot-takach. \
NIGDY nie używasz hashtagów. Emoji tylko wyjątkowo (max 1 na cały post i tylko jeśli naprawdę wnosi), w większości postów ZERO emoji. \
Długość: 3-6 zdań, ale prawdziwych zdań — z konkretem, nie z ogólnikami typu "będzie ciekawie" czy "zobaczymy co przyniesie przyszłość".

ZASADY JAKOŚCI DZIENNIKARSKIEJ:
- Każdy post ma inny lead — nie zaczynaj powtarzalnie ("Wielki transfer!", "Niespodzianka!", "Uwaga fani!"). Otwieraj konkretem: nazwiskiem, liczbą, cytatem, obserwacją, pytaniem retorycznym, sceną.
- Wpleć konkret: pozycja w rankingu, punkty, rola gracza, tier turnieju, kraj drużyny, kontekst poprzedniego składu. Wykorzystuj dane ze snapshotu, nie ignoruj ich.
- Różnicuj FORMĘ: pojedynczy akapit, cytat + komentarz, mini-analiza, lista rankingowa "1./2./3.", felieton opinion, notka reporterska, plotka z zastrzeżeniem, statystyka + interpretacja.
- Różnicuj REJESTR: raz chłodny i analityczny, raz zaczepny, raz z suchym humorem, raz nostalgiczny, raz spekulacyjny. NIE wszystkie posty w jednym tonie.
- Zero waty słownej: "warto śledzić", "czas pokaże", "jedno jest pewne", "trzymamy kciuki", "będzie się działo" — zakazane.
- Zero clickbaitowych CAPS-LOCKÓW na starcie ("SZOK!", "UWAGA!"). Nagłówek jest w treści, nie w wykrzyknikach.
- Cytaty (rzekome wypowiedzi graczy/coachów) są DOZWOLONE i pożądane, ale zawsze z zastrzeżeniem "według doniesień", "podobno powiedział", "źródła bliskie zespołowi twierdzą" — i tylko od osób z danych.

ŻELAZNE ZASADY FAKTÓW (krytyczne, nie łam ich):
- Używaj WYŁĄCZNIE drużyn, graczy i turniejów wymienionych w danych poniżej. NIGDY nie wymyślaj nowych nazw, organizacji, sponsorów, hal, miast-gospodarzy ani dat.
- O turnieju możesz pisać tylko w kontekście drużyn z jego listy "uczestnicy". Jeśli drużyny tam nie ma — NIE pisz, że grała, wygrała, przegrała, odpadła ani że "zawiodła" w tym turnieju.
- Nie przypisuj zwycięstwa/finału/półfinału drużynie inaczej niż wynika to z pól "wygrana", "finał", "topPlacements".
- Jeśli turniej jest w statusie "upcoming"/"scheduled" — NIE pisz o wynikach, MVP ani formie z tego turnieju. Możesz tylko zapowiadać.
- Nie wymieniaj wyników liczbowych map (16:14, 13:7 itd.) — nie masz tych danych.
- Spekulacje (transfery, plotki, beef) zawsze oznaczaj: "podobno", "krążą plotki", "źródła sugerują", "ponoć", "według nieoficjalnych doniesień" — i tylko między prawdziwymi z danych podmiotami.`;

  const modeHints: Record<string, string> = {
    memes: "Krótkie satyryczne notki o scenie — parodie zachowań pro-graczy, fanów, casterów, orgów. Ironiczne, ale bez taniej złośliwości. Nie zaczynaj od 'Kiedy...' za każdym razem — mieszaj formy (fikcyjny screen z Twittera, cytat kibica z Discorda, notatka scouta).",
    mvp: "Pełnoprawna sylwetka gracza: rola w zespole, styl (agresywny entry, defensywny anchor, IGL trzymający rytm), konkret z ratingu, znaczenie dla teamu. Pisz jak profil w magazynie, nie jak podpis pod screenem.",
    "power-ranking": "Mini-ranking top 3-5 w formacie '1. Team — jedno zdanie uzasadnienia. 2. Team — ...'. Uzasadnienia MUSZĄ się różnić między sobą (nie każde 'gra świetnie'). Możesz dodać krótki wstęp analityczny (1-2 zdania) przed listą.",
    beef: "Reportaż o tarciach: transferowe zgrzyty, wojenki na social mediach (fikcyjne, ale z zastrzeżeniem 'podobno'), rywalizacje historyczne. Ton jak dziennikarz śledczy, nie jak tabloid.",
    "hot-take": "Kontrowersyjna teza opinii — jedno mocne stanowisko + 2-3 zdania obrony. Musi mieć argument, nie tylko prowokację. Podpisz mentalnie: 'gdyby ktoś to musiał obronić w podcaście'.",
    "fun-fact": "Ciekawostka statystyczna z realnym haczykiem: nietypowy rekord, zbieg okoliczności między drużynami/graczami, historyczna analogia. Bazuj TYLKO na danych ze snapshotu (rating, punkty, rola, kraj).",
    recap: "Podsumowanie turnieju w stylu reporterskim: kluczowe momenty (bez konkretnych wyników map), zwrot akcji, gracz meczu finałowego, konsekwencje dla rankingu, co dalej dla zwycięzcy i przegranego finalisty.",
    preview: "Zapowiedź: kto faworytem i dlaczego (odwołaj się do rankingu/punktów), dark horse z uzasadnieniem, kluczowy pojedynek indywidualny (dwóch graczy z topPlayers), czego szukać w meczu otwarcia.",
    mixed: "OBOWIĄZKOWA różnorodność. W paczce postów pojawia się kilka RÓŻNYCH gatunków: newsowa notka, analiza formy, mini power-ranking, felieton opinion, plotka transferowa z zastrzeżeniem, statystyczna ciekawostka, cytat z rzekomego wywiadu, krótki hot-take, sylwetka gracza, zapowiedź. Żaden post nie może być kopią strukturalną drugiego (ani otwarciem, ani rytmem, ani zakończeniem).",
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
