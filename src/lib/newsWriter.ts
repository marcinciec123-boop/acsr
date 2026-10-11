// ===== Żywe dziennikarstwo: losowane, kontekstowe teksty szablonów aktualności =====
// Każde wywołanie losuje nagłówek, lead, strukturę i puentę, dopasowane do
// tego, co faktycznie wydarzyło się w meczach (upset, pogrom, dogrywki, gwiazda).

import type { MatchResult } from "./types";
import { loadAllTeams } from "./teamManagement";
import { playerRoles } from "@/data/playerRoles";

export const rnd = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const chance = (p: number) => Math.random() < p;
const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
const joinPl = (xs: string[]) => xs.length <= 1 ? (xs[0] || "") : `${xs.slice(0, -1).join(", ")} i ${xs[xs.length - 1]}`;

export function rankOf(team: string): number | null {
  try {
    const teams = [...loadAllTeams()].filter(t => !t.isNational).sort((a, b) => (b.points || 0) - (a.points || 0));
    const i = teams.findIndex(t => t.name === team);
    return i >= 0 ? i + 1 : null;
  } catch { return null; }
}

export interface Mvp { name: string; team: string; rating: number; kills: number; deaths: number; adr: number }

export interface MatchFacts {
  m: MatchResult;
  w: string; l: string; ws: number; ls: number;
  wRank: number | null; lRank: number | null;
  upset: boolean; sweep: boolean; decider: boolean;
  overtime: boolean; stomp: boolean; tight: boolean;
  mapsTxt: string;
  closestMap?: { map: string; a: number; b: number };
  mvp: Mvp | null;
}

export function analyzeMatch(m: MatchResult, mvp: Mvp | null): MatchFacts {
  const w = m.score1 > m.score2 ? m.team1 : m.team2;
  const l = w === m.team1 ? m.team2 : m.team1;
  const ws = Math.max(m.score1, m.score2), ls = Math.min(m.score1, m.score2);
  const wRank = rankOf(w), lRank = rankOf(l);
  const maps = (m.maps || []).filter(mp => (mp.score1 || 0) + (mp.score2 || 0) > 0);
  const overtime = maps.some(mp => Math.max(mp.score1, mp.score2) > 13);
  const diffs = maps.map(mp => Math.abs(mp.score1 - mp.score2));
  const stomp = maps.length > 0 && diffs.every(d => d >= 7);
  const tight = maps.length > 0 && diffs.some(d => d <= 3);
  const closest = [...maps].sort((a, b) => Math.abs(a.score1 - a.score2) - Math.abs(b.score1 - b.score2))[0];
  const upset = wRank != null && lRank != null ? wRank - lRank >= 8 : wRank == null && lRank != null && lRank <= 15;
  return {
    m, w, l, ws, ls, wRank, lRank, upset,
    sweep: ls === 0 && ws >= 2,
    decider: ws >= 2 && ls === ws - 1,
    overtime, stomp, tight,
    mapsTxt: maps.map(mp => `${mp.map} ${mp.score1}:${mp.score2}`).join(", "),
    closestMap: closest ? { map: closest.map, a: closest.score1, b: closest.score2 } : undefined,
    mvp,
  };
}

const rk = (r: number | null) => r ? `#${r}` : "spoza rankingu";

