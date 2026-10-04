import { toast } from "sonner";

export const isDesktop = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type UpdateCheckResult = "not-desktop" | "up-to-date" | "ready" | "error";

let pendingVersion: string | null = null;

/** Desktop only: downloads a new release in the background, then offers a restart. */
export const checkForDesktopUpdate = async (): Promise<UpdateCheckResult> => {
  if (!isDesktop()) return "not-desktop";
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return "up-to-date";
    if (pendingVersion === update.version) return "ready";
    await update.download();
    pendingVersion = update.version;
    toast(`Nowa wersja ${update.version} jest gotowa`, {
      description: "Uruchom ponownie, aby zainstalować aktualizację.",
      duration: Infinity,
      action: {
        label: "Uruchom ponownie",
        onClick: async () => {
          await update.install();
          const { relaunch } = await import("@tauri-apps/plugin-process");
          await relaunch();
        },
      },
    });
    return "ready";
  } catch (error) {
    console.error("Desktop update check failed:", error);
    return "error";
  }
};

export const installDesktopUpdater = () => {
  if (!isDesktop()) return;
  void checkForDesktopUpdate();
  window.setInterval(() => void checkForDesktopUpdate(), 15 * 60 * 1000);
};
