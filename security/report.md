# semusa(홈페이지) 보안 점검 보고서

만든 때: 2026-10-28 07:47 (한국 시각)

## 요약

| 구분 | 높음 | 중간 | 낮음 | 참고 |
|---|---|---|---|---|
| 새로 찾음(기준선에 없음) | 0 | 0 | 0 | 0 |
| 확인 필요(open) | 0 | 1 | 3 | 0 |
| 검토 끝(accepted) | 0 | 0 | 0 | 0 |

## 새로 찾음

(없음)

## 확인 필요(open)

| 위험도 | 규칙 | 위치 | 내용 | 고치는 방향 |
|---|---|---|---|---|
| 중간 | headers/csp | `vercel.json` | CSP(화면에서 실행할 수 있는 스크립트 출처 제한) 없음 | 허용 출처 목록으로 CSP를 먼저 Report-Only로 걸고 위반 보고를 본 뒤 차단 |
| 낮음 | xss/json-in-script | `src/components/CrumbLd.astro:14` | <script>에 넣는 JSON에서 < 를 바꾸지 않음: JSON.stringify(ld) — 자료 글에 </script>가 들어가면 쪽 뒤가 스크립트로 읽힘 | 다른 자료 칸처럼 .replace(/</g, "\\u003c") |
| 낮음 | xss/json-in-script | `src/layouts/Base.astro:88` | <script>에 넣는 JSON에서 < 를 바꾸지 않음: JSON.stringify([org, ...jsonLd]) — 자료 글에 </script>가 들어가면 쪽 뒤가 스크립트로 읽힘 | 다른 자료 칸처럼 .replace(/</g, "\\u003c") |
| 낮음 | headers/missing | `vercel.json` | 보안 헤더 strict-transport-security 없음 — 늘 https로만(HSTS) — vercel.app 주소는 Vercel이 붙여 주지만 직접 도메인을 쓰면 필요 | vercel.json headers의 "/(.*)"에 strict-transport-security 추가 |

## 검토 끝(accepted)

(없음)

## 화면 스크립트의 innerHTML

.astro 화면 스크립트·src/lib·public의 innerHTML·insertAdjacentHTML·document.write 7곳을 봤다 — 주소(?e=·#…)·localStorage·sessionStorage에서 온 값이 정화 없이 들어가는 곳만 xss/dom-source로 나온다(빌드 때 자료 파일로 만든 글은 대상 아님).

## 의존성 취약점(npm audit)

- 알려진 취약점 없음

## 운영 사이트 확인(https://semusatax.vercel.app, GET만)

공개되면 안 되는 파일 없음

### 보안 헤더(실제 응답)

| 주소 | 판정 |
|---|---|
| / | ❌ CSP 없음 |
| /deadline | ❌ CSP 없음 |

### 실수로 공개되기 쉬운 파일

| 주소 | 판정 |
|---|---|
| /.env | ✅ 안 열림(404) |
| /.git/config | ✅ 안 열림(404) |
| /.git/HEAD | ✅ 안 열림(404) |
| /package.json | ✅ 안 열림(404) |
| /.vercel/project.json | ✅ 안 열림(404) |
| /vercel.json | ✅ 안 열림(404) |

### 소스맵

| 파일 | 판정 |
|---|---|
| /_astro/DeadlineCalc.astro_astro_type_script_index_0_lang.CjqJludX.js.map | ✅ 없음(404) |
| /_astro/UpcomingDeadlines.astro_astro_type_script_index_0_lang.CzG7andD.js.map | ✅ 없음(404) |

## 이 도구가 못 보는 것

- 값 추적은 스크립트 한 덩어리 안(선언·대입)까지만 — 함수에 넘겨 계산한 결과(날짜 계산 등)는 안전하다고 본다.
- 계산기 iframe이 띄우는 바깥 사이트(홈페이지 계산기들)는 그 저장소에서 따로 본다.
- Vercel 프로젝트 설정·카카오 앱의 JavaScript 키 도메인 제한은 저장소 밖이라 보지 못한다.

