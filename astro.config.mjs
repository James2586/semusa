import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// 공지·개인정보처리방침·404·오프라인 안내는 검색 색인 대상에서 뺀다(설계서 v2 · 색인 대상 25).
const NOINDEX = ["/notice", "/privacy", "/404", "/offline"];

export default defineConfig({
  site: "https://semusatax.vercel.app",
  trailingSlash: "never",
  build: { format: "file" },
  integrations: [
    sitemap({ filter: (page) => !NOINDEX.some((p) => new URL(page).pathname.replace(/\/$/, "") === p) }),
  ],
});
