// Edge function: generate-comments
// Generuje 5-15 fikcyjnych komentarzy społeczności pod konkretnym artykułem.
// Komentarze muszą reagować na treść tekstu (nie generyczne wypełniacze).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
  count?: number;
  /** Wyciąg z bazy danych aplikacji: składy, trenerzy, punkty, miejsca w rankingu */
  facts?: string;
  /** "post" (domyślnie) = komentarze pod artykułem, "reply" = odpowiedzi na komentarz redakcji */
  mode?: "post" | "reply";
  /** Dla mode="reply": wątek dyskusji (od najstarszego) */
  thread?: { author: string; content: string }[];
  /** Dla mode="reply": treść wpisu redakcji, na który odpowiada społeczność */
  targetAuthor?: string;
  targetContent?: string;
  /** Nicki już użyte w wątku — nie powtarzaj ich bez potrzeby */
  usedNicks?: string[];
}

const FACTS_RULES = `ZASADY FAKTOGRAFICZNE (NAJWAŻNIEJSZE):
- Jedynym źródłem prawdy jest sekcja "BAZA DANYCH" oraz treść artykułu. Twoja wiedza o prawdziwym CS/CS2 jest NIEAKTUALNA i zabroniona.
- NIGDY nie przypisuj gracza do drużyny, w której nie widnieje w BAZIE DANYCH. Jeśli nie wiesz, w jakiej drużynie gra dana osoba — nie pisz o tym.
- Nie wymyślaj nazw drużyn, graczy, trenerów, turniejów ani wyników, których nie ma w artykule lub BAZIE DANYCH.
- Nie podawaj miejsc w rankingu ani liczby punktów sprzecznych z BAZĄ DANYCH.
- Lepiej napisać komentarz ogólny/emocjonalny niż zmyślić fakt.`;

const NICK_RULES = `NICKI (mają wyglądać jak prawdziwi ludzie z polskiego forum esportowego, MOCNO różnorodne — mieszaj poniższe style, nie trzymaj się jednego):
- ksywka + liczba: "marcin97", "kubaa21", "Pawel_88", "damian2137"
- imię/nazwisko-podobne: "MateuszWojcik", "j.kowalski", "adrian_nowak"
- fanowskie: "vitalityFAN", "NAVI_do_grobu", "falcons4life", "awp_enjoyer"
- growe/nostalgiczne: "xXNoScopeXx", "smokecriminal", "eco_frag", "clutchOrKick", "deagle1v5"
- skrótowe/leniwe: "kk", "mrw", "zwykly_gracz", "randomek", "typek z bloku"
- lekko absurdalne/memiczne: "JanuszTaktyki", "PrezesFragów", "kanapka_z_serem", "dziadek_na_LAN"
- z polskimi znakami i spacjami: "Tomek Ż.", "Pan Rafał", "Grzesiek 1996"
- inspirowane graczami/rolami: "IGL_wannabe", "lurker69", "anchor_b", "entry_diff"
Zasady: bez emoji w nicku, max 20 znaków, unikaj powtarzania tego samego wzorca dwa razy pod rząd i nie używaj nicków już obecnych w wątku.`;

const STYLE_RULES = `STYL (ma brzmieć jak prawdziwi ludzie, nie jak AI):
- Różna długość: od 2 słów ("kox", "no i dobrze") po 3 zdania. Większość krótkich, kilka dłuższych analitycznych.
- Potoczny polski: skróty ("nwm", "imo", "kc", "xd", "wgl", "np", "btw"), brak polskich znaków u części userów, brak kropki na końcu, czasem literówka, czasem małe litery na starcie.
- Zero korporacyjnego/redakcyjnego tonu, zero idealnej interpunkcji u wszystkich, zero jednakowej struktury zdań.
- Emotki oszczędnie i tekstowe ("xd", ":D", ">.<"), max w co trzecim komentarzu; unikaj emoji-spamu.
- Charaktery: hejter, fanboy, analityk ze statystykami, żartowniś, świeżak z pytaniem, marudzący weteran ("za moich czasów..."), typ off-topic, ktoś kto tylko rzuca "^^ to", betiarz narzekający na kupon.
- Ludzie piszą też o pobocznych rzeczach: kursy, oglądalność, godzina meczu, transmisja, ich własne typy.
- Zero powtarzania tej samej myśli, zero pustego "dobry artykuł", zero podsumowań artykułu.
- Bez wulgaryzmów obelżywych wobec realnych osób; sarkazm, ironia i "kox" dozwolone.
- likes: liczba całkowita od -15 do 250; celne/śmieszne wyżej, kontrowersyjne na minusie.`;

const SYSTEM = `Jesteś generatorem sekcji komentarzy pod artykułem na polskim portalu esportowym o CS:GO (klimat HLTV / forum / Wykop).
${FACTS_RULES}
${NICK_RULES}
${STYLE_RULES}
DYSKUSJA:
- Od 30% do 50% komentarzy ma być ODPOWIEDZIAMI na wcześniejsze komentarze (replyToIndex = indeks wcześniejszego komentarza, zawsze mniejszy od własnego). Reszta ma replyToIndex = -1.
- Odpowiedź musi realnie nawiązywać do komentarza, na który odpowiada: kontra, przytyk, sprostowanie danych, żart, zgoda z dopiskiem. Rób krótkie łańcuszki (odpowiedź na odpowiedź) i mini-kłótnie 2-3 wiadomości.
- W odpowiedziach można cytować nick rozmówcy (np. "@marcin97").`;

