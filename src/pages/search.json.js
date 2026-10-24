// 사이트 찾기 목록(2026-10-24 3차 A2) — 찾기 창을 처음 열 때만 받는다. 만드는 법은 src/lib/searchIndex.js.
import { buildSearchIndex, faqId } from "../lib/searchIndex.js";
import svcData from "../data/services.json";
import calcData from "../data/calculators.json";
import press from "../data/press.json";
import dl from "../data/deadlines.json";
import guide from "../data/guide.json";
import { SITE_PAGES } from "../lib/sitePages.js";

export async function GET() {
  const mods = import.meta.glob("../content/faq/*.md", { eager: true });
  const faqs = Object.entries(mods).map(([path, m]) => ({ ...m.frontmatter, id: faqId(path), body: m.rawContent() }))
    .sort((a, b) => Number(a.order) - Number(b.order));
  const items = buildSearchIndex({
    pages: SITE_PAGES, services: svcData.services, calculators: calcData.calculators, faqs,
    articles: press.articles || [], events: dl.events, yearly: dl.yearly, situations: guide.situations,
  });
  return new Response(JSON.stringify({ items }), { headers: { "Content-Type": "application/json; charset=utf-8" } });
}
