# Roadmap

## Bieżące poprawki
- [ ] Audyt — punkt 2: zachować wyróżnienia po zmianach nazw klubów i wielkości liter nicków.
- [ ] Audyt — punkt 3: połączyć zarobki i trofea jednej organizacji pod jej obecną nazwą.
- [ ] Audyt — punkt 4: rozpoznawać i obsługiwać ławkę pod dawnymi i obecnymi nazwami klubu.
- [x] Punkt 4: zachować loga turniejów w pamięci urządzenia podczas przywracania kopii i odświeżyć ich grafikę.
- [x] Punkt 3: nie naliczać odstępnego między dawną i obecną nazwą tej samej organizacji.
- [x] Punkt 2: „Cofnij” przywraca kontrakty, ławkę i jej historię oraz dane finansowe; stare migawki nie usuwają brakujących danych.
- [x] Punkt 1: przy rozwiązaniu drużyny uwolnić skład, rezerwowych i trenera, zamknąć kontrakty i zachować narodowości (także przy ręcznym bankructwie).

- [x] Przebudować układ głównego lower bracketu według rzeczywistych połączeń meczów.
- [x] Ujednolicić mniejsze drabinki grupowe i dodać czytelne łączniki.
- [x] Sprawdzić kompilację i testy turniejowe.

- [x] Naprawić build Tauri na GitHub Actions (yankowane `zip` → patch na 2.2.2 z gita + zatwierdzony Cargo.lock).
- [x] Zablokować wersje wtyczek npm (`@tauri-apps/plugin-updater` ~2.7.0, `plugin-process` ~2.4.0) tak, by odpowiadały Cargo.lock.

## Przed finalnym buildem
- [x] Kafelek „Najbliższy koniec kontraktu” w profilu drużyny pomijał zakończone i przeterminowane umowy — naprawione (helper `getNextContractExpiry` + testy).
- [ ] „Sloty zapisu” w Ustawieniach zapisują tylko turnieje — podpiąć pod pełny backup 1:1 (deviceBackup).

## Pomysły na później (od Marcina)
- [ ] Intel Grand Slam / żetony Majora, relacja z rund meczu, plotki transferowe (finanse zrobione), grafiki meczu/MVP do udostępniania
