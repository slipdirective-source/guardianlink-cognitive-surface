// Browser entry point. Bundled with esbuild (see package.json build:ui).
import "./styles.css";
import { createApp } from "./app";

const root = document.getElementById("app");
if (!root) throw new Error("#app element missing");
createApp(root);
