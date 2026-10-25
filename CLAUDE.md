# semusa — 하나 더 세무회계 홈페이지

- 배포: https://semusatax.vercel.app (main 병합 → Vercel). 작업 가지에서 만든 것은 단계가 끝나 운영자가 확인하기 전에는 main에 병합하지 않는다.
- Astro 7 정적 사이트. `npm run build && npm test`(자료 검사·빌드·제목 글꼴 자르기·검사 33개).

## 운영자 결정 (바꾸려면 운영자에게 먼저 묻는다)

- **"세무사" 명칭 금지** — 운영자가 말하기 전까지. 대표는 "세무전문가 성광호"(2026-10-24). `scripts/validate-data.mjs`(자료 파일)와 `tests/dist.test.mjs`(만든 페이지 전체)가 막는다. 책 표지 그림 속 「○○○ 세무사 공저」(공저자 이름 옆)는 그대로 써도 된다(2026-10-24 운영자 — 대표 이름이 아니라서). 그림 대체글·지은이 줄에는 「세무사」를 쓰지 않는다.
- 공지사항("2027년 2월 공식 오픈 예정")·고객 후기 2건·바닥글 `© 2027`은 문구 그대로 유지.
- 저서는 교보문고에서 "성광호"로 검색되는 책 전부(권수는 그 목록으로 확인 — 지어내지 말 것).
- 전화번호·상담 비용·사업자등록번호·교통은 미정 → `site.json`에 `null`, 화면에서 그 줄을 숨긴다.

## 지킬 것