function mvpLine(v: Mvp): string {
  const role = playerRoles[v.name];
  const s = `${v.kills}-${v.deaths}`;
  const r = v.rating.toFixed(2);
  if (v.rating >= 1.4) return rnd([
    `${v.name} rozegrał spotkanie, o którym będzie się mówić jeszcze długo: rating ${r}, ${s} i ADR ${v.adr.toFixed(1)}. Rywale po prostu nie mieli na niego odpowiedzi.`,
    `Na serwerze był jeden człowiek ponad wszystkimi — ${v.name} (${v.team}). ${s}, rating ${r}. Takie liczby zostają w pamięci.`,
    `Gdyby ktoś szukał definicji „carry”, wystarczy pokazać mu ${v.name}: ${r} ratingu i ${v.adr.toFixed(1)} ADR${role ? ` z pozycji ${role}` : ""}.`,
    `${v.name} w trybie, w którym nie da się go zatrzymać. ${s} i ${r} — to był jego wieczór.`,
  ]);
  if (v.rating >= 1.15) return rnd([
    `Najjaśniejszym punktem był ${v.name} (${v.team}) — rating ${r}, ${s}, ADR ${v.adr.toFixed(1)}.`,
    `Pierwsze skrzypce grał ${v.name}${role ? `, ${role} w barwach ${v.team}` : ""}: ${s} przy ratingu ${r}.`,
    `${v.name} dowiózł to, czego oczekiwano: ${r} ratingu i ${s} na tablicy.`,
    `Statystycznie najlepiej wypadł ${v.name} — ${s}, ${v.adr.toFixed(1)} ADR, ${r}.`,
  ]);
  return rnd([
    `Nikt nie oderwał się od reszty — najwyższy rating (${r}) miał ${v.name}, ale to było zwycięstwo kolektywu.`,
    `Bez wielkich indywidualnych fajerwerków: ${v.name} z ratingiem ${r} był najlepszy w zespole, który wygrał przede wszystkim drużynowo.`,
    `Rating ${r} ${v.name} nie powala, ale tego dnia wystarczyła równa gra całej piątki.`,
  ]);
}

