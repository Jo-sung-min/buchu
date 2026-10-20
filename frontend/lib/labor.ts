/** 지역별 막노동(건설 일용근로) 창구: 등록 인력사무소 데이터와 공식 지원 기관. */

/** scripts/build-labor-offices.mjs가 만든 frontend/public/labor-offices/*.json 의 형태. */
export interface LaborOffice {
  /** 사업장명 */ n: string;
  /** 주소(도로명, 없으면 지번) */ a: string;
  /** 전화 (등록된 곳만) */ t: string;
  /** 인허가일 */ d: string;
  /** 시군구 */ g: string;
  /** 이름으로 보아 건설·일용 인력사무소로 추정되는지 */ l: boolean;
}
export interface LaborDistrict { name: string; count: number; laborCount: number }
export interface LaborSido { key: string; name: string; count: number; laborCount: number; districts: LaborDistrict[] }
export interface LaborIndex { updatedAt: string; source: string; total: number; laborTotal: number; sidos: LaborSido[] }
export interface LaborSidoFile { key: string; name: string; updatedAt: string; offices: LaborOffice[] }

export const laborSource = {
  name: "행정안전부 지방행정인허가데이터 · 유료직업소개소 현황",
  url: "https://www.data.go.kr/data/15045101/fileData.do",
};

/** 건설근로자공제회 지사·센터. 전국 대표번호 1666-1122 뒤에 내선을 누른다. 2026-10 공제회 홈페이지 위치 안내 기준. */
export interface LaborCenter { name: string; address: string; extension: string; covers: string }
export const laborCenters: Record<string, LaborCenter[]> = {
  seoul: [
    { name: "건설근로자공제회 서울지사", address: "서울 마포구 마포대로 45, 3층(일진빌딩)", extension: "311", covers: "종로·중구·용산·성동·광진·동대문·중랑·성북·강북·도봉·노원·은평·서대문·마포·서초·송파·강동" },
    { name: "건설근로자공제회 서울남부센터", address: "서울 금천구 가산디지털1로 131, 1층", extension: "315", covers: "강남·강서·관악·구로·금천·동작·양천·영등포" },
  ],
  gyeonggi: [
    { name: "건설근로자공제회 경기지사", address: "경기 수원시 팔달구 권광로 199, 15층", extension: "313", covers: "수원·성남·용인·화성·평택·안양·안성·오산·이천·여주·광주·하남·군포·의왕·과천·양평" },
    { name: "건설근로자공제회 의정부센터", address: "경기 의정부시 시민로 62, 5층", extension: "314", covers: "의정부·남양주·구리·양주·동두천·포천·파주·연천·가평" },
    { name: "건설근로자공제회 인천지사", address: "인천 남동구 미래로 7, 2층(현대해상 건물)", extension: "312", covers: "김포·부천·시흥·안산·광명·고양" },
  ],
  incheon: [{ name: "건설근로자공제회 인천지사", address: "인천 남동구 미래로 7, 2층(현대해상 건물)", extension: "312", covers: "인천 전역" }],
  busan: [{ name: "건설근로자공제회 부산지사", address: "부산 동구 중앙대로 240, 7층", extension: "321", covers: "부산·울산, 김해·밀양·양산" }],
  ulsan: [{ name: "건설근로자공제회 부산지사", address: "부산 동구 중앙대로 240, 7층", extension: "321", covers: "울산 전역" }],
  gyeongnam: [
    { name: "건설근로자공제회 창원센터", address: "경남 창원시 성산구 중앙대로 257, 2층(경남무역회관)", extension: "323", covers: "경남(김해·밀양·양산 제외)" },
    { name: "건설근로자공제회 부산지사", address: "부산 동구 중앙대로 240, 7층", extension: "321", covers: "김해·밀양·양산" },
  ],
  daegu: [{ name: "건설근로자공제회 대구지사", address: "대구 중구 달구벌대로 2058, 11층(ABL대구타워)", extension: "322", covers: "대구 전역" }],
  gyeongbuk: [
    { name: "건설근로자공제회 대구지사", address: "대구 중구 달구벌대로 2058, 11층(ABL대구타워)", extension: "322", covers: "포항·경주·김천·구미·영천·경산·청도·고령·성주·칠곡·울릉" },
    { name: "건설근로자공제회 안동센터", address: "경북 안동시 경북대로 367, 1층(시온빌딩)", extension: "324", covers: "안동·문경·봉화·상주·영덕·영양·영주·예천·울진·의성·청송" },
  ],
  "gwangju-jeonnam": [{ name: "건설근로자공제회 광주지사", address: "광주 서구 시청로 30, 7층", extension: "331", covers: "광주·전남 전역" }],
  jeonbuk: [{ name: "건설근로자공제회 전주센터", address: "전북 전주시 완산구 백제대로 280, 2층", extension: "332", covers: "전북 전역" }],
  jeju: [{ name: "건설근로자공제회 제주센터", address: "제주 제주시 중앙로 150, 5층", extension: "333", covers: "제주 전역" }],
  daejeon: [{ name: "건설근로자공제회 대전지사", address: "대전 서구 둔산북로 56, 11층", extension: "341", covers: "대전·세종·충남" }],
  sejong: [{ name: "건설근로자공제회 대전지사", address: "대전 서구 둔산북로 56, 11층", extension: "341", covers: "세종 전역" }],
  chungnam: [{ name: "건설근로자공제회 대전지사", address: "대전 서구 둔산북로 56, 11층", extension: "341", covers: "충남 전역" }],
  chungbuk: [{ name: "건설근로자공제회 청주센터", address: "충북 청주시 흥덕구 풍산로 50, 6층(충북지방기업진흥원)", extension: "342", covers: "충북 전역" }],
  gangwon: [{ name: "건설근로자공제회 원주센터", address: "강원 원주시 시청로 2, 2층", extension: "342", covers: "강원 전역" }],
};

