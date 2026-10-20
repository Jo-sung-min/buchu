# 부추 프로그램 데이터

`programs.json`은 프론트엔드와 백엔드가 함께 사용하는 초기 프로그램 목록입니다. 루트 객체는 `updatedAt`과 `programs`로 구성됩니다. 2026년 10월 14일 공식 공개 페이지를 검토해 4개 프로그램을 수록했고, 10월 18일 콘텐츠 수익·온라인 판매·재능 서비스·앱테크 분야 12개를 추가했으며, 같은 날 체험단·재택 알바(`home`) 분야 8개를 더했습니다. 손작업 재택 부업 항목은 특정 업체가 아니라 공고 유형을 설명하는 안내 항목이며 선입금 사기 주의가 핵심입니다. 10월 20일에는 수수료율이 높은 제휴 4개(올리브영 쇼핑 큐레이터, 무신사 큐레이터, 세시간전 크리에이터, NordVPN 어필리에이트)를 더하고, 모든 항목에 `minIncome`(최소 예상 수익)과 `ageGroups`(추천 나이대)를 넣었습니다. 같은 날 부업 정보의 ‘지역 인력사무소’ 탭과 함께 건설 일용근로(막노동) 안내 항목(`gig`)을 더했습니다. 이 항목은 특정 업체가 아니라 일 유형 안내이며, 지역별 등록 인력사무소 데이터는 `scripts/build-labor-offices.mjs`가 행정안전부 지방행정인허가데이터(유료직업소개소)를 받아 `frontend/public/labor-offices/`에 만듭니다.

## 출처와 확인 범위

