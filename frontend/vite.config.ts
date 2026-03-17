import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["thesis.northofprosper.com"],
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