export function writeMatchReport(f: MatchFacts, tournament: string, tier: string, isFinal: boolean) {
  const { w, l, ws, ls, m } = f;
  const sc = `${ws}:${ls}`;
  const round = m.round ? ` (${m.round})` : "";

  let titles: string[];
  if (isFinal) titles = [
    `${w} mistrzem ${tournament}!`, `Puchar ${tournament} jedzie do ${w}`,
    `${w} na szczycie. ${l} pokonane w wielkim finale`, `Złoto dla ${w} — finał ${tournament} rozstrzygnięty ${sc}`,
    f.decider ? `Finał do ostatniej mapy. ${w} wygrywa ${tournament}` : `${w} bez litości w finale ${tournament}`,
  ];
  else if (f.upset) titles = [
    `Sensacja! ${w} (${rk(f.wRank)}) ogrywa ${l}`, `Trzęsienie ziemi w ${tournament}: ${l} pada ${ls}:${ws}`,
    `${w} psuje plany faworyta. ${l} bez odpowiedzi`, `Nikt na to nie stawiał: ${w} lepsze od ${l}`,
  ];
  else if (f.overtime) titles = [
    `Dogrywka, nerwy i ${w} górą nad ${l}`, `${w} – ${l}: thriller z dogrywką w ${tournament}`,
    `Horror do ostatniej rundy. ${w} wygrywa ${sc}`,
  ];
  else if (f.stomp || f.sweep) titles = [
    `${w} rozbija ${l} ${sc}`, `Jednostronne widowisko. ${w} nie zostawia złudzeń`,
    `${l} rozjechane — ${w} pewne jak w zegarku`, `Pokaz siły ${w} w ${tournament}`,
  ];
  else titles = [
    `${w} ogrywa ${l} ${sc}`, `${w} lepsze od ${l} w ${tournament}`, `${l} bez odpowiedzi na ${w}`,
    `${w} zgarnia ważne zwycięstwo nad ${l}`,
  ];
  if (f.mvp && f.mvp.rating >= 1.45 && chance(0.35)) titles = [`${f.mvp.name} niszczy ${f.mvp.team === w ? l : w}. ${w} wygrywa ${sc}`, `Show ${f.mvp.name} w meczu ${w} – ${l}`];

  const leads: string[] = [];
  if (f.upset) leads.push(
    `Mało kto dawał ${w} większe szanse, a jednak — drużyna z pozycji ${rk(f.wRank)} pokonała ${l} (${rk(f.lRank)}) ${sc}${round} w ${tournament}.`,
    `Ranking mówił jedno, serwer pokazał drugie. ${w} ograło ${l} ${sc}${round} i namieszało w ${tournament} [Tier ${tier}].`,
  );
  if (f.overtime) leads.push(
    `Takie mecze pamięta się latami. ${w} i ${l} poszli na noże${f.closestMap ? `, a ${f.closestMap.map} skończył się dopiero po dogrywce (${f.closestMap.a}:${f.closestMap.b})` : ""}. Ostatecznie ${sc} dla ${w}.`,
  );
  if (f.stomp || f.sweep) leads.push(
    `${w} przyszło, zobaczyło, zwyciężyło. ${sc} z ${l}${round} — i ani przez moment nie było wątpliwości, kto rozdaje karty.`,
    `Jednostronnie. ${w} rozprawiło się z ${l} ${sc}${round}, kontrolując wydarzenia od pierwszego pistoletu.`,
  );
  if (f.decider) leads.push(
    `Potrzeba było pełnego dystansu, by wyłonić zwycięzcę. ${w} pokonało ${l} ${sc}${round} po meczu, który zmieniał kierunek kilka razy.`,
  );
  leads.push(
    `${w} pokonało ${l} ${sc}${round} w ramach ${tournament} [Tier ${tier}].`,
    `${sc} — tak zakończyło się starcie ${w} z ${l}${round} w ${tournament}.`,
    `W ${tournament} ${w} odhacza kolejne zwycięstwo: ${l} pokonane ${sc}${round}.`,
  );

  const mapsLine = f.mapsTxt ? rnd([
    `Wyniki map: ${f.mapsTxt}.`, `Na tablicy: ${f.mapsTxt}.`, `Mapa po mapie: ${f.mapsTxt}.`,
    f.closestMap && f.tight ? `Kluczowy był ${f.closestMap.map} (${f.closestMap.a}:${f.closestMap.b}). Pełne wyniki: ${f.mapsTxt}.` : `Rozkład map: ${f.mapsTxt}.`,
  ]) : "";

  const outro = isFinal ? rnd([
    `To zwieńczenie turnieju dla ${w} — trofeum i komplet punktów rankingowych trafia na ich konto.`,
    `${w} podnosi puchar, a ${l} zostaje z gorzkim srebrem i pytaniem, czego zabrakło.`,
    `Szampan dla ${w}. Dla ${l} to wciąż dobry turniej, ale finały się wygrywa, a nie gra.`,
  ]) : rnd([
    `${l} musi szybko wyciągnąć wnioski przed kolejnymi meczami.`,
    `${w} potwierdza formę, a ${l} zostaje z wieloma pytaniami.`,
    `Dla ${w} to paliwo na dalszą część turnieju. ${l} czeka analiza demek.`,
    f.upset ? `Czy to jednorazowy wyskok, czy początek czegoś większego? ${w} ma teraz szansę to udowodnić.` : `${w} jedzie dalej, ${l} zbiera myśli.`,
    `Sztab ${l} będzie miał nad czym siedzieć — błędy z tego meczu trzeba wyeliminować.`,
  ]);

  const body = [rnd(leads), mapsLine, f.mvp ? mvpLine(f.mvp) : "", outro].filter(Boolean);
  // czasem zamień kolejność map/MVP dla innego rytmu
  if (body.length === 4 && chance(0.4)) [body[1], body[2]] = [body[2], body[1]];
  return { title: rnd(titles), content: body.join("\n\n") };
}

