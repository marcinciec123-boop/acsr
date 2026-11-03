# Pełne oddzielenie drużyn narodowych od klubów

Zasada: reprezentacja to reprezentacja. Nie wpływa na transfery, ranking VRS, finanse, kontrakty, ławkę, nagrody klubowe ani rekordy, a one nie wpływają na nią. Statystyki graczy z meczów reprezentacji nadal liczą się razem z klubowymi, tak jak teraz. Datę w grze zmieniasz sam, więc mecze reprezentacji jej nie przesuwają.

## Co jest już dobrze
Tabela rankingu, historia rankingu, raport tygodniowy, wybór drużyn do zwykłych turniejów, kontrakty, wolni agenci, obecny klub gracza i newsy pomijają już reprezentacje. Wyniki turnieju reprezentacji nie dają punktów rankingowych.

## Co naprawię

1. **Jedno rozpoznawanie reprezentacji w całej aplikacji.** Dziś różne miejsca rozpoznają reprezentację na różne sposoby. Po zmianie jej nazwy albo usunięciu stare mecze potrafią „wyciec” do statystyk klubów. Będzie jedna wspólna reguła: drużyna oznaczona jako narodowa albo udział w turnieju typu Mistrzostwa Świata.
2. **Nazwa reprezentacji nie może nadpisać klubu.** Dziś reprezentacja o nazwie istniejącego klubu go podmienia. Teraz pojawi się komunikat i zapis zostanie zablokowany.
3. **Transfery.** Przy wyborze gracza do transferu źródłem jest tylko jego klub, nigdy reprezentacja. Transfer z reprezentacji ani do reprezentacji jest blokowany. Stare, błędne wpisy tego typu znikną z historii transferów i z kariery klubowej gracza. Dane zostają w zapisie, są tylko pomijane.
4. **Ranking VRS.** Reprezentacje nie wchodzą do liczenia miejsc, przewidywań ani zmian punktów, nawet gdyby trafiły do zwykłego turnieju. Mecz reprezentacji nie zapisuje punktów VRS i nie dodaje punktu do historii rankingu.
5. **Finanse.** Reprezentacje nie mają finansów klubowych. Nagrody z ich turniejów nie trafiają do przychodów żadnej organizacji.
6. **Profil reprezentacji.** Pokazuje tylko skład i wyniki. Znikają z niego miejsce w rankingu, punkty, kontrakty, finanse, ławka, podział składu i rozwiązanie drużyny.
7. **Ławka i rozwiązanie.** Reprezentacji nie da się posadzić na ławce ani rozwiązać, także z panelu zarządzania drużynami. Skład reprezentacji nie zależy od ławki klubowej.
8. **Zaproszenia do turniejów.** Podpowiedzi zaproszeń i zastępstw pomijają reprezentacje.
9. **Data w grze.** Wpisanie wyniku meczu ani zatwierdzenie wyników turnieju reprezentacji nie przesuwa daty.
10. **Nagrody roczne, rekordy i statystyki.** Turnieje reprezentacji nie wliczają się do nagród rocznych (MVP, Top 20), rekordów ani podsumowań: liczby turniejów, puli nagród, meczów i map, największych pul.

## Czego nie ruszam
- Statystyki graczy (kariera, rating, mecze, trofea) dalej liczą też mecze reprezentacji.
- Turnieje reprezentacji i ich wyniki zostają w zapisie bez zmian.

## Sprawdzenie
Testy dla każdej reguły: blokada transferu, brak w rankingu VRS, brak w finansach, nadpisanie klubu zablokowane, brak w rekordach i nagrodach, brak zmiany daty. Do tego przejście w aplikacji przez profil reprezentacji i panel transferów.

## Szczegóły techniczne
- Nowy plik `src/lib/nationalIdentity.ts`: `isNationalTeam(name)` łączy flagę `isNational`, kanoniczną nazwę i rejestr nazw zapamiętywany przy tworzeniu reprezentacji. Rejestr przetrwa usunięcie lub zmianę nazwy. Do tego `isInternationalTournament(t)` dla `kind === "worlds"` albo uczestników narodowych.
- Na ten helper przechodzą statsPortal, hotStreaks i recordBook (tu także lista `real` turniejów), a także yearAwards, teamFinances, vrsFormula, rankMap w TournamentPanel, MatchDetailPage (bez zapisu punktów VRS i bez przesuwania daty), inviteSuggestion, benchedPlayers, tournamentLineups, disbandTeam i TeamsManagementPanel.
- `upsertNationalTeams`: odrzuca kolizję z nazwą klubu, a WorldsBuilder pokazuje błąd.
- TransferPanel: `pickerCatalog` tylko z klubów, a przy zapisie odrzuca źródło lub cel narodowy. Filtry w playerTeamHistory i liście transferów w PlayerProfile.
- TeamProfile: osobny widok reprezentacji bez sekcji klubowych.
