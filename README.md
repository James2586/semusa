# semusa homepage

하나 더 홈페이지 (https://semusatax.vercel.app). Astro 정적 사이트.

## 운영자가 고치는 곳

| 고칠 것 | 파일 |
|---|---|
| 사무소 정보 (전화·사업자등록번호·상담 비용·교통·주차 등) | `src/data/site.json` — 비어 있는 칸(`null`)은 화면에 나오지 않습니다 |
| 계산기 이름·설명·주소 | `src/data/calculators.json` |
| 서비스 이름·설명·관련 계산기 | `src/data/services.json` |
| 자주 묻는 질문 | `src/content/faq/*.md` (파일 하나가 질문 하나) |

GitHub 웹에서 고치고 저장하면 검사(`check`)가 돌고, 틀린 곳이 있으면 파일 이름과 줄 번호를 알려 줍니다.

## 개발

```bash
npm ci
npm run dev      # 미리보기 (제목 글꼴은 build 뒤에만 잘려 나옵니다)
npm run build    # 자료 검사 → 빌드 → 제목 글꼴 자르기
npm test         # build 뒤에 실행
```
