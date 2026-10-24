// 빌드 뒤에 돈다. 제목 글꼴(Noto Serif KR 700)에서 사이트 제목에 실제로 쓰인 글자만 잘라
// dist/fonts/에 작은 파일로 만든다. 원본 한글 파일은 약 1MB라 그대로 내보내면 첫 화면이 무거워진다.
// 제목 글꼴을 쓰는 새 요소를 만들면 SERIF_CLASSES에 그 클래스 이름을 더한다(tests/fonts.test.mjs가 대조).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import subsetFont from "subset-font";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const require = createRequire(import.meta.url);
const FONT_DIR = join(dirname(require.resolve("@fontsource/noto-serif-kr/package.json")), "files");

export const SERIF_TAGS = ["h1", "h2", "blockquote"];
export const SERIF_CLASSES = ["logo", "foot-lg", "sec-h", "page-h", "hero-h", "q", "closing-h", "feat-t", "tw", "stat-n", "th-l", "dl-date"];
// 운영자가 글을 바꿔도 깨지지 않게 늘 넣는 글자
const ALWAYS = " 0123456789.,·:;!?'\"()[]-–—…%/&+·「」『』세무회계하나더일월화수목금토";

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "_astro" || f === "fonts" ? [] : htmlFiles(p);
    return f.endsWith(".html") ? [p] : [];
  });
}

// 여는 태그부터 짝이 맞는 닫는 태그까지의 글자를 모은다.
export function serifText(html) {
  let out = "";
  const re = /<([a-z0-9]+)(\s[^>]*)?>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[1].toLowerCase();
    const cls = /class="([^"]*)"/.exec(m[2] || "")?.[1]?.split(/\s+/) || [];
    if (!SERIF_TAGS.includes(tag) && !cls.some((c) => SERIF_CLASSES.includes(c))) continue;
    let depth = 1, i = re.lastIndex;
    const open = new RegExp(`<${tag}[\\s>]`, "gi"), close = new RegExp(`</${tag}>`, "gi");
    while (depth > 0) {
      open.lastIndex = close.lastIndex = i;
      const o = open.exec(html), c = close.exec(html);
      if (!c) break;
      if (o && o.index < c.index) { depth++; i = o.index + 1; } else { depth--; i = c.index + c[0].length; if (!depth) out += html.slice(re.lastIndex, c.index) + " "; }
    }
  }
  return out.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
}

export async function buildSubsets() {
  let text = ALWAYS;
  for (const f of htmlFiles(DIST)) text += serifText(readFileSync(f, "utf8"));
  const chars = [...new Set(text)].join("");
  mkdirSync(join(DIST, "fonts"), { recursive: true });
  const out = {};
  for (const [name, file] of [["ko", "noto-serif-kr-korean-700-normal.woff2"], ["la", "noto-serif-kr-latin-700-normal.woff2"]]) {
    const buf = await subsetFont(readFileSync(join(FONT_DIR, file)), chars, { targetFormat: "woff2" });
    writeFileSync(join(DIST, "fonts", `serif-${name}-700.woff2`), buf);
    out[name] = buf.length;
  }
  // 남은 날 큰 숫자(src/components/DeadlineCalc.astro "Hanadeo Num") — 400 굵기 숫자 열 개만
  const num = await subsetFont(readFileSync(join(FONT_DIR, "noto-serif-kr-latin-400-normal.woff2")), "0123456789", { targetFormat: "woff2" });
  writeFileSync(join(DIST, "fonts", "serif-num-400.woff2"), num);
  out.num = num.length;
  return { chars: chars.length, ...out };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = await buildSubsets();
  console.log(`제목 글꼴 자르기: 글자 ${r.chars}개 → 한글 ${Math.round(r.ko / 1024)}KB, 영문 ${Math.round(r.la / 1024)}KB, 큰 숫자 ${Math.round(r.num / 1024)}KB`);
}
