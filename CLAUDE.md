# semusa — 하나 더 세무회계 홈페이지

- 배포: https://semusatax.vercel.app (main 병합 → Vercel). 작업 가지에서 만든 것은 단계가 끝나 운영자가 확인하기 전에는 main에 병합하지 않는다.
- Astro 7 정적 사이트. `npm run build && npm test`(자료 검사·빌드·제목 글꼴 자르기·검사 33개).

## 운영자 결정 (바꾸려면 운영자에게 먼저 묻는다)

- **"세무사" 명칭 금지** — 운영자가 말하기 전까지. 대표는 "세무전문가 성광호"(2026-10-24). `scripts/validate-data.mjs`(자료 파일)와 `tests/dist.test.mjs`(만든 페이지 전체)가 막는다.
- 공지사항("2027년 2월 공식 오픈 예정")·고객 후기 2건·바닥글 `© 2027`은 문구 그대로 유지.
- 저서는 교보문고에서 "성광호"로 검색되는 책 전부(권수는 그 목록으로 확인 — 지어내지 말 것).
- 전화번호·상담 비용·사업자등록번호·교통은 미정 → `site.json`에 `null`, 화면에서 그 줄을 숨긴다.

## 지킬 것

- 사무소 정보·계산기·서비스·FAQ는 `src/data/*.json`·`src/content/faq/*.md`에만. 페이지에 직접 적지 말 것.
- 버튼은 두 가지뿐: 카카오톡 = 노랑(`btn-kakao`), 그 밖 = 숲색(`btn-moss`). 금색은 선·확인 표시에만(금색 #C4993C는 흰 바탕 대비 2.64:1). 금색 글자는 `--gold-text` #806020 — 금빛 바탕에서도 4.97:1.
- 구역 끝 "전체 보기"는 숲색 테두리 둥근 링크 `more-link`(새 색 금지), 카드 맨 아래 할 일 한 줄은 `go`(금색 글자), 카드 제목 왼쪽 금색 세로 줄 — 2026-10-24 KPMG 참고.
- 글자는 14px 이상, 본문 17px. 한글 기울임 금지.
- 본문은 기기 글꼴(내려받기 0). 제목 글꼴은 빌드 뒤 `scripts/subset-fonts.mjs`가 쓰인 글자만 잘라 `dist/fonts/`에 만든다 — 제목 글꼴(`--f-display`)을 쓰는 새 클래스는 `SERIF_CLASSES`에 더한다(`tests/fonts.test.mjs`).
- 세법 숫자·기한은 법조문 원문과 대조한 것만, 근거 조문을 같이 적는다(FAQ `law:` 칸).
- 결과를 약속하는 말("세금 ○% 절감" 등) 금지. 계산기 결과는 참고용 문구를 붙인다.
- 하위 컴포넌트(`KakaoIcon` 등)에 스타일을 줄 땐 `:global()` — Astro 범위 스타일은 자식 컴포넌트에 닿지 않는다.
- 서비스 페이지의 기한(`services.json` deadlines)·계산기 안내 글(`calculators.json`)은 법조문 원문과 대조한 것만, `law`(근거 조문) 필수 — 근거 인용은 `docs/calculator-content-sources.json`. 글을 고치면 근거도 같이 고친다.
- 계산기 iframe은 화면 한 장 높이로 둔다(높이 자동 맞춤 금지) — 계산기 13개의 결과·보고서 창이 화면에 고정되어 떠서, iframe을 내용 길이로 늘리면 그 창이 화면 밖에 뜬다.
- 신고 기한 계산(2026-10-24 시안 D — 홈 첫 화면·서비스 페이지 `calcEvents`): 규칙·근거 조문·"하나 더 확인할 것"은 `src/data/deadlines.json`만(법조문 대조분만 — `scripts/validate-data.mjs`가 law 칸을 막음), 계산은 `src/lib/deadlineCalc.js`(`tests/deadline.test.mjs`).
  "말일부터 N개월"은 말일 다음 날을 기산일로 민법 제160조, "날부터 N일"은 초일 불산입. 공휴일 연장은 `src/lib/ntsDeadline.js`·`civilPeriod.js` — 택스 서치 `shared/`와 **같은 파일**(고치지 말고 그쪽에서 복사).
  공휴일은 빌드 때 통합검색 22 공개 자료(`/api/faq?resource=holidays`, `src/lib/holidays.js`)에서 읽고, 못 읽으면 토·일·노동절만 넘기며 화면에 "공휴일 자료 없음"을 적는다(빌드는 멈추지 않음) — 임시공휴일이 생기면 다시 배포해야 반영된다.
  남은 날 숫자는 자릿수 바퀴(움직임 줄이기면 바로), 화면 읽기용 글자(`data-num-sr`)를 빼지 말 것. JS가 만드는 칸에도 닿게 이 부품 스타일은 `dl-` 머리글자의 전역 스타일.
- 종이색은 풀빛 도는 회색(#F2F3EE), + 기호는 로고·첫 화면 제목 끝 하나·마감 표시·서비스 목록 표시·옅은 모눈(`.plusgrid`)에만 — 장식으로 늘리지 말 것(2026-10-24 시안 1판에서 십자수처럼 보인다는 지적).
- 책 목록 `home.json` books는 최신순 — 홈은 앞에서 `homeBooks`(4)권만, 칼럼·책 페이지는 전부. 표지 사진은 `cover`(public/img/books/, PowerPoint에서 PNG로 내보낸 것 → webp 400px), 없으면 표지색(`color`)으로 그린 표지. 표지 PPTX를 이 환경에서 그림으로 바꾸면 글꼴이 없어 깨지니 쓰지 말 것.
- 칼럼·책 카드 표지는 `src/components/Thumb.astro` — 블로그 글은 제목 낱말로 주제(`src/lib/thumbTopic.js`)를 골라 색·그림을 바꾸고, RSS에 네이버 사진(pstatic.net)이 있으면 사진을 쓴다(못 불러오면 그림).
- 아이콘 PNG·`manifest.webmanifest`는 favicon.svg와 같은 그림(숲색 바탕 + 금색 십자) — `tests/icons.test.mjs`가 픽셀을 본다(예전 PNG에 깨진 그림 표시가 찍혀 바로가기 아이콘이 하얬다).
- 칼럼·책의 블로그 최신 글은 빌드 때 RSS를 읽고(`src/lib/blogFeed.js`), 못 읽으면 그 칸만 뺀다 — 빌드를 실패시키지 말 것.
- 영상(`src/data/videos.json`)은 누를 때만 받는다(preload=none, 자동 재생 금지). 영상 속 "22권"은 통합검색 22가 검색하는 책 — 옆에 "저서 33권 중 22권" 설명을 빼지 말 것.
