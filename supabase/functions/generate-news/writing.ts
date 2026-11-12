const voices = [
  "Redaktor depeszowy: krótkie, ostre zdania, najważniejszy fakt od razu. Bez ozdobników.",
  "Sceptyczny analityk: porównuje liczby, oddziela wynik od interpretacji, podważa łatwe narracje.",
  "Felietonista starej szkoły: sucha ironia, wyraźna teza, krytyka poparta konkretem zamiast obelg.",
  "Reporter meczowy: rytmiczne zdania, wybiera jedną rozegraną mapę lub występ gracza jako oś tekstu.",
  "Młody komentator sceny: bezpośredni, energiczny, zna slang CS-a; żadnego marketingowego pompowania balonika.",
  "Scouter: patrzy na role i indywidualne liczby, precyzyjny, oszczędny w superlatywach.",
];
const angles = [
  "Otwórz najmocniejszą dostępną liczbą, potem wyjaśnij jej znaczenie.",
  "Otwórz kontrastem dwóch dostarczonych faktów, zakończ konkretną obserwacją.",
  "Otwórz krótką tezą opinii; uzasadnij ją faktami i zaznacz granicę tego, co wiadomo.",
  "Otwórz nazwą drużyny lub nickiem i bezpośrednim czasownikiem; zmieniaj długość zdań.",
  "Zacznij od szczegółu mapy lub składu, jeśli jest dostępny; szerszy kontekst daj dopiero potem.",
  "Zbuduj krótki bilans: co wynik potwierdza, a czego jeszcze nie dowodzi. Bez obowiązkowego pytania na końcu.",
];

/** Editorial identity is stable; angle and rhythm vary without a second AI call. */
export function writingBrief(count: number, editorial?: string): string {
  let identity = 0;
  for (const c of editorial?.normalize("NFC").toLowerCase() || "") identity = (Math.imul(identity, 31) + c.charCodeAt(0)) >>> 0;
  const offset = Math.floor(Math.random() * voices.length);
  const angleOffset = Math.floor(Math.random() * angles.length);
  return `PLAN AUTORSKI — zastosuj wewnętrznie, nie drukuj nazw person ani planu:
${Array.from({ length: count }, (_, i) => `Post ${i + 1}: ${voices[((editorial ? identity : offset) + i) % voices.length]} ${angles[(angleOffset + i) % angles.length]}`).join("\n")}
Wybrany przez użytkownika styl, długość, temat i kategoria mają pierwszeństwo nad personą. W newsie nawet ironiczny autor pisze rzeczowo, w FanPage mówi jako kibic. Dobierz kąt do istniejących danych; jeśli brakuje map, nie twórz scen meczowych. Dla jednego wydarzenia zmieniaj perspektywę, nie tylko synonimy. Wybierz kąt niewykorzystany w ostatnich tekstach.`;
}

export const writingExamples = `PRZYKŁADY WARSZTATU (fikcyjne placeholdery, NIE dane do artykułu; nie kopiuj zdań):
Fakty: [A] pokonało [B] 2:0, druga mapa 16:14. Depesza: „[A] zamyka serię w dwóch mapach. 16:14 na drugiej nie wygląda jednak jak spacer — [B] było o dwie rundy od przedłużenia meczu.”
Fakty: [gracz] 1.31 ratingu, drużyna przegrała. Analiza: „1.31 i porażka. Liczby [gracza] nie wystarczyły do wygrania serii; dobry indywidualny występ i dobry wynik zespołu to tutaj dwie różne historie.”
Fakty: [A] #4 rankingu, [B] #19, mecz przed startem. Felieton: „Ranking daje [A] wygodną rolę faworyta. Piętnaście pozycji przewagi to argument przed meczem, nie wynik na serwerze.”
Fakty: [A] wygrało 2:1. FanPage: „No i to jest wynik, kurwa. 2:1 dla [A] — dzisiaj świętuję, ale nie będę po jednej serii ogłaszał nowej ery.”
Przykłady pokazują selekcję faktu, rytm i głos. Każdy nowy tekst ma własne otwarcie oraz zakończenie, nie powiela tych konstrukcji.`;