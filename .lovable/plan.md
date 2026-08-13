# Plan napraw paneli, transferów i wydajności

## Zakres

1. **Domyślny widok graczy**
   - Ustawić startowo filtr „Z drużyną”.
   - Ukrywać trenerów w tym widoku; pokazywać ich dopiero po wybraniu filtra trenerów.
   - Wolnych agentów pokazywać dopiero po wybraniu filtra FA.
   - Zachować pozostałe filtry, wyszukiwanie i edycję zawodników.

2. **Prawidłowa chronologia meczów**
   - Dodać jeden wspólny sposób wyznaczania czasu meczu: najpierw zaplanowana data i godzina, potem faktyczny czas rozegrania, na końcu data turnieju.
   - Sortować tym pełnym znacznikiem czasu malejąco w profilach drużyn i graczy, z deterministycznym rozstrzyganiem remisów.
   - Wyświetlać również godzinę w ostatnich meczach gracza, żeby kolejność była widoczna i możliwa do sprawdzenia.

3. **Automatyczna ławka przy transferze**
   - Przed dołączeniem zawodnika sprawdzić aktywny skład docelowej drużyny.
   - Jeżeli drużyna ma już pięciu aktywnych graczy, nowy szósty zawodnik zostanie automatycznie zapisany na ławce z datą transferu.
   - Nie stosować tej reguły do trenerów; zachować spójność rankingu, rosterów, historii i logu ławki.

4. **Przywrócenie rozstawiania drabinek**
   - Udostępnić panel „Rozstaw drużyny” dla wszystkich faz drabinkowych, nie tylko Swiss.
   - Wyliczać liczbę slotów z pierwszej rundy i po zapisie przebudowywać wyłącznie jej obsadę oraz zerować jej wyniki.
   - Zachować osobne narzędzie przypisywania drużyn dla faz grupowych GSL/IEM/round-robin.

5. **Optymalizacja responsywności i ładowania**
   - Ładować ciężkie panele aplikacji dopiero po wejściu w daną zakładkę zamiast dołączać je wszystkie do pierwszego pakietu.
   - Uruchamiać niekrytyczną synchronizację historii i automatyczny backup po pierwszym renderze/bez blokowania startu aplikacji.
   - Ograniczyć wielokrotne, równoważne zdarzenia aktualizacji, które obecnie wywołują te same kosztowne przeliczenia kilka razy po jednym kliknięciu.
   - Zachować cache statystyk i unieważniać go tylko przy zmianach danych meczowych/rosterów.

## Weryfikacja

- Sprawdzić domyślny i przełączany widok panelu graczy.
- Sprawdzić kolejność dwóch meczów tego samego dnia (np. 18:00 przed 11:00) w profilu drużyny i gracza.
- Wykonać transfer szóstego zawodnika i potwierdzić automatyczną ławkę oraz historię.
- Sprawdzić rozstawianie w Swiss, single elimination i double elimination oraz brak regresji w grupach.
- Uruchomić testy i kontrolę działania aplikacji po zmianach.