export function writeRoundReport(
  facts: MatchFacts[], tournament: string, tier: string, phase: string, label: string, star: Mvp | null,
) {
  const winners = [...new Set(facts.map(f => f.w))];
  const losers = [...new Set(facts.map(f => f.l))];
  const upsets = facts.filter(f => f.upset);
  const ots = facts.filter(f => f.overtime);
  const stomps = facts.filter(f => f.stomp || f.sweep);
  const n = facts.length;
  const mecz = n === 1 ? "mecz" : n < 5 ? "mecze" : "meczów";

  const storyline: "upset" | "ot" | "stomp" | "star" | "plain" =
    upsets.length ? "upset" : ots.length ? "ot" : star && star.rating >= 1.4 ? "star" : stomps.length >= Math.ceil(n / 2) ? "stomp" : "plain";

  const titles: Record<string, string[]> = {
    upset: [
      `Sensacja w ${tournament}! ${upsets[0]?.w} wyrzuca faworyta w ${label}`,
      `${label} w ${tournament}: ${upsets[0]?.l} pada, ranking poszedł do kosza`,
      `Niespodzianki nie zabrakło — znamy rozstrzygnięcia ${label}`,
    ],
    ot: [
      `Dogrywki i nerwy do nocy. Za nami ${label} w ${tournament}`,
      `${label} na granicy zawału — ${ots[0]?.w} rzutem na taśmę`,
      `Thriller za thrillerem. Podsumowanie ${label} ${tournament}`,
    ],
    star: [
      `${star?.name} w trybie bestii. Znamy rozstrzygnięcia ${label}`,
      `${label} pod dyktando ${star?.name}`,
      `${tournament}: ${label} należała do ${star?.name}`,
    ],
    stomp: [
      `Walec przejechał przez ${label}. Faworyci bez straty czasu`,
      `Bez litości: ${joinPl(winners.slice(0, 2))} pewnie w ${label}`,
      `Krótka piłka w ${tournament} — ${label} bez większych emocji`,
    ],
    plain: [
      `${tournament}: podsumowanie — ${label}`, `Za nami ${label} w ${tournament}. Co się wydarzyło?`,
      `${label} rozegrana. Kto zrobił krok naprzód?`, `Raport z ${label} — ${tournament}`,
    ],
  };

  const leads: Record<string, string[]> = {
    upset: [
      `Ranking? W ${phase} ${tournament} [Tier ${tier}] nikt się nim nie przejmował. ${upsets.map(u => `${u.w} (${rk(u.wRank)}) ograło ${u.l} (${rk(u.lRank)}) ${u.ws}:${u.ls}`).join(", ")}.`,
      `Trzęsienie ziemi w ${tournament}. Największym echem odbija się porażka ${upsets[0]?.l} z ${upsets[0]?.w} — mało kto zakładał taki scenariusz przed ${phase}.`,
    ],
    ot: [
      `${phase} w ${tournament} dostarczyła wszystkiego, czego kibic może chcieć: ${n} ${mecz}, ${ots.length === 1 ? "jedna dogrywka" : `${ots.length} spotkania z dogrywką`} i masa nerwów.`,
      `Kto szedł spać wcześnie, ten żałuje. ${phase} w ${tournament} [Tier ${tier}] przeciągała się do ostatnich rund${ots[0]?.closestMap ? ` — choćby ${ots[0].closestMap.map} w meczu ${ots[0].w} z ${ots[0].l} (${ots[0].closestMap.a}:${ots[0].closestMap.b})` : ""}.`,
    ],
    star: [
      `Można by pisać o wynikach, ale ${phase} w ${tournament} miała jednego bohatera — ${star?.name}.`,
      `${n} ${mecz}, jedno nazwisko na ustach wszystkich. ${phase} w ${tournament} [Tier ${tier}] to popis ${star?.name}.`,
    ],
    stomp: [
      `Bez niespodzianek i bez litości. ${phase} w ${tournament} [Tier ${tier}] przebiegła pod dyktando faworytów — ${stomps.length} z ${n} ${mecz} były jednostronne.`,
      `Jeśli ktoś liczył na emocje w ${phase} ${tournament}, mógł się rozczarować. Lepsze ekipy szybko załatwiały sprawę.`,
    ],
    plain: [
      `Za nami ${phase} w ${tournament} [Tier ${tier}]. Rozegrano ${n} ${mecz}.`,
      `${phase} w ${tournament} zamknięta — ${n} ${mecz} i kilka wniosków na przyszłość.`,
      `Kolejny etap ${tournament} [Tier ${tier}] przeszedł do historii. Oto, co pokazała ${phase}.`,
    ],
  };

  const bulletStyle = rnd(["•", "—", "▸", "num"]);
  const resultLines = shuffle(facts).map((f, i) => {
    const pre = bulletStyle === "num" ? `${i + 1}.` : bulletStyle;
    const tag = f.upset ? " — niespodzianka" : f.overtime ? " — z dogrywką" : f.sweep && chance(0.5) ? " — pewnie" : "";
    return `${pre} ${f.w} ${f.ws}:${f.ls} ${f.l}${f.mapsTxt ? ` (${f.mapsTxt})` : ""}${tag}`;
  });
  const resultsBlock = rnd([
    resultLines.join("\n"),
    `${rnd(["Wyniki:", "Komplet rozstrzygnięć:", "Tablica wyników:", "Jak to wyglądało:"])}\n${resultLines.join("\n")}`,
  ]);

  // narracyjny akapit o najciekawszym meczu
  const featured = upsets[0] || ots[0] || [...facts].sort((a, b) => (a.ws - a.ls) - (b.ws - b.ls))[0];
  const featuredLine = featured && n > 1 && chance(0.75) ? rnd([
    `Mecz etapu? Zdecydowanie ${featured.w} – ${featured.l}${featured.closestMap ? `, gdzie ${featured.closestMap.map} (${featured.closestMap.a}:${featured.closestMap.b}) trzymał w napięciu do końca` : ""}.`,
    `Najwięcej emocji dostarczyło starcie ${featured.w} z ${featured.l} — ${featured.ws}:${featured.ls}${featured.decider ? " po pełnym dystansie" : ""}.`,
    `Jeśli macie czas tylko na jedno VOD, wybierzcie ${featured.w} vs ${featured.l}.`,
  ]) : "";

  const starLine = star ? mvpLine(star) : "";

  const outro = rnd([
    `Dalej idą: ${joinPl(winners)}. Czas na kolejny etap rywalizacji.`,
    `${joinPl(winners)} z uśmiechem patrzą w przyszłość. ${losers.length ? `${joinPl(losers.slice(0, 3))} muszą przełknąć gorycz.` : ""}`,
    `Zwycięzcy: ${joinPl(winners)}. Następna faza zapowiada się jeszcze ciekawiej.`,
    `Bilans dnia: ${winners.length} ${winners.length === 1 ? "zwycięzca" : "zwycięzców"}, ${losers.length} ${losers.length === 1 ? "przegrany" : "przegranych"} i sporo materiału do analizy.`,
  ]).trim();

  const middle = shuffle([resultsBlock, featuredLine, starLine].filter(Boolean));
  // wyniki zwykle wcześnie — nie ostatnie
  const resIdx = middle.indexOf(resultsBlock);
  if (resIdx > 0 && chance(0.6)) { middle.splice(resIdx, 1); middle.unshift(resultsBlock); }

  return {
    title: rnd(titles[storyline]),
    content: [rnd(leads[storyline]), ...middle, outro].join("\n\n"),
    winners,
  };
}