| 프로그램 | 공식 출처 | 확인한 내용 |
| --- | --- | --- |
| 쿠팡 파트너스 | [공식 홈](https://partners.coupang.com/), [쿠팡 공식 뉴스룸의 이용 사례](https://news.coupang.com/archives/21192/) | 상품 광고 링크를 통한 구매 실적과 수수료 구조, 블로그·사이트·SNS 활용 |
| 애드픽 쇼핑메이트 | [공식 홈](https://adpick.co.kr/), [쇼핑메이트 홍보 가이드](https://adpick.co.kr/?ac=guide&indexno=57&md=detail&tac=book), [공식 FAQ](https://adpick.co.kr/?ac=guide&tac=faq), [수익지급 정책](https://api.adpick.co.kr/?ac=guide&md=p3&tac=policy) | 제휴몰 상품 URL을 홍보 링크로 변환, 구매 기준 포인트 적립, 회원별 출금 조건 |
| 링크프라이스 | [서비스 소개](https://www.linkprice.com/affiliate/views/affiliate_marketing/linkprice_affiliate_marketing.html), [어필리에이트 이용절차](https://www.linkprice.com/affiliate/views/affiliate_marketing/affiliate_procedure.html) | 가입·심의, 광고주별 제휴 승인, 실적 링크·배너, 구매·회원가입 등의 성과 정산 |
| 텐핑 | [공식 홈과 초보 가이드 진입점](https://tenping.kr/) | 캠페인 유형, 상품 소문링크, 쇼핑 소개 활동의 무료 시작 안내, 캐시와 등급별 출금 안내 |
| 구글 애드센스 | [공식 홈](https://adsense.google.com/), [고객센터](https://support.google.com/adsense/) | 사이트 등록·심사, 광고 노출·클릭 기준 수익, 지급 기준 금액과 세금 정보 등록 |
| 네이버 애드포스트 | [공식 홈](https://adpost.naver.com/) | 미디어 등록 심사, 광고 노출 기준 수익, 지급 조건 |
| 유튜브 파트너 프로그램 | [크리에이터 안내](https://www.youtube.com/creators/), [참여 조건 고객센터](https://support.google.com/youtube/answer/72851) | 참여 조건, 광고·멤버십·후원 수익원, 애드센스 연결 |
| 셔터스톡 컨트리뷰터 | [기여자 포털](https://submit.shutterstock.com/), [기여자 고객센터](https://support.submit.shutterstock.com/) | 콘텐츠 심사, 다운로드 기준 수익, 릴리즈 필요 조건 |
| 네이버 스마트스토어 | [판매자 센터](https://sell.smartstore.naver.com/) | 판매자 가입, 수수료·정산, 사업자 전환 안내 |
| 쿠팡 마켓플레이스 | [입점 안내](https://marketplace.coupangcorp.com/) | 사업자 기준 입점, 카테고리별 수수료, 정산 주기 |
| 크몽 | [공식 홈](https://kmong.com/) | 전문가 등록, 서비스 상품 판매, 거래 수수료 구간 |
| 숨고 | [공식 홈](https://soomgo.com/) | 고수 가입, 견적 발송 비용, 고객 직접 결제 구조 |
| 배민커넥트 | [공식 홈](https://www.baeminconnect.com/) | 운송 수단별 가입 조건, 교육·보험, 건당 배달료 |
| 알리익스프레스 어필리에이트 | [어필리에이트 포털](https://portals.aliexpress.com/) | 제휴 링크 생성, 구매 실적 수수료, 지급 수단 |
| 레뷰 | [공식 홈](https://www.revu.net/) | 채널 등록, 체험단 캠페인 신청·선정, 리뷰 등록 의무 |
| 패널나우 | [공식 홈](https://www.panelnow.co.kr/) | 설문 참여 포인트 적립, 현금·상품권 교환 조건 |
| 디너의여왕 | [공식 홈](https://dinnerqueen.net/) | 맛집·카페 체험단 신청·선정, 리뷰 등록 의무 |
| 리뷰플레이스 | [공식 홈](https://www.reviewplace.co.kr/) | 배송형·방문형 체험단, 리뷰 URL 제출 |
| 크라우드웍스 | [공식 홈](https://www.crowdworks.kr/) | 데이터 라벨링 작업 교육·참여, 검수 기준 보수 |
| 플리토 | [공식 홈](https://www.flitto.com/) | 집단지성 번역·언어 데이터 참여, 포인트 출금 |
| 아이디어스 | [공식 홈](https://www.idus.com/) | 핸드메이드 작가 입점 심사, 판매 수수료 |
| 손작업 재택 부업 | [알바천국](https://www.alba.co.kr/) 재택·부업 카테고리 | 특정 업체가 아닌 공고 유형 안내. 선입금 요구 사기 주의를 중심으로 기술 |
| 네이버 엑스퍼트 | [공식 홈](https://m.expert.naver.com/) | 분야별 입점 조건, 채팅·통화·화상 상담 정산 |
| 탈잉 | [공식 홈](https://taling.me/) | 튜터 등록, 1:1·그룹 클래스 개설, 수수료 |
| 올리브영 쇼핑 큐레이터 | [참여 신청](https://m.oliveyoung.co.kr/m/mtn/affiliate/apply), [활동 가이드](https://m.oliveyoung.co.kr/m/mtn/affiliate/guide) | 회원 누구나 참여, 상품 링크 생성·이해관계 표기 의무, 5천 원부터 매월 21일~말일 지급 신청·45일 내 지급. 7%/3% 요율은 [출시 보도](https://byline.network/2025/08/22_cjoliveyoung-4/) 기준 |
| 무신사 큐레이터 | [소개 페이지](https://www.musinsa.com/curator/intro/pro) | 가입 승인제, 판매 수수료 최대 10% 지원, 큐레이션 샵·상품 링크, 정산 대상자 월 쿠폰 |
| 세시간전 크리에이터 | [공식 홈](https://3hoursahead.com/ko), [도움말](https://help.3hoursahead.com/ko) | 제휴 링크 생성 절차, 최대 10% 커미션, 환율에 따른 정산 차이 안내 |
| NordVPN 어필리에이트 | [공식 어필리에이트](https://nordvpn.com/affiliate/) | 플랜별 수수료 표(1개월 신규 100%, 1년 신규 40%, 갱신 30%), 영어 가입·달러 정산 |

## 편집 원칙

- `verifiedAt`은 공개 자료를 검토한 날짜입니다. 로그인 후 계약 조건, 실제 회원 가입, 수익 지급 또는 개별 캠페인 참여를 검증했다는 뜻은 아닙니다.
- 쿠팡 파트너스와 애드픽은 검색에 공개된 공식 페이지 내용도 참고했습니다. 직접 요청 시 쿠팡 포털은 JavaScript 안내만 반환했고, 일부 애드픽 페이지는 접근 제한 응답을 반환했습니다. 쿠팡 공식 뉴스룸은 이용 구조에만 참고했으며 과거 인터뷰 내용을 현재 요율의 근거로 쓰지 않았습니다.
- `commission`은 보상 방식의 요약입니다. 변동 가능한 수수료율, 지급일, 최소 출금액과 예상 월수입을 고정 숫자로 제공하지 않습니다.
- `cost: "check"`는 유료라는 뜻이 아니라 비용과 가입 조건을 추가 확인해야 한다는 뜻입니다. 텐핑의 `free`는 공식 홈에 명시된 쇼핑 소개 활동에만 해당합니다.
- `minIncome`은 주 몇 시간 활동하는 입문자가 첫 몇 달 안에 기대할 만한 **보수적인 하한**을 부추 편집 기준으로 적은 값이며 수익 보장이 아닙니다. 카드와 상세에 "최소 예상 수익"으로 표시하고, 공식 수치가 아니라는 점을 상세 주의 사항에서 함께 안내합니다. `ageGroups`는 활동 채널·초기 비용·필요한 경험을 고려한 추천 나이대이며, 비어 있으면 누구에게나 보여 줍니다. 회원이 설정한 나이대와 맞는 부업을 부업 정보 목록에서 먼저 보여 주는 데 사용합니다.
- 운세·사주 서비스의 "수익 30% 쉐어"형 제휴는 2026년 10월 20일 기준 공개된 공식 조건을 확인하지 못해 수록하지 않았습니다. 해당 캠페인은 보통 애드픽·텐핑 같은 CPS 플랫폼에 개별 캠페인으로 올라오므로, 그 항목의 캠페인 목록에서 확인하도록 안내합니다.
- `difficulty`, `featured`, 태그와 요약 문구는 부추의 편집 기준입니다. 난이도는 링크 생성과 광고주 승인 등 절차를 고려한 참고 분류이며 공식 등급이나 수익 보장이 아닙니다.
- `channels`는 공개 자료에 등장한 활용 채널입니다. 모든 캠페인에서 해당 채널의 홍보가 허용된다는 의미는 아닙니다.
- `category: "affiliate"`는 주로 구매·가입 실적을 연결하는 제휴 링크 프로그램, `campaign`은 참여·클릭·설치·체험단 등 여러 유형의 캠페인을 탐색하는 플랫폼, `content`는 광고 게재·콘텐츠 판매로 수익을 내는 매체, `commerce`는 상품을 직접 판매하는 스토어, `gig`는 기술·노동 서비스를 제공하는 플랫폼, `home`은 집에서 하는 단순·데이터 작업 알바, `apptech`는 설문·적립형 앱 분류입니다. 프로그램별 허용 행위와 성과 기준이 우선합니다.
- 모든 외부 URL은 공식 안내 주소입니다. 추천인 코드나 부추의 수익 추적 링크를 포함하지 않습니다. 부추에서는 직접 제휴 링크를 발급하거나 광고 의뢰·수익 정산을 대행하지 않습니다.
- `brandColor`와 `initials`는 목록 구분을 위한 자체 텍스트 표식입니다. 공식 로고 파일을 사용하지 않습니다.

## 필드

각 프로그램은 `slug`, `name`, `tagline`, `description`, `category`, `channels`, `cost`, `costLabel`, `commission`, `settlement`, `difficulty`, `featured`, `officialUrl`, `guideUrl`, `brandColor`, `initials`, `tags`, `highlights`, `steps`, `cautions`, `verifiedAt`을 가집니다. 새 항목을 추가할 때 같은 필드를 유지하고 공식 출처 및 확인 한계를 이 문서에 함께 기록하세요.
