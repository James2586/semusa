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
  남은 날 숫자(계산 카드·「매년 돌아오는 날」 D-숫자·기한 달력)는 자릿수 바퀴(움직임 줄이기면 바로), 화면 읽기용 글자(`data-num-sr`)를 빼지 말 것. JS가 만드는 칸에도 닿게 이 부품 스타일은 `dl-` 머리글자의 전역 스타일.
- 기한 달력(`/deadline`, 2026-10-24 "결정적 한 장면"): 계산은 홈 카드와 같은 `computeDeadline`, 달·칸 옮기기는 `src/lib/deadlineCalendar.js`(`planCalendar` — 새 기한을 만들지 않음, `tests/deadline-calendar.test.mjs`). 주소엔 `e`·`d`·`a`(일 종류·날짜·해외)만 — 개인정보 금지. 일정 파일(`deadlineIcs`)은 브라우저 안에서만 만든다. 계산 카드의 날짜(`.dl-date`)와 달력의 큰 날짜(`.dc-date`)는 같은 전환 이름 `dl-date` — 한 쪽에 계산 카드 둘 금지. 칸 클래스에 전역 이름(`.skip` 등)을 쓰지 말 것(`dc-` 머리글자 — `.skip`이 건너뛰기 링크라 칸이 화면 밖으로 사라졌다). 화면에서 만드는 제목 글자는 `subset-fonts.mjs` ALWAYS에 더한다(년·~).
- 상황 길잡이(`/guide`, 2026-10-24 3차 A1): 상황 → 기한·서비스·계산기는 `src/data/guide.json`(`checkGuide`가 deadlines·services·calculators와 대조), 세법 글은 새로 쓰지 않는다 — 기한은 `computeDeadline`·`nextYearly`, 준비할 것은 services.json `prepare`, 칼럼은 press.json 주제 칸. 결과 묶음은 미리 그려 두고 JS는 고른 것만 보인다(자바스크립트 없으면 전부 펼침). 주소엔 `s`·`w`·`d`만.
- 지면에 실린 칼럼은 `src/data/press.json`(지면 제목 그대로) + `public/img/press/`(운영자가 보낸 지면 PDF를 그림으로) — 칼럼·책 쪽 맨 위.
- 종이색은 풀빛 도는 회색(#F2F3EE), + 기호는 로고·첫 화면 제목 끝 하나·마감 표시·목록 줄 오른쪽(`PlusList` — 2차 개편 계획 승인)·계산기 불러오는 중·옅은 모눈(`.plusgrid`)에만 — 제목·띠·틀 머리에 더하지 말 것(2026-10-24 시안 1판에서 십자수처럼 보인다는 지적, 같은 날 독립 검토에서 마무리 띠 제목·404·불복 띠·계산기 틀에 붙인 것을 뺐다).
- 책 목록 `home.json` books는 최신순 — 홈은 앞에서 `homeBooks`(4)권만, 칼럼·책 페이지는 전부. 표지 사진은 `cover`(public/img/books/, PowerPoint에서 PNG로 내보낸 것 → webp 400px), 없으면 표지색(`color`)으로 그린 표지. 표지 PPTX를 이 환경에서 그림으로 바꾸면 글꼴이 없어 깨지니 쓰지 말 것.
- 칼럼·책 카드 표지는 `src/components/Thumb.astro` — 블로그 글은 제목 낱말로 주제(`src/lib/thumbTopic.js`)를 골라 색·그림을 바꾸고, RSS에 네이버 사진(pstatic.net)이 있으면 사진을 쓴다(못 불러오면 그림).
- 로고는 글자 로고 A「하나 더+ │ 세무회계」(2026-10-24 운영자 선택) — `src/components/Logo.astro` 한 곳(머리글·메뉴·바닥글은 `dark`). "하나 더"는 명조 900을 그 세 글자만 잘라(`serif-logo-900`), +는 가는 금색(`Hanadeo Num` 400).
  아이콘 PNG 5개·`og.png`는 같은 로고의 "더+"(숲색 바탕·크림색 더·금색 +) — `scripts/make-brand-images.mjs`로만 다시 만든다(손으로 고치지 말 것). `tests/icons.test.mjs`가 픽셀을 본다(예전 PNG에 깨진 그림 표시가 찍혀 바로가기 아이콘이 하얬다).
- 안쪽 페이지 공통 부품(2026-10-24 2차 개편): 머리 `PageHead`(+ 모눈·`ph-tag` 꼬리표·핵심 기한 칩 `chips`·장식 사진 `photo` — 휴대폰에선 숨기고 받지도 않음), 목록 줄 `PlusList`(오른쪽 + 90° 회전), 책 표지 `BookCover`, 거르기 칩 `.fchip`(전역), 기한 계산으로 보내는 띠 `DeadlineBand`, 마무리 띠 `ClosingCta`("하나 더 물어보세요" — 404 말고 모든 쪽, 불복은 "기한이 있는 일입니다", 바로 아래 오시는 길이 있는 홈·오시는 길은 `compact`), 자릿수 바퀴 `Odometer`(소개 쪽 숫자). 새 쪽도 이 부품으로.
  서비스 쪽 `services.json`의 `photo`(장식 사진 이름)·`yearly`(매년 기한 — deadlines.json yearly id)·`faq`(그 분야 질문 category)는 `scripts/validate-data.mjs`가 대조한다. 그린 표지 글자색은 `inkFor`(WCAG 대비가 큰 쪽).
- 움직임(2026-10-24 2차 개편, `global.css` 맨 아래 한 곳): 페이지 넘김은 브라우저 기본 `@view-transition`(Base.astro 머리의 작은 `<style is:inline>`에만 — CSS 파일·`@media` 안에 두면 첫 화면으로 넘어갈 때 Chromium이 전환을 끊는다, 머리글·아래 막대 고정, 서비스 이름은 `view-transition-name: svc-<slug>` — 한 쪽에 같은 이름 둘 금지), 구역 등장은 `animation-timeline: view()`(`.reveal` 목록·구역 제목 — 지원 안 하면 처음부터 보임), 누름 0.98배. 끝없이 도는 장식·자동 재생·스크롤 붙잡기 금지, 움직임 줄이기면 전부 끔.
- 사진은 `public/img/photos/`, 출처는 `docs/photo-sources.md` — 분위기 사진(mood-*)은 사람·장소·다른 저자 책 제목이 없는 것만 장식으로, 운영자 사진(own-*)은 우리 책만 선명하게 두고 다른 책은 흐리게.
- 칼럼·책의 블로그 최신 글은 빌드 때 RSS를 읽고(`src/lib/blogFeed.js`), 못 읽으면 그 칸만 뺀다 — 빌드를 실패시키지 말 것.
- 영상(`src/data/videos.json`)은 누를 때만 받는다(preload=none, 자동 재생 금지). 영상 속 "22권"은 통합검색 22가 검색하는 책 — 옆에 "저서 33권 중 22권" 설명을 빼지 말 것.