export function writeTransfer(player: string, fromTeam: string, toTeam: string) {
  const role = playerRoles[player];
  const hasFrom = fromTeam && fromTeam !== "-";
  const toRank = rankOf(toTeam), fromRank = hasFrom ? rankOf(fromTeam) : null;
  const stepUp = toRank != null && fromRank != null && toRank < fromRank;
  const title = hasFrom ? rnd([
    `${player} przechodzi z ${fromTeam} do ${toTeam}`, `Oficjalnie: ${player} w ${toTeam}`,
    `${toTeam} wyciąga ${player} z ${fromTeam}`, stepUp ? `Krok w górę dla ${player} — witaj w ${toTeam}` : `${player} zmienia barwy. Nowy rozdział w ${toTeam}`,
  ]) : rnd([`${toTeam} ogłasza ${player}`, `${player} znalazł nowy dom: ${toTeam}`, `Koniec bezrobocia — ${player} w ${toTeam}`]);
  const lead = hasFrom ? rnd([
    `Oficjalnie: ${player}${role ? ` (${role})` : ""} opuszcza ${fromTeam} i dołącza do ${toTeam}.`,
    `Plotki się potwierdziły. ${player} zakłada koszulkę ${toTeam}, kończąc przygodę z ${fromTeam}.`,
    `${toTeam} (${rk(toRank)}) dopina transfer — ${player}${role ? `, ${role}` : ""} przychodzi z ${fromTeam} (${rk(fromRank)}).`,
  ]) : rnd([
    `${toTeam} sięga po ${player}${role ? `, który w nowej ekipie ma pełnić rolę ${role}` : ""}.`,
    `Wolny agent nie pozostał wolny długo. ${player} oficjalnie w ${toTeam}.`,
  ]);
  const quote = rnd([
    `„Cieszę się z nowego wyzwania. ${toTeam} ma ambicje, które pokrywają się z moimi — chcemy walczyć o trofea” — mówi ${player}.`,
    `„Rozmowy trwały krótko. Od razu wiedziałem, że to właściwe miejsce” — przyznaje ${player}.`,
    `„Chcę udowodnić, że stać mnie na więcej” — zapowiada ${player}.`,
    hasFrom ? `„Dziękuję ${fromTeam} za wszystko, ale czas na nowy rozdział” — napisał ${player} w mediach społecznościowych.` : `„Nie mogłem się doczekać powrotu do grania” — mówi ${player}.`,
  ]);
  const analysis = rnd([
    `Organizacja liczy, że transfer wzmocni skład przed nadchodzącymi turniejami.`,
    stepUp ? `Dla zawodnika to wyraźny awans — ${toTeam} stoi w rankingu wyżej niż jego dotychczasowy klub.` : `Ruch ciekawy taktycznie: ${toTeam} zyskuje nowe opcje${role ? ` na pozycji ${role}` : ""}.`,
    `Pierwszy sprawdzian już w najbliższym turnieju — wtedy okaże się, czy chemia w składzie zaskoczy.`,
  ]);
  const body = chance(0.5) ? [lead, quote, analysis] : [lead, analysis, quote];
  return { title, content: body.join("\n\n") };
}

