import { toast } from "sonner";

const isDesktop = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Desktop only: downloads a new release in the background, then offers a restart. */
export const checkForDesktopUpdate = async (): Promise<void> => {
  if (!isDesktop()) return;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return;
    await update.download();
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
  } catch (error) {
    console.error("Desktop update check failed:", error);
  }
};

export const installDesktopUpdater = () => {
  if (!isDesktop()) return;
  void checkForDesktopUpdate();
  window.setInterval(() => void checkForDesktopUpdate(), 60 * 60 * 1000);
};
