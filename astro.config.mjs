import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// 공지·개인정보처리방침·404·오프라인 안내는 검색 색인 대상에서 뺀다(설계서 v2 · 색인 대상 25).
const NOINDEX = ["/notice", "/privacy", "/404", "/offline"];

export default defineConfig({
  site: "https://semusatax.vercel.app",
  trailingSlash: "never",
  build: { format: "file" },
  // CSP(scripts/csp.mjs): 작은 스크립트는 화면 안에 끼워 넣지 않고 파일로(2026-10-29 — 화면 안 스크립트를 is:inline 5종으로 줄여 지문으로 허용).
  //   스크립트만 — 작은 스타일·그림은 예전처럼(되돌려 주는 undefined = Vite 기본 4KB 기준).
  vite: { build: { assetsInlineLimit: (file) => (/\.(m?js|ts)$/.test(file) ? false : undefined) } },
  integrations: [
    sitemap({ filter: (page) => !NOINDEX.some((p) => new URL(page).pathname.replace(/\/$/, "") === p) }),
  ],
});