export function writeBench(player: string, team: string) {
  return {
    title: rnd([`${player} przesunięty na ławkę ${team}`, `${team} odsuwa ${player} od składu`, `Koniec drogi? ${player} na ławce ${team}`, `Zmiany w ${team}: ${player} poza piątką`]),
    content: [
      rnd([
        `${team} poinformowało, że ${player} zostaje przesunięty do rezerwy i nie zagra w najbliższych turniejach.`,
        `W ${team} zapadła trudna decyzja — ${player} traci miejsce w podstawowym składzie.`,
        `Wyniki nie broniły nikogo. ${team} zaczyna przebudowę od odsunięcia ${player}.`,
      ]),
      rnd([
        `„To była trudna decyzja. Dziękujemy ${player} za dotychczasową pracę i będziemy wspierać go w dalszych krokach” — przekazała organizacja.`,
        `„Potrzebowaliśmy świeżej energii” — miał powiedzieć trener zespołu.`,
        `Sam zawodnik na razie milczy, ale źródła bliskie drużynie mówią o rozczarowaniu.`,
      ]),
      rnd([
        `Zawodnik może szukać nowego klubu. Nazwisko zastępcy ma zostać ogłoszone wkrótce.`,
        `Kto zajmie jego miejsce? Na razie ${team} nie zdradza kart.`,
        `Rynek transferowy na pewno się nim zainteresuje — pytanie, kto pierwszy złoży ofertę.`,
      ]),
    ].join("\n\n"),
  };
}

export function writeRanking(team: string, rank: number, points: number) {
  const p = Math.round(points);
  return {
    title: rnd([`${team} na #${rank} w rankingu ACSR`, `#${rank}: gdzie naprawdę jest ${team}?`, `${team} i miejsce #${rank} — co dalej?`]),
    content: [
      rnd([
        `${team} zajmuje obecnie ${rank}. miejsce w światowym rankingu ACSR z dorobkiem ${p} pkt.`,
        `${p} punktów i pozycja #${rank} — tak wygląda dziś ${team} w zestawieniu ACSR.`,
        `Ranking ACSR nie kłamie: ${team} jest ${rank}. na świecie (${p} pkt).`,
      ]),
      rank <= 5 ? rnd([
        `To pozycja ścisłej czołówki — od nich oczekuje się walki o każde trofeum.`,
        `Z tego miejsca nie ma wymówek. Każdy turniej bez finału to rozczarowanie.`,
      ]) : rank <= 20 ? rnd([
        `Drużyna puka do czołówki i każdy kolejny turniej może ją przybliżyć do Top 5.`,
        `Do elity brakuje niewiele — jeden mocny event i ${team} może zrobić duży skok.`,
      ]) : rnd([
        `Ekipa wciąż buduje pozycję i szuka przełomowego wyniku.`,
        `Droga do góry jest długa, ale ${team} ma czas i miejsce, by się rozwinąć.`,
      ]),
    ].join("\n\n"),
  };
}
