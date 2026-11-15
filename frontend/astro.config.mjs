// Astro genera un sitio estático (dist/) que Vercel sirve junto con la API de Python (api/index.py).
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  trailingSlash: "ignore",
  build: { format: "directory" },
  server: { port: 4321 },
  vite: {
    // En desarrollo, /api va al backend FastAPI local (uvicorn api.index:app --port 8765)
    server: { proxy: { "/api": "http://127.0.0.1:8765" } },
  },
});
