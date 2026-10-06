# Spójna drabinka Lower Bracket

## Cel
Przebudować układ dolnej drabinki tak, aby mecze zawsze tworzyły czytelne rundy, były równo ustawione i pozostawały połączone także przy nieregularnej liczbie spotkań lub pustych slotach.

## Zakres
- Zastąpić pozycjonowanie oparte wyłącznie na numerze rundy układem wyliczanym z faktycznych przejść `winnerTo` i `loserTo`.
- Wyznaczać pionowe środki meczów na wspólnej siatce; pojedynczy mecz następnej rundy ustawić pomiędzy meczami, które do niego prowadzą.
- Zachować stabilne puste miejsca po usunięciu meczu i sensownie rozłożyć rundy bez pełnej pary poprzedników.
- Narysować ciągłe, ortogonalne łączniki pomiędzy konkretnymi kartami zamiast generować je z założenia „zawsze 2 → 1”.
- Zastosować ten sam mechanizm dla głównego Double Elimination oraz mniejszych drabinek grupowych, bez zmiany zasad awansu i wyników.
- Uporządkować nagłówki, odstępy i przewijanie, zachowując obecny ciemny styl aplikacji.

## Weryfikacja
- Sprawdzić poprawność kompilacji i testów dotyczących turniejów.
- Zweryfikować w kodzie przypadki 2→2, 2→1 oraz nieregularne rundy 3→2→1, bez uruchamiania podglądu wizualnego.
