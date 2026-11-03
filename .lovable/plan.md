# Powrót do poprzedniego widoku

## Co się zmieni
- Aplikacja zapamięta kolejne przejścia między panelami, turniejami, meczami oraz profilami graczy i drużyn.
- Przycisk powrotu cofnie o jeden rzeczywisty krok, zamiast zawsze kierować do listy turniejów.
- Przykład: **Księga Rekordów → mecz → profil gracza → Wstecz → mecz → Wstecz → Księga Rekordów**.
- Dodamy niewielką strzałkę „Wstecz” dostępną również po przejściu między głównymi panelami. Obecne przyciski powrotu będą korzystać z tej samej historii.
- Powrót zachowa wybraną zakładkę panelu, istniejące filtry i pozycję przewinięcia. Stan listy turniejów nie zniknie przy otwieraniu szczegółów.
- Historia będzie dotyczyć bieżącej sesji aplikacji, również w wersji .exe; nie będzie częścią zapisu rozgrywki.

## Szczegóły techniczne
- Wspólna historia nawigacji w głównym widoku, obejmująca panel, stos profili oraz identyfikatory turnieju i meczu.
- Ujednolicenie nawigacji przez łącza i zwykłe otwieranie szczegółów; powrót odtwarza poprzedni stan bez dopisywania nowego kroku.
- Pozostawienie odwiedzonych paneli i listy turniejów zamontowanych, by zachować ich ustawienia; historia przechowuje tylko małe identyfikatory, nigdy kopie danych turniejowych ani zdjęć.
- Bez zmian wyników, statystyk, rankingu ani danych rozgrywki.

## Sprawdzenie
- Testy historii dla przejść Rekordy → turniej, Rekordy → mecz oraz turniej → profil → inny turniej.
- Sprawdzenie w aplikacji powrotów krok po kroku, zachowania zakładki Rekordy i filtrów listy oraz zwykłego otwierania turniejów z kalendarza.
