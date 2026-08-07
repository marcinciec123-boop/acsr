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
}

const SYSTEM = `Jesteś generatorem sekcji komentarzy pod artykułem na polskim portalu esportowym o CS:GO (klimat HLTV / forum / Wykop).
Piszesz komentarze zwykłych użytkowników — różnorodne charaktery: hejter, fanboy drużyny, analityk-nerd ze statystykami, żartowniś, świeżak zadający pytanie, ktoś kto zgadza się z autorem, ktoś kto ostro polemizuje, ktoś kto pisze off-topic jednym zdaniem.
ZASADY FAKTOGRAFICZNE (NAJWAŻNIEJSZE):
- Jedynym źródłem prawdy jest sekcja "BAZA DANYCH" oraz treść artykułu. Twoja wiedza o prawdziwym CS/CS2 jest NIEAKTUALNA i zabroniona.
- NIGDY nie przypisuj gracza do drużyny, w której nie widnieje w BAZIE DANYCH. Jeśli nie wiesz, w jakiej drużynie gra dana osoba — nie pisz o tym.
- Nie wymyślaj nazw drużyn, graczy, trenerów, turniejów ani wyników, których nie ma w artykule lub BAZIE DANYCH.
- Nie podawaj miejsc w rankingu ani liczby punktów sprzecznych z BAZĄ DANYCH.
- Lepiej napisać komentarz ogólny/emocjonalny niż zmyślić fakt.
POZOSTAŁE ZASADY:
- Każdy komentarz MUSI odnosić się do konkretnej treści artykułu: nazw drużyn, graczy, turniejów, liczb i tez, które w nim padły.
- Nicki jak na forum: małe litery, cyfry, podkreślenia (np. "kacper_awp", "b1t_enjoyer", "xdd420", "TaktycznyJanusz").
- Długość: od 3 słów do 3 zdań. Naturalny, potoczny polski, czasem literówka, czasem CAPS, emotki z umiarem.
- Bez wulgaryzmów obelżywych wobec realnych osób; lekki sarkazm i "kox" dozwolony.
- Zero powtarzania tej samej myśli, zero pustych "dobry artykuł".
- likes: liczba całkowita od -15 do 250, popularniejsze/celniejsze komentarze mają więcej.`;


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

    const count = Math.min(Math.max(body.count ?? (5 + Math.floor(Math.random() * 11)), 5), 15);

    const userPrompt = [
      body.facts
        ? `BAZA DANYCH (jedyne prawdziwe składy, trenerzy, punkty i miejsca w rankingu — nie zmyślaj nic poza tym):\n${body.facts.slice(0, 6000)}`
        : "",
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
        messages: [
          { role: "system", content: SYSTEM },
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
                      },
                      required: ["author", "content", "likes"],
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
