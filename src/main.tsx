import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { installFrameGuard } from "./lib/frame-guard";
import { installStaleChunkReload } from "./lib/stale-chunk-reload";
import "./theme/fonts";
import "./index.css";
import "./theme/surfaces.css";
import "./theme/responsive.css";
import "./theme/motion.css";

installFrameGuard();
installStaleChunkReload();

createRoot(document.getElementById("root")!).render(<App />);
