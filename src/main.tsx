import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { bootstrapPersistedState } from "./lib/changeLog";
import { createDeviceBackup, restoreLatestDeviceBackupIfLocalStateMissing } from "./lib/deviceBackup";
import { initializeDeviceStoreCache } from "./lib/deviceStore";
import { migrateHeavyLocalStorageToDeviceStore } from "./lib/storage";

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
  void createDeviceBackup("auto", "Start aplikacji");

  createRoot(document.getElementById("root")!).render(<App />);
};

void startApp();
