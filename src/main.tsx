import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { installFrameGuard } from "./lib/frame-guard";
import "./index.css";

installFrameGuard();

createRoot(document.getElementById("root")!).render(<App />);
