# 부추 프로그램 데이터

`programs.json`은 프론트엔드와 백엔드가 함께 사용하는 초기 프로그램 목록입니다. 루트 객체는 `updatedAt`과 `programs`로 구성됩니다. 2026년 10월 14일 공식 공개 페이지를 검토해 4개 프로그램을 수록했습니다.

## 출처와 확인 범위

| 프로그램 | 공식 출처 | 확인한 내용 |
| --- | --- | --- |
| 쿠팡 파트너스 | [공식 홈](https://partners.coupang.com/), [쿠팡 공식 뉴스룸의 이용 사례](https://news.coupang.com/archives/21192/) | 상품 광고 링크를 통한 구매 실적과 수수료 구조, 블로그·사이트·SNS 활용 |
| 애드픽 쇼핑메이트 | [공식 홈](https://adpick.co.kr/), [쇼핑메이트 홍보 가이드](https://adpick.co.kr/?ac=guide&indexno=57&md=detail&tac=book), [공식 FAQ](https://adpick.co.kr/?ac=guide&tac=faq), [수익지급 정책](https://api.adpick.co.kr/?ac=guide&md=p3&tac=policy) | 제휴몰 상품 URL을 홍보 링크로 변환, 구매 기준 포인트 적립, 회원별 출금 조건 |
| 링크프라이스 | [서비스 소개](https://www.linkprice.com/affiliate/views/affiliate_marketing/linkprice_affiliate_marketing.html), [어필리에이트 이용절차](https://www.linkprice.com/affiliate/views/affiliate_marketing/affiliate_procedure.html) | 가입·심의, 광고주별 제휴 승인, 실적 링크·배너, 구매·회원가입 등의 성과 정산 |
| 텐핑 | [공식 홈과 초보 가이드 진입점](https://tenping.kr/) | 캠페인 유형, 상품 소문링크, 쇼핑 소개 활동의 무료 시작 안내, 캐시와 등급별 출금 안내 |

## 편집 원칙

- `verifiedAt`은 공개 자료를 검토한 날짜입니다. 로그인 후 계약 조건, 실제 회원 가입, 수익 지급 또는 개별 캠페인 참여를 검증했다는 뜻은 아닙니다.
- 쿠팡 파트너스와 애드픽은 검색에 공개된 공식 페이지 내용도 참고했습니다. 직접 요청 시 쿠팡 포털은 JavaScript 안내만 반환했고, 일부 애드픽 페이지는 접근 제한 응답을 반환했습니다. 쿠팡 공식 뉴스룸은 이용 구조에만 참고했으며 과거 인터뷰 내용을 현재 요율의 근거로 쓰지 않았습니다.
- `commission`은 보상 방식의 요약입니다. 변동 가능한 수수료율, 지급일, 최소 출금액과 예상 월수입을 고정 숫자로 제공하지 않습니다.
- `cost: "check"`는 유료라는 뜻이 아니라 비용과 가입 조건을 추가 확인해야 한다는 뜻입니다. 텐핑의 `free`는 공식 홈에 명시된 쇼핑 소개 활동에만 해당합니다.
- `difficulty`, `featured`, 태그와 요약 문구는 부추의 편집 기준입니다. 난이도는 링크 생성과 광고주 승인 등 절차를 고려한 참고 분류이며 공식 등급이나 수익 보장이 아닙니다.
- `channels`는 공개 자료에 등장한 활용 채널입니다. 모든 캠페인에서 해당 채널의 홍보가 허용된다는 의미는 아닙니다.
- `category: "affiliate"`는 주로 구매·가입 실적을 연결하는 제휴 링크 프로그램, `campaign`은 참여·클릭·설치 등 여러 유형의 캠페인을 탐색하는 플랫폼 분류입니다. 프로그램별 허용 행위와 성과 기준이 우선합니다.
- 모든 외부 URL은 공식 안내 주소입니다. 추천인 코드나 부추의 수익 추적 링크를 포함하지 않습니다. 부추에서는 직접 제휴 링크를 발급하거나 광고 의뢰·수익 정산을 대행하지 않습니다.
- `brandColor`와 `initials`는 목록 구분을 위한 자체 텍스트 표식입니다. 공식 로고 파일을 사용하지 않습니다.

## 필드

각 프로그램은 `slug`, `name`, `tagline`, `description`, `category`, `channels`, `cost`, `costLabel`, `commission`, `settlement`, `difficulty`, `featured`, `officialUrl`, `guideUrl`, `brandColor`, `initials`, `tags`, `highlights`, `steps`, `cautions`, `verifiedAt`을 가집니다. 새 항목을 추가할 때 같은 필드를 유지하고 공식 출처 및 확인 한계를 이 문서에 함께 기록하세요.
