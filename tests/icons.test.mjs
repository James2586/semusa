// 아이콘이 깨진 그림이 아닌지 본다(2026-10-24 — 예전 PNG에 브라우저의 "깨진 그림" 표시가 찍혀 바로가기 아이콘이 하얗게 나왔다).
// PNG 머리(크기)와 픽셀 색을 읽는다. 그림은 글자 로고 A의 "더+"(숲색 바탕·크림색 "더"·금색 +) — scripts/make-brand-images.mjs로만 다시 만든다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const PUB = new URL("../public/", import.meta.url);

// 필터를 풀어 RGB(A) 픽셀을 읽는 작은 PNG 해석기(8비트, 색 2·6만 — 우리 아이콘 형식)
function readPng(file) {
  const b = readFileSync(new URL(file, PUB));
  assert.equal(b.toString("hex", 0, 8), "89504e470d0a1a0a", `${file}: PNG가 아님`);
  let o = 8, w, h, ct, idat = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o), type = b.toString("ascii", o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len);
    if (type === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; assert.equal(d[8], 8); }
    if (type === "IDAT") idat.push(d);
    o += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, raw = inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, up = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c);
      const pred = [0, a, up, (a + up) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? up : c][f];
      px[y * stride + x] = (line[x] + pred) & 255;
    }
  }
  return { w, h, all: (fn) => { let n = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (fn([...px.subarray(y * stride + x * bpp, y * stride + x * bpp + 3)])) n++; return n; }, at: (x, y) => [...px.subarray(y * stride + x * bpp, y * stride + x * bpp + 3)] };
}
const near = (c, hex) => c.every((v, i) => Math.abs(v - parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)) < 24);

test("아이콘 PNG: 크기가 맞고 숲색 바탕에 크림색 \"더\"와 금색 +(깨진 그림 아님)", () => {
  for (const [f, s] of [["favicon-32.png", 32], ["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512], ["icon-maskable-512.png", 512]]) {
    const p = readPng(f);
    assert.deepEqual([p.w, p.h], [s, s], f);
    // 글자 칸 크기는 아이콘마다 다르므로 넓이 대비 비율로 본다(작은 32px도 몇 픽셀은 남는다)
    assert.ok(p.all((c) => near(c, "#F3F0E7")) >= s * s * 0.01, `${f}: 크림색 "더"가 없음`);
    assert.ok(p.all((c) => near(c, "#E8C46A")) >= Math.max(3, s * s * 0.002), `${f}: 금색 +가 없음`);
    assert.ok(near(p.at(Math.round(s * 0.12), s >> 1), "#1E3A2A"), `${f}: 바탕이 숲색이 아님`);
  }
});

test("manifest: 192·512·maskable 아이콘이 실제 파일을 가리킨다", () => {
  const m = JSON.parse(readFileSync(new URL("manifest.webmanifest", PUB), "utf8"));
  assert.equal(m.name, "하나 더 · 세무법인 성수 송파 WM센터");
  for (const i of m.icons) readPng(i.src.slice(1));
  assert.ok(m.icons.some((i) => i.purpose === "maskable"));
  assert.ok(["standalone", "minimal-ui"].includes(m.display), "설치하려면 standalone·minimal-ui");
});
