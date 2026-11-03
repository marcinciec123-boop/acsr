# Duży audyt kodu i poszukiwanie błędów

Na start: w aplikacji nie ma teraz żadnych zgłoszonych błędów ani awarii. Audyt ma znaleźć ukryte problemy, zanim się pokażą.

## Co sprawdzę (po kolei)

1. **Bezpieczeństwo danych zapisu**: zapis na dysk w .exe, kopie zapasowe, import/eksport, przywracanie zdjęć. Szukam miejsc, gdzie dane mogą się nadpisać albo zgubić.
2. **Turnieje i drabinki**: dodawanie i przesuwanie rund, deciderów, meczu o 3. miejsce, łączenia grup, automatycznego przechodzenia zwycięzców i zamrożonych składów.
3. **Wyniki i statystyki**: Bo1/Bo3/Bo5, mapy nierozegrane, statystyki graczy i drużyn, nagrody i zarobki po zmianie nazwy drużyny.
4. **Ranking**: przeliczanie punktów, historia, wykresy, tiery i kwalifikacje.
5. **Transfery, ławka i finanse**: kontrakty, rozwiązywanie drużyn, cofanie zmian.
6. **Ekrany**: przejście przez główne zakładki w przeglądarce (komputer i telefon). Sprawdzę błędy, puste stany i rozjechany wygląd.
7. **Jakość kodu**: sprawdzenie typów, nieużywany lub zduplikowany kod, wolne fragmenty przy dużej ilości danych.

## Jak to zrobię

- Kilku równoległych pomocników przeszuka po jednym obszarze i każdy zwróci listę podejrzanych miejsc z dowodem.
- Każde zgłoszenie potwierdzę sam: przez test albo odtworzenie w aplikacji. Do raportu trafi tylko to, co się potwierdzi.
- Proste i bezpieczne błędy naprawię od razu. Do każdego dopiszę test, żeby błąd nie wrócił.
- Zmiany, które ruszają historyczne wyniki, ranking albo zachowanie gry, najpierw opiszę i zapytam o zgodę.

## Wynik

Krótki raport po polsku w trzech grupach: naprawione, do decyzji, drobne uwagi. Na koniec wszystkie testy muszą przechodzić.

## Szczegóły techniczne

- Typy sprawdzę przez tsgo, a cały zestaw testów przez vitest.
- Sprawdzę kod Tauri/Rust: zapis atomowy i obsługę błędów w poleceniach store_* oraz media_*.
- Przejrzę wywołania normalizeStoredData, mergeGroupPhases, seederów i normalizacji grup GSL pod kątem nadpisywania danych.
- Zrobię przegląd React: zależności hooków, brakujące klucze, zbędne przeliczenia.