const SYSTEM_REPLY = `Jesteś generatorem odpowiedzi użytkowników polskiego portalu esportowego o CS:GO (klimat HLTV / forum / Wykop).
Dostajesz wątek komentarzy i wpis REDAKCJI. Twoim zadaniem jest napisać reakcje zwykłych użytkowników na ten wpis redakcji.
${FACTS_RULES}
${NICK_RULES}
${STYLE_RULES}
ZASADY WĄTKU:
- Każda odpowiedź odnosi się bezpośrednio do treści wpisu redakcji (a przez replyToIndex może też odpowiadać innej odpowiedzi w tej samej paczce).
- Reakcje bywają różne: podziękowanie za wyjaśnienie, podważanie redakcji, "źródło?", czepianie się szczegółu, żart, ktoś kto broni redakcji przed hejterem.
- Nie podszywaj się pod redakcję — piszesz wyłącznie jako zwykli użytkownicy.
- replyToIndex = -1 oznacza odpowiedź bezpośrednio na wpis redakcji; wartość >= 0 to odpowiedź na wcześniejszą pozycję z tej paczki.`;




Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Payload;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isReply = body.mode === "reply";
    const count = isReply
      ? Math.min(Math.max(body.count ?? (1 + Math.floor(Math.random() * 3)), 1), 6)
      : Math.min(Math.max(body.count ?? (5 + Math.floor(Math.random() * 11)), 5), 15);

    const factsBlock = body.facts
      ? `BAZA DANYCH (jedyne prawdziwe składy, trenerzy, punkty i miejsca w rankingu — nie zmyślaj nic poza tym):\n${body.facts.slice(0, 6000)}`
      : "";

    const userPrompt = isReply
      ? [
          factsBlock,
          body.title ? `TYTUŁ ARTYKUŁU: ${body.title}` : "",
          `TREŚĆ ARTYKUŁU:\n${(body.content || "").slice(0, 2500)}`,
          body.thread?.length
            ? `WĄTEK DYSKUSJI (od najstarszego):\n${body.thread
                .slice(-12)
                .map(t => `${t.author}: ${t.content}`)
                .join("\n")}`
            : "",
          `WPIS REDAKCJI, NA KTÓRY REAGUJEMY:\n${body.targetAuthor || "Redakcja"}: ${(body.targetContent || "").slice(0, 1200)}`,
          body.usedNicks?.length ? `NICKI JUŻ UŻYTE (nie powtarzaj): ${body.usedNicks.slice(0, 40).join(", ")}` : "",
          `\nNapisz dokładnie ${count} odpowiedzi użytkowników na wpis redakcji. Mają brzmieć jak żywi ludzie, nie jak AI.`,
        ].filter(Boolean).join("\n\n")
      : [
          factsBlock,
          body.title ? `TYTUŁ: ${body.title}` : "",
          `TREŚĆ ARTYKUŁU:\n${(body.content || "").slice(0, 4000)}`,
          body.category ? `KATEGORIA: ${body.category}` : "",
          body.tags?.length ? `TAGI: ${body.tags.join(", ")}` : "",
          `\nNapisz dokładnie ${count} komentarzy użytkowników pod tym artykułem. Uporządkuj je tak, jakby toczyła się luźna dyskusja — kilka pierwszych najbardziej "na temat". Zanim napiszesz o graczu i jego drużynie, zweryfikuj to w BAZIE DANYCH — błędne przypisanie gracza do drużyny jest niedopuszczalne.`,
        ].filter(Boolean).join("\n\n");


    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 1.1,
        messages: [
          { role: "system", content: isReply ? SYSTEM_REPLY : SYSTEM },
          { role: "user", content: userPrompt },
        ],

        tools: [
          {
            type: "function",
            function: {
              name: "publish_comments",
              description: "Publish the generated user comment section.",
              parameters: {
                type: "object",
                properties: {
                  comments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        author: { type: "string", description: "Nick użytkownika" },
                        content: { type: "string", description: "Treść komentarza po polsku" },
                        likes: { type: "integer", description: "Liczba polubień" },
                        replyToIndex: {
                          type: "integer",
                          description: "Indeks (0-based) wcześniejszego komentarza w tej tablicy, na który to jest odpowiedź. -1 jeśli komentarz nie jest odpowiedzią. Musi być mniejszy niż indeks tego komentarza.",
                        },
                      },
                      required: ["author", "content", "likes", "replyToIndex"],
                      additionalProperties: false,
                    },

                  },
                },
                required: ["comments"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "publish_comments" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit przekroczony, spróbuj później." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Brak kredytów AI. Doładuj w ustawieniach workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const txt = await aiResp.text();
      console.error("AI error:", aiResp.status, txt);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "Brak tool_call w odpowiedzi" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const args = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ comments: args.comments || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-comments error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
