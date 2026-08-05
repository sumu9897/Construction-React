import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from pmcclb.com/app/ (and later app.pmcclb.com/app/ can be
// re-based); every asset URL must carry the prefix.
export default defineConfig({
  base: "/app/",
  plugins: [react()],
});
