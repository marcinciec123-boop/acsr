import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { checkForDesktopUpdate, isDesktop, lastUpdateError } from "@/lib/desktopUpdater";

const MESSAGES = {
  "up-to-date": "Masz najnowszą wersję.",
  ready: "Nowa wersja pobrana — kliknij „Uruchom ponownie” w powiadomieniu.",
  error: "Nie udało się sprawdzić aktualizacji. Sprawdź internet.",
  "not-desktop": "",
} as const;

const DesktopUpdateCard = () => {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  if (!isDesktop()) return null;

  const run = async () => {
    setBusy(true);
    setStatus("");
    const result = await checkForDesktopUpdate();
    if (result === "error") {
      const e = lastUpdateError.toLowerCase();
      const hint = e.includes("404") || e.includes("not found") || e.includes("status")
        ? "Nie znaleziono pliku aktualizacji na GitHubie (repozytorium prywatne lub brak wydania)."
        : e.includes("signature")
        ? "Błędny podpis aktualizacji (klucz nie pasuje)."
        : "Nie udało się sprawdzić aktualizacji.";
      setStatus(`${hint} Szczegóły: ${lastUpdateError || "brak"}`);
    } else setStatus(MESSAGES[result]);
    setBusy(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-heading text-lg font-bold text-foreground">Aktualizacje aplikacji</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Aplikacja sprawdza aktualizacje przy starcie i co 15 minut.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={run}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {busy ? "Sprawdzam…" : "Sprawdź aktualizacje teraz"}
        </button>
        {status && <span className="text-sm text-muted-foreground">{status}</span>}
      </div>
    </div>
  );
};

export default DesktopUpdateCard;
