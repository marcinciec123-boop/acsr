import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { bootstrapPersistedState } from "./lib/changeLog";
import { createDeviceBackup, restoreLatestDeviceBackupIfLocalStateMissing } from "./lib/deviceBackup";
import { initializeDeviceStoreCache } from "./lib/deviceStore";
import { migrateHeavyLocalStorageToDeviceStore } from "./lib/storage";
import { initTheme } from "./lib/theme";
import { initFont } from "./lib/font";
import { installMonthEndSnapshots, installRankingHistoryAutoSync, synchronizeRankingHistory } from "./lib/rankingHistory";
import { cleanupSwissSkeletons } from "./lib/swissSkeletonCleanup";
import { fixHistoricalMatchDates } from "./lib/historicalMatchDates";

initTheme();
initFont();

const startApp = async () => {
  await initializeDeviceStoreCache();
  await migrateHeavyLocalStorageToDeviceStore().catch(error => console.error("Storage migration failed:", error));
  await restoreLatestDeviceBackupIfLocalStateMissing().catch(error => {
    console.error("Device backup restore failed:", error);
    return false;
  });

  // Restore custom transfers, roster mutations, and per-player overrides
  // from localStorage before the React tree mounts.
  bootstrapPersistedState();
  await synchronizeRankingHistory().catch(error => console.error("Ranking history synchronization failed:", error));
  installRankingHistoryAutoSync();
  installMonthEndSnapshots();
  try { fixHistoricalMatchDates(); } catch (e) { console.error("Historical match date fix failed:", e); }
  try { cleanupSwissSkeletons(); } catch (e) { console.error("Swiss skeleton cleanup failed:", e); }
  void createDeviceBackup("auto", "Start aplikacji");

  createRoot(document.getElementById("root")!).render(<App />);
};

void startApp();
