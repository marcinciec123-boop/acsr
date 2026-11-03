# Przygotowanie aplikacji pod 5+ lat danych

Cel: aplikacja (.exe) ma działać płynnie przy tysiącach turniejów, dziesiątkach tysięcy meczów i wieloletniej historii rankingu, bez utraty jakichkolwiek starych danych.

## Etapy (wdrażane po kolei, każdy osobno sprawdzany)

### 1. Zapis na dysku zamiast pamięci przeglądarki
- W wersji .exe dane zapisu trafiają do plików w folderze aplikacji (AppData), każdy klucz w osobnym pliku, zapis atomowy (plik tymczasowy → podmiana).
- Przy pierwszym uruchomieniu automatyczna, jednorazowa migracja obecnych danych do plików; stare dane zostają jako kopia do czasu potwierdzenia.
- W podglądzie w przeglądarce działa dotychczasowy mechanizm (bez zmian dla Ciebie przy testach).
- Zapisy łączone (debounce), żeby kliknięcia nie powodowały ciągłego przepisywania dużych plików.

### 2. Archiwum zakończonych sezonów
- Turnieje z zamkniętych lat trafiają do osobnych plików archiwum (np. `archive/2025.json.gz`), ładowanych dopiero gdy są potrzebne.
- Dane bieżącego sezonu pozostają „gorące” i szybkie.
- Nic nie jest kasowane ani przeliczane wstecz — tylko przenoszone do tylko-odczytu.

### 3. Indeksy statystyk (szybkie profile)
- Gotowe podsumowania kariery graczy, dorobku drużyn i trofeów aktualizowane po każdym zakończonym meczu/turnieju, zamiast liczenia od zera przy każdym otwarciu profilu.
- Pełne przeliczenie indeksu możliwe przyciskiem (na wypadek niespójności) — wynik musi być identyczny z obecnym.

### 4. Ciężkie obliczenia w tle
- Ranking VRS, statystyki portalu, finanse i rekordy liczone w osobnym wątku (Web Worker), więc interfejs nie przycina się przy dużych zapisach.

### 5. Wirtualizacja długich list
- Ranking, lista graczy, wolni agenci, historia transferów, lista turniejów, historia meczów, change log — renderowane są tylko widoczne wiersze.

### 6. Filtr sezonu
- Selektor roku (domyślnie bieżący sezon, opcja „Wszystkie lata”) w statystykach, turniejach i historii — mniej danych na ekranie, szybsze widoki.

### 7. Historia rankingu
- Wykresy historii punktów/miejsc: dzienne migawki starsze niż rok przechowywane w archiwum, wykresy dalekiego okresu zagęszczają punkty (np. tygodniowo), bliski okres zostaje dzienny. Surowe dane zostają w całości.

## Kopie zapasowe
- Eksport/import .csgobackup obejmuje archiwa — kopia zawsze zawiera pełną historię.

## Sprawdzanie
- Wygenerowany testowy zapis „5 lat” (sztuczne turnieje) do pomiaru czasu otwierania profili, rankingu i statystyk przed i po.
- Testy: zgodność indeksów z pełnym przeliczeniem, poprawność migracji i archiwizacji (brak utraty danych).

## Szczegóły techniczne
- Tauri: dodanie `tauri-plugin-fs` (wersja npm zgodna major/minor z crate w Cargo.lock), uprawnienia w `capabilities` ograniczone do `$APPDATA`.
- `storage.ts` dostaje adapter: `TauriFileBackend` (gdy `window.__TAURI_INTERNALS__`) / dotychczasowy localStorage+IndexedDB; synchroniczne odczyty przez cache w pamięci ładowany przy starcie (splash).
- Archiwum: gzip przez istniejący kodek z `deviceBackup.ts`; `loadArchivedTournaments(year)` z leniwym ładowaniem; `memoOnSave` rozszerzony o wersję archiwum.
- Indeksy: `careerIndex.ts` z inkrementalną aktualizacją po zdarzeniu `tournaments:update` + test równoważności z `playerCareerStats`.
- Worker: Vite `?worker`, komunikacja przez Comlink-podobny prosty RPC.
- Wirtualizacja: `@tanstack/react-virtual`.
- Rekordy decyzji dopisane do `AGENTS.md`.
