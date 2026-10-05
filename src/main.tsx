import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { bootstrapPersistedState } from "./lib/changeLog";
import { scheduleDeviceBackup, restoreLatestDeviceBackupIfLocalStateMissing } from "./lib/deviceBackup";
import { initializeDeviceStoreCache } from "./lib/deviceStore";
import { migrateHeavyLocalStorageToDeviceStore } from "./lib/storage";
import { initTheme } from "./lib/theme";
import { initFont } from "./lib/font";
import { installWeeklyRankingReports } from "./lib/weeklyRankingReport";
import { installDailyRankingSnapshots, installRankingHistoryAutoSync, synchronizeRankingHistory } from "./lib/rankingHistory";
import { cleanupSwissSkeletons } from "./lib/swissSkeletonCleanup";
import { fixHistoricalMatchDates } from "./lib/historicalMatchDates";
import { seedMissingContracts } from "./lib/contracts";
import { installContractExpiryWatcher, releaseExpiredContracts } from "./lib/contractExpiry";
import { seedYearAwards2025 } from "./lib/yearAwards2025Seed";

initTheme();
initFont();

const startApp = async () => {
  await initializeDeviceStoreCache();
  await restoreLatestDeviceBackupIfLocalStateMissing().catch(error => {
    console.error("Device backup restore failed:", error);
    return false;
  });

  // Restore custom transfers, roster mutations, and per-player overrides
  // from localStorage before the React tree mounts.
  bootstrapPersistedState();
  installRankingHistoryAutoSync();
  installDailyRankingSnapshots();
  installWeeklyRankingReports();

  try { fixHistoricalMatchDates(); } catch (e) { console.error("Historical match date fix failed:", e); }
  try { cleanupSwissSkeletons(); } catch (e) { console.error("Swiss skeleton cleanup failed:", e); }
  // Kontrakty: uzupełnij brakujące i zamknij te, które wygasły w świecie gry.
  try { seedMissingContracts(); } catch (e) { console.error("Contract seeding failed:", e); }
  try { releaseExpiredContracts(); } catch (e) { console.error("Contract expiry failed:", e); }
  installContractExpiryWatcher();
  void import("./lib/recordWatcher").then(m => m.installRecordWatcher());
  try { seedYearAwards2025(); } catch (e) { console.error("Year awards 2025 seed failed:", e); }
  const root = document.getElementById("root");
  if (!root) return;
  createRoot(root).render(<App />);

  // History cleanup and a full backup are important, but neither is required
  // to paint or interact with the first screen. Run them after the browser has
  // had a chance to render the app.
  const runDeferredMaintenance = () => {
    void migrateHeavyLocalStorageToDeviceStore().catch(error => console.error("Storage migration failed:", error));
    void synchronizeRankingHistory().catch(error => console.error("Ranking history synchronization failed:", error));
    scheduleDeviceBackup("auto");
    void import("./lib/desktopUpdater").then(m => m.installDesktopUpdater());
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(runDeferredMaintenance, { timeout: 2500 });
  } else {
    setTimeout(runDeferredMaintenance, 500);
  }
};

void startApp();