- 사무소 정보·계산기·서비스·FAQ는 `src/data/*.json`·`src/content/faq/*.md`에만. 페이지에 직접 적지 말 것.
- 버튼은 두 가지뿐: 카카오톡 = 노랑(`btn-kakao`), 그 밖 = 숲색(`btn-moss`). 테두리 버튼(옛 `btn-line`)·밑줄 글자 버튼·찾기 창 「닫기」도 숲색으로 맞췄다(2026-10-24 운영자 「네 제안대로」) — 새 모양을 만들지 말 것. 금색은 선·확인 표시에만(금색 #C4993C는 흰 바탕 대비 2.64:1). 금색 글자는 `--gold-text` #806020 — 금빛 바탕에서도 4.97:1.
- 구역 끝 "전체 보기"는 숲색 테두리 둥근 링크 `more-link`(새 색 금지), 카드 맨 아래 할 일 한 줄은 `go`(금색 글자), 카드 제목 왼쪽 금색 세로 줄 — 2026-10-24 KPMG 참고.
- 글자는 14px 이상, 본문 17px. 한글 기울임 금지.
- 본문은 기기 글꼴(내려받기 0). 제목 글꼴은 빌드 뒤 `scripts/subset-fonts.mjs`가 쓰인 글자만 잘라 `dist/fonts/`에 만든다 — 제목 글꼴(`--f-display`)을 쓰는 새 클래스는 `SERIF_CLASSES`에 더한다(`tests/fonts.test.mjs`).
- 세법 숫자·기한은 법조문 원문과 대조한 것만, 근거 조문을 같이 적는다(FAQ `law:` 칸).
- 자주 묻는 질문(6차 D, 20개): 순서 4부터는 머리말 `src:`(근거 이름 + 고를 항 ①… 또는 호 1. — `docs/faq-sources.json`, `scripts/make-faq-sources.mjs`로만 옮김) 필수 — 답의 숫자는 고른 원문 줄(과 그 판의 번호·시행일)에 있어야 한다(`checkFaq`·`src/lib/faqSources.js`). 답 아래 「법조문 원문 보기」는 고른 줄 그대로(칸이 합쳐진 표는 법제처 링크로), 고른 줄에 「세무사」 금지(법인세법 제60조 ⑨에 있음 — ①③만 고름). 분야(category)를 더하면 topics.json·services.json `faq`도. 첫 화면은 분야마다 첫 질문(`perCategory`). 원문 감시(law-watch)도 faq-sources를 대조한다.
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
- 사이트 찾기(2026-10-24 3차 A2): 머리글 🔍·Ctrl/⌘+K·"/" → `SiteSearch.astro`(목록 `/search.json`은 창을 처음 열 때만 받음 — 첫 화면 용량 그대로). 목록 만들기·거르기는 `src/lib/searchIndex.js`(자료 파일 글 그대로, 줄임말 `ALIASES`, 글자 일치만 — 점수·AI 노출 금지), 쪽 목록은 `src/lib/sitePages.js` — 새 쪽을 만들면 여기에도. 질문 자리는 `faqId`(FaqList details id와 같음, `/faq#q-…`로 오면 펼침).
- 글자 크게(3차 D2): 머리글 「가가」(aria-pressed) → `html[data-fs="lg"]`, 이 기기 localStorage `fs`만. 글자가 px라 `zoom: 1.15`를 본문·바닥글에만(머리글은 그대로 — 휴대폰 한 줄), 창(찾기·메뉴)은 700px 이상에서만(휴대폰은 글자 크기만 — 100vw 창이 화면 밖에 걸렸다), 계산기 틀 `.frame`은 되돌림 zoom(화면 한 장 높이 규칙). Base.astro 머리의 작은 스크립트가 그리기 전에 붙인다. 320px 화면에선 「가가」가 메뉴 안 「글자 크게」로(`data-fs-btn` 둘이 같은 상태). 키운 화면은 좁아지므로 넘침은 `minmax(0, 1fr)`·줄바꿈으로 막는다(검사 스크립트로 320~1024 확인). 큰 메뉴는 1024px부터(아래 막대·맨 위로 버튼도 같은 경계 — 900~1023에서 메뉴 글자가 두 줄로 꺾였다).
- 쪽마다 공유 그림(3차 B3): `src/lib/ogPages.js`(쪽·글 — 자료 파일 그대로) → `scripts/make-og-pages.mjs`가 `public/og/<file>.png`(손으로 고치지 말 것, 서비스·계산기·쪽 이름을 바꾸면 다시 돌린다 — `tests/og-pages.test.mjs`). Base가 주소로 찾아 og:image에, 목록에 없는 쪽은 `/og.png`. 주소 값(?e=)마다 그림은 못 나눈다(정적 쪽).
- 상담 준비 꾸러미(3차 C2): `PrepareKit.astro` — services.json `prepare`를 체크 칸으로, 표시는 localStorage `prep:<서비스 slug>`(글로 기억)만, 「목록 보내기」는 글자 목록뿐, 「인쇄 한 장」은 그 목록만. 같은 id가 한 쪽에 여럿이면 `pk-sync`로 맞춘다. 법정 첨부서류 목록이 아니라는 안내를 빼지 말 것.
- 용어 풀이(`/glossary`, 3차 C3): `src/data/glossary.json` — 인용(quote)은 `docs/glossary-sources.json` 원문을 글자 그대로(원문 파일은 택스 서치가 법제처에서 받아 둔 fixture에서 `scripts/make-glossary-sources.mjs`로만 옮김), 풀이(plain)는 인용 원문에 있는 것만 — 원문에 없는 숫자는 `checkGlossary`(validate-data)가 막는다. 새 용어는 원문부터 옮기고 풀이를 쓴다.
- 오프라인(3차 D1): `public/sw.js` — 기한 달력·올해 세금 달력·`/offline`을 미리 저장(쪽이 쓰는 스크립트 조각·글꼴까지 따라감, `CORE` 저장소는 정리하지 않음), 쪽·글꼴·그림·search.json은 늘 인터넷 먼저(글꼴은 빌드마다 같은 이름으로 다시 잘림), 저장본 먼저는 이름에 내용이 박힌 `/_astro/`만, 다른 사이트(계산기 iframe·카카오)는 건드리지 않는다. 글꼴·모듈 스크립트는 cors라 `Vary: Origin`이 걸려 주소로만 찾는다(`ignoreVary`). sw.js를 고치면 `VERSION`을 올린다. `/offline`은 색인 밖·마무리 띠 없음.
- 주제 모아 보기(`/topics`, 4차 A1): `src/data/topics.json`이 이미 있는 자료(기한·용어·질문 분야·계산기·서비스·칼럼 주제·책 제목)를 잇는 표 — 세법 글을 쓰지 않는다, id는 `checkTopics`가 대조. 쪽마다 계산 카드는 하나(전환 이름 `dl-date`), 공유 그림·찾기 목록(kind "주제")에도 들어간다.
- 상담 요청 글(4차 C1): `ConsultNote.astro` + `src/lib/consultMessage.js` — 쪽이 `sendConsult(detail)`(상황·날짜·기한·챙긴 서류)을 보내면 카카오톡에 붙일 글을 만든다(길잡이·기한 달력). 글은 메모리에만(저장소·서버 금지 — 고친 글에 개인정보가 들어갈 수 있음), 이름·연락처·금액 칸 없음, 기한엔 「참고용」, 체크를 하나도 안 했으면 「아직 없는 것」으로 단정하지 않는다. 고친 글은 새 선택이 와도 덮지 않는다.
- 세금 생애 지도(`/life`, 4차 D1): `src/data/lifemap.json`은 정거장 이름표(label)와 id 연결뿐 — 기한·계산기·서비스는 guide.json 상황, 용어는 glossary.json, 더 보기는 topics.json에서 그대로(`checkLifemap`). 세법 글을 여기·쪽에 새로 쓰지 말 것(기한 자료가 없는 일은 "아직 싣지 않았다"고만). 한 번에 하나만 펼침(disclosure 단추), 주소 `#<id>`로 그 일을 펼친 채 연다, 자바스크립트가 없으면 전부 펼침. 첫 화면 서비스 구역 아래 맛보기 줄이 `/life#<id>`로 잇는다.
- 세율·공제 한눈에(`/rates`, 5차 A1): 글·숫자는 `docs/rates-sources.json`(택스 서치가 법제처에서 받아 둔 원문 — `scripts/make-rates-sources.mjs`로만 옮김) 그대로, 선 문자 표는 `src/lib/lawTable.js`가 칸으로 푼다 — 세율·금액을 손으로 옮겨 적지 말 것(`tests/law-table.test.mjs`가 칸 글이 원문에 있는지 대조). 무엇을 보일지(조문·항·순서)는 `src/data/rates.json`(`checkRates`), 풀 수 없는 계산식 그림은 법제처 원문 링크로. 쪽엔 시행일 대신 법률 번호·공포일·받은 날(판 메타의 시행일이 다른 조문 것일 수 있음), 판이 둘이면 무리를 `version: true`로 — 이름표는 원문 메타(법률 번호·공포일)로, 공포일이 가장 늦은 판에 「지금 판」(손으로 「지금/앞」을 적지 말 것), 부칙은 같은 판(법률 번호)일 때만 붙고(`checkRates`), 그 판 세율의 적용례가 아닌 부칙은 붙이지 않는다. 법제처 링크는 그 판 주소 `/(법률번호,공포일)/제N조`, 고른 항 밖으로 빠진 항은 쪽이 「같은 조 ②…은 옮기지 않았습니다」로 알린다(`droppedParagraphs`), 풀지 못한 표(raw)는 빌드를 멈춘다. 해석·요약·계산 금지.
- 검색 노출(5차 B1): 사무소는 Base의 `AccountingService`(`@id` = 사이트주소/#org), 위치 표시가 있는 쪽은 `CrumbLd.astro`로 BreadcrumbList(PageHead가 자동 — 위치 표시를 직접 그리는 쪽도 이 부품을), 서비스 Service(provider = #org), 칼럼·책 쪽 Book·Article(자료 파일 글 그대로), 세율 쪽 Dataset. 채널(`site.json` channels)의 `url`은 sameAs(계정 주소 그대로), 화면 링크는 `link`가 있으면 그것(유튜브 @성셈 → Shorts 탭 — 세금 영상이 Shorts에 모여 있음, 2026-10-24 운영자). RSS `/rss.xml`은 지면 칼럼(press.json) — 날짜만 있는 글은 한국 시각 오전 9시. 검사가 모든 쪽의 JSON-LD를 읽어 본다.
- 이번 달 마감 띠(5차 C1): `MonthBand.astro`(Base 머리글 바로 아래, 모든 쪽) — 빌드 때 deadlines.json yearly를 `yearOccurrences`(공휴일 연장)로 앞으로 1년치만 심고, 고르기·남은 날은 그리기 전 작은 인라인 스크립트가(모듈 스크립트로 바꾸면 띠가 늦게 끼어 쪽이 44px 밀림). 「오늘」은 한국 날짜(Asia/Seoul), 빌드 때 그해 공휴일 자료가 없었으면 「공휴일 자료 없음」, 닫으면 localStorage `band:<연-월>`로 그달만 숨김, 자바스크립트 없으면 안 보임. 1년 넘게 다시 배포하지 않으면 띠가 사라진다(심은 기한이 다 지남).
- 법조문 원문 감시(5차 A3): `.github/workflows/law-watch.yml`이 매주 월요일 택스 서치 최신 fixture와 `docs/*-sources.json`을 `--check`로 대조(`scripts/lib/sourceCheck.mjs` — 글자·법률 번호만, 받은 날 차이는 무시), 바뀌면 실패·요약. 택스 서치가 비공개라 저장소 비밀 값 `TAX_SEARCH_TOKEN`(읽기 전용)이 없으면 건너뛴다. 바뀌면 사이트 글(용어 풀이·세율)을 확인한 뒤 스크립트를 `--check` 없이 돌려 옮긴다. `/sources`(원문 기준일)가 옮겨 둔 원문의 판·받은 날·쓰는 곳을 보인다 — 감시가 돈다고 쪽에 적지 말 것(토큰이 없으면 안 돎).
- 이 사이트가 일하는 방식(`/how`, 6차 B): 숫자·기한 예는 자료 파일·계산 함수(`computeDeadline`·`civilMonthsEnd`)에서만 — 손으로 적는 숫자 금지. 접근성·성능 표는 `src/data/quality.json`(사람이 Lighthouse로 잰 날의 값 — 다시 재면 날짜와 값을 같이 바꾸고, 자동 측정처럼 쓰지 말 것). 원문 감시가 돈다고 쓰지 말 것(위 원문 감시 규칙).
- 자릿수 바퀴(6차 A): 쉬는 상태는 실제 숫자 글자(화면 캡처·공유 미리 보기에 0이 찍히지 않게), 바퀴 칸은 화면에 들어올 때만 만들어 돌린 뒤 글자로 되돌린다 — 첫 화면 그려 둔 요소 1,000개 이하(`tests/dist.test.mjs`). 책 표지색은 글자색과 4.5:1 이상(`tests/book-colors.test.mjs`).
- 부기(6차 C, 2026-10-25 운영자 「A~D 전부」): 유튜브 @성셈 Shorts의 3D 부엉이 — 그림은 택스 서치 `public/mascot/3d`에서 줄인 `public/img/buki/`(200·300w), 부품 `Buki.astro`, 머리는 `PageHead buki=`(사진 없는 쪽만). 한 쪽에 한 마리 이하, alt 빈칸, 안내 문구 자리에만 — 계산 결과·세율 표 위·말풍선·숫자 금지(`tests/dist.test.mjs`). 오프라인 쪽은 평면 「연결 안 됨」 그림을 쪽 안에(따로 받는 파일이면 끊겼을 때 안 보임), sw.js는 `/img/buki/`도 미리 저장.
  첫 화면 「부기와 1분 세금」(`ShortsStrip.astro`·`src/lib/shortsFeed.js`·`src/data/shorts.json`): 빌드 때 유튜브 공개 목록(Atom)에서 Shorts 중 제목에 세금 낱말이 든 것만(「세」 한 글자 금지 — 「세 가지」에 걸림, 「세무사」 든 제목 제외), 제목 그대로, 썸네일·재생기 없음(바깥 요청 없음), 못 읽으면 구역 숨김(유튜브 피드는 같은 주소도 절반쯤 404·500 — 8번까지 다시 묻는다, 첫 배포에서 구역이 빠졌음). 이 환경처럼 바깥에 못 나가는 곳에서 화면을 볼 땐 `SHORTS_FEED_FILE=받아 둔 피드`로만.
- 지면에 실린 칼럼은 `src/data/press.json`(지면 제목 그대로) + `public/img/press/`(운영자가 보낸 지면 PDF를 그림으로) — 칼럼·책 쪽 맨 위.
- 종이색은 풀빛 도는 회색(#F2F3EE), + 기호는 로고·첫 화면 제목 끝 하나·마감 표시·목록 줄 오른쪽(`PlusList` — 2차 개편 계획 승인)·계산기 불러오는 중·옅은 모눈(`.plusgrid`)에만 — 제목·띠·틀 머리에 더하지 말 것(2026-10-24 시안 1판에서 십자수처럼 보인다는 지적, 같은 날 독립 검토에서 마무리 띠 제목·404·불복 띠·계산기 틀에 붙인 것을 뺐다).
- 책 목록 `home.json` books는 최신순 — 홈은 앞에서 `homeBooks`(4)권만, 칼럼·책 페이지는 전부. 표지 사진은 `cover`(public/img/books/, PowerPoint에서 PNG로 내보낸 것 → webp 400px), 없으면 표지색(`color`)으로 그린 표지. 표지 PPTX를 이 환경에서 그림으로 바꾸면 글꼴이 없어 깨지니 쓰지 말 것. 운영자가 보낸 표지 PDF(글꼴이 박혀 있음)는 그대로 그려 써도 된다(pdftoppm 300dpi → 가운데 400×571). 출간 연월(`date`)은 확인된 것만 — 표지의 「2025년」·파일 이름 날짜는 출간일이 아니다(날짜 없는 책은 그 날짜를 참고해 순서만). 머리말이 「알면 돈 버는」 말고도 「알면 돈이 되는」·「알아두면 돈이 되는」이 있다(제목은 표지 글자 그대로), 공저자는 `coauthors`(지은이 줄 `bookAuthors`).
- 칼럼·책 카드 표지는 `src/components/Thumb.astro` — 블로그 글은 제목 낱말로 주제(`src/lib/thumbTopic.js`)를 골라 색·그림을 바꾸고, RSS에 네이버 사진(pstatic.net)이 있으면 사진을 쓴다(못 불러오면 그림).
- 로고는 글자 로고 A「하나 더+ │ 세무회계」(2026-10-24 운영자 선택) — `src/components/Logo.astro` 한 곳(머리글·메뉴·바닥글은 `dark`). "하나 더"는 명조 900을 그 세 글자만 잘라(`serif-logo-900`), +는 가는 금색(`Hanadeo Num` 400).
  아이콘 PNG 5개·`og.png`는 같은 로고의 "더+"(숲색 바탕·크림색 더·금색 +) — `scripts/make-brand-images.mjs`로만 다시 만든다(손으로 고치지 말 것). `tests/icons.test.mjs`가 픽셀을 본다(예전 PNG에 깨진 그림 표시가 찍혀 바로가기 아이콘이 하얬다).
- 안쪽 페이지 공통 부품(2026-10-24 2차 개편): 머리 `PageHead`(+ 모눈·`ph-tag` 꼬리표·핵심 기한 칩 `chips`·장식 사진 `photo` — 휴대폰에선 숨기고 받지도 않음), 목록 줄 `PlusList`(오른쪽 + 90° 회전), 책 표지 `BookCover`, 거르기 칩 `.fchip`(전역), 기한 계산으로 보내는 띠 `DeadlineBand`, 마무리 띠 `ClosingCta`("하나 더 물어보세요" — 404 말고 모든 쪽, 불복은 "기한이 있는 일입니다", 바로 아래 오시는 길이 있는 홈·오시는 길은 `compact`), 자릿수 바퀴 `Odometer`(소개 쪽 숫자). 새 쪽도 이 부품으로.
  서비스 쪽 `services.json`의 `photo`(장식 사진 이름)·`yearly`(매년 기한 — deadlines.json yearly id)·`faq`(그 분야 질문 category)는 `scripts/validate-data.mjs`가 대조한다. 그린 표지 글자색은 `inkFor`(WCAG 대비가 큰 쪽).
- 움직임(2026-10-24 2차 개편, `global.css` 맨 아래 한 곳): 페이지 넘김은 브라우저 기본 `@view-transition`(Base.astro 머리의 작은 `<style is:inline>`에만 — CSS 파일·`@media` 안에 두면 첫 화면으로 넘어갈 때 Chromium이 전환을 끊는다, 머리글·아래 막대 고정, 서비스 이름은 `view-transition-name: svc-<slug>` — 한 쪽에 같은 이름 둘 금지), 구역 등장은 `animation-timeline: view()`(`.reveal` 목록·구역 제목 — 지원 안 하면 처음부터 보임), 누름 0.98배. 끝없이 도는 장식·자동 재생·스크롤 붙잡기 금지, 움직임 줄이기면 전부 끔.
- 사진은 `public/img/photos/`, 출처는 `docs/photo-sources.md` — 분위기 사진(mood-*)은 사람·장소·다른 저자 책 제목이 없는 것만 장식으로, 운영자 사진(own-*)은 우리 책만 선명하게 두고 다른 책은 흐리게.
- 칼럼·책의 블로그 최신 글은 빌드 때 RSS를 읽고(`src/lib/blogFeed.js`), 못 읽으면 그 칸만 뺀다 — 빌드를 실패시키지 말 것.
- 영상(`src/data/videos.json`)은 누를 때만 받는다(preload=none, 자동 재생 금지). 영상 속 "22권"은 통합검색 22가 검색하는 책 — 옆에 "저서 33권 중 22권" 설명을 빼지 말 것.
