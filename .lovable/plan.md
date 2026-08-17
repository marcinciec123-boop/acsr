# Naprawa historycznego rankingu i zmian nazw

## Zakres
- Ujednolicić tożsamość drużyny niezależnie od kolejnych zmian nazwy, bez dublowania starych i nowych nazw w jednej migawce.
- Zachować nazwę obowiązującą w wybranym dniu: stara przed zmianą, nowa od dnia zmiany.
- Naprawić odtwarzanie punktów historycznych, aby nie mieszało syntetycznej rekonstrukcji z późniejszymi pełnymi migawkami.
- Oczyścić istniejące zapisane migawki z duplikatów i błędnych kluczy podczas ładowania/synchronizacji.

## Implementacja
- Zbudować deterministyczny łańcuch aliasów oparty o daty, odporny na wielokrotne zmiany nazwy i duplikaty zdarzeń.
- Normalizować każdą migawkę do aktualnej, kanonicznej tożsamości; przy kolizji nie sumować punktów, tylko wybrać właściwy wpis dla daty migawki.
- Rozdzielić pełne migawki rzeczywiste od rekonstrukcji turniejowej: pełna migawka staje się punktem kontrolnym, a rekonstrukcja nie nadpisuje jej stanem z innej osi czasu.
- Zapisywać nowe migawki wyłącznie pod kanonicznymi identyfikatorami, a historyczną nazwę nakładać dopiero przy wyświetlaniu.
- Dodać migrację istniejącej historii i testy regresyjne dla zmiany nazwy, łańcucha zmian i rankingu przed/po zmianie.

## Weryfikacja
- Sprawdzić brak duplikatów dla każdej daty.
- Sprawdzić zgodność bieżącego końca historii z aktualnym rankingiem.
- Sprawdzić nazwę i punkty tej samej drużyny dzień przed, w dniu i dzień po zmianie.