/** 지역을 고르면 그 지역 일용·건설 구인 글로 바로 가는 공식·대형 구인 창구. 긁어오지 않고 링크만 건다. */
export interface LaborSite { name: string; url: string; note: string; official?: boolean }
export const laborSites: LaborSite[] = [
  { name: "고용24 (워크넷)", url: "https://www.work24.go.kr/", note: "고용노동부 공식 채용정보. 지역·직종에서 건설·단순노무를 고르면 일용 공고가 나와요.", official: true },
  { name: "건설근로자공제회 취업지원", url: "https://www.cw.or.kr/", note: "건설 일용근로자 전용 취업 알선과 퇴직공제 안내. 지사·센터 방문 상담도 가능해요.", official: true },
  { name: "건설워커", url: "https://www.worker.co.kr/", note: "건설 현장 구인 전문 사이트. 지역별 현장 공고를 볼 수 있어요." },
  { name: "알바천국", url: "https://www.alba.co.kr/", note: "지역 검색 뒤 ‘건설·노무’ 업직종을 고르면 단기 일용 공고가 모여요." },
  { name: "알바몬", url: "https://www.albamon.com/", note: "지역·업직종 ‘생산·건설·노무’로 걸러 단기 일용 공고를 볼 수 있어요." },
];

/** 인력사무소 이용 전 확인할 것. 수치는 바뀔 수 있어 고시 확인을 안내한다. */
export const laborCautions = [
  "유료직업소개소는 시·군·구에 등록된 곳만 합법이에요. 이 목록은 등록된 영업 중 사무소만 담았어요.",
  "소개요금은 고용노동부 고시로 상한이 정해져 있고 구직자 부담분은 매우 적어요. 일당에서 임의로 떼거나 선입금을 요구하면 피하세요.",
  "건설 현장 일을 하면 사업주가 건설근로자 퇴직공제에 가입해 하루마다 공제부금이 쌓여요. 근로일수가 쌓이는지 공제회에서 확인하세요.",
  "임금 미지급이나 부당한 요금은 고용노동부 고객상담센터 1350, 등록 관청(시·군·구 일자리 담당 부서)에 신고할 수 있어요.",
];

export function mapSearchUrl(office: LaborOffice): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(`${office.n} ${office.a.split(",")[0]}`)}`;
}
