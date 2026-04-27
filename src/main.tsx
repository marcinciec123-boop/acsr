import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { bootstrapPersistedState } from "./lib/changeLog";

// Restore custom transfers, roster mutations, and per-player overrides
// from localStorage before the React tree mounts.
bootstrapPersistedState();

createRoot(document.getElementById("root")!).render(<App />);
