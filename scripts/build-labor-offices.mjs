// 전국 유료직업소개소(인력사무소) 공개 데이터를 받아 시도별 JSON으로 가공한다.
// 출처: 행정안전부 지방행정인허가데이터(LOCALDATA) "기타_유료직업소개소" — 이용허락범위 제한 없음, 매일 갱신.
//   https://www.data.go.kr/data/15045101/fileData.do (파일: https://file.localdata.go.kr/file/download/paid_job_centers/info)
// 결과: frontend/public/labor-offices/index.json (시도·시군구 목록과 건수), <시도키>.json (영업 중인 사무소 목록)
// 사용: node scripts/build-labor-offices.mjs            # 내려받아 가공
//       node scripts/build-labor-offices.mjs --from 경로/기타_유료직업소개소.csv   # 받아둔 CSV로 가공
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://file.localdata.go.kr/file/download/paid_job_centers/info";
const SOURCE_PAGE = "https://www.data.go.kr/data/15045101/fileData.do";
const root = fileURLToPath(new URL("../", import.meta.url));
const outDir = path.join(root, "frontend", "public", "labor-offices");

/** 주소 첫 어절(시도) → 파일 키·표시 이름. 옛 이름은 현재 이름으로 합친다. */
const SIDO = [
  ["서울특별시", "seoul", "서울"], ["부산광역시", "busan", "부산"], ["대구광역시", "daegu", "대구"], ["인천광역시", "incheon", "인천"],
  ["전남광주통합특별시", "gwangju-jeonnam", "광주·전남"], ["광주광역시", "gwangju-jeonnam", "광주·전남"], ["전라남도", "gwangju-jeonnam", "광주·전남"],
  ["대전광역시", "daejeon", "대전"], ["울산광역시", "ulsan", "울산"], ["세종특별자치시", "sejong", "세종"], ["경기도", "gyeonggi", "경기"],
  ["강원특별자치도", "gangwon", "강원"], ["강원도", "gangwon", "강원"], ["충청북도", "chungbuk", "충북"], ["충청남도", "chungnam", "충남"],
  ["전북특별자치도", "jeonbuk", "전북"], ["전라북도", "jeonbuk", "전북"], ["경상북도", "gyeongbuk", "경북"], ["경상남도", "gyeongnam", "경남"],
  ["제주특별자치도", "jeju", "제주"],
];
const SIDO_ORDER = ["seoul", "gyeonggi", "incheon", "busan", "daegu", "gwangju-jeonnam", "daejeon", "ulsan", "sejong", "gangwon", "chungbuk", "chungnam", "jeonbuk", "gyeongbuk", "gyeongnam", "jeju"];
/** 이름만으로 건설·일용 인력사무소로 보이는 곳. 간병·가사·파출, 헤드헌팅·컨설팅 회사는 뺀다. 기본 필터로 쓴다. */
const LABOR_NAME = /인력|건설|용역|일용|노무|인부|새벽|기공|토목|철근|비계|형틀|목수|조공|잡부/;
const NOT_LABOR_NAME = /파출|가사|간병|요양|베이비|산후|돌봄|써치|서치|컨설팅|헤드헌|에이치알|HR|리크루트|리쿠르트|아웃소싱|선원|해외|유학|간호|병원|여성인력개발/i;
const laborLike = name => LABOR_NAME.test(name) && !NOT_LABOR_NAME.test(name);

function parseCsv(text) {
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.length > 1);
}

function phone(raw) {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 11) return digits || "";
  if (digits.startsWith("02")) return digits.length === 9 ? `02-${digits.slice(2, 5)}-${digits.slice(5)}` : `02-${digits.slice(2, 6)}-${digits.slice(6)}`;
  return digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

async function loadCsv() {
  const fromIndex = process.argv.indexOf("--from");
  const bytes = fromIndex >= 0
    ? readFileSync(path.resolve(process.argv[fromIndex + 1]))
    : Buffer.from(await (await fetch(SOURCE_URL, { headers: { Referer: "https://file.localdata.go.kr/file/paid_job_centers/info", "User-Agent": "Mozilla/5.0 buchu-build" } })).arrayBuffer());
  // 파일은 CP949(EUC-KR)로 내려온다. UTF-8로 읽혔으면 그대로 쓴다.
  const utf8 = bytes.toString("utf8");
  return utf8.includes("사업장명") ? utf8.replace(/^﻿/, "") : new TextDecoder("euc-kr").decode(bytes);
}

const rows = parseCsv(await loadCsv());
const header = rows[0].map(h => h.trim());
const col = name => { const i = header.indexOf(name); if (i < 0) throw new Error(`컬럼이 없습니다: ${name}`); return i; };
const C = { state: col("영업상태명"), name: col("사업장명"), road: col("도로명주소"), lot: col("지번주소"), tel: col("전화번호"), licensed: col("인허가일자"), updated: col("데이터갱신시점") };

const bySido = new Map(SIDO_ORDER.map(key => [key, { key, name: SIDO.find(s => s[1] === key)[2], offices: [] }]));
let latest = "", open = 0, skipped = 0;
for (const r of rows.slice(1)) {
  if ((r[C.state] || "").trim() !== "영업/정상") continue;
  open++;
  const address = ((r[C.road] || "").trim() || (r[C.lot] || "").trim()).replace(/\s+/g, " ");
  const tokens = address.split(" ");
  const sido = SIDO.find(s => s[0] === tokens[0]);
  if (!sido || !address) { skipped++; continue; }
  const name = (r[C.name] || "").trim().replace(/\s+/g, " ");
  // 시군구는 둘째 어절. "고양시일산구"처럼 붙어 있으면 앞의 시까지만, 도로명이 바로 오면 "기타"로 둔다.
  const district = sido[1] === "sejong" ? "세종시" : ((tokens[1] || "").match(/^(.+?[시군구])(?=[^시군구]|$)/)?.[1] || "기타");
  if (r[C.updated] > latest) latest = r[C.updated];
  bySido.get(sido[1]).offices.push({ n: name, a: address, t: phone(r[C.tel]), d: (r[C.licensed] || "").trim().slice(0, 10), g: district, l: laborLike(name) });
}

mkdirSync(outDir, { recursive: true });
const updatedAt = (latest || new Date().toISOString()).slice(0, 10);
const index = { updatedAt, source: SOURCE_PAGE, total: 0, laborTotal: 0, sidos: [] };
for (const key of SIDO_ORDER) {
  const sido = bySido.get(key);
  sido.offices.sort((a, b) => a.g.localeCompare(b.g, "ko") || a.n.localeCompare(b.n, "ko"));
  const districts = new Map();
  for (const o of sido.offices) { const d = districts.get(o.g) || { name: o.g, count: 0, laborCount: 0 }; d.count++; if (o.l) d.laborCount++; districts.set(o.g, d); }
  const laborCount = sido.offices.filter(o => o.l).length;
  index.total += sido.offices.length; index.laborTotal += laborCount;
  index.sidos.push({ key, name: sido.name, count: sido.offices.length, laborCount, districts: [...districts.values()].sort((a, b) => a.name.localeCompare(b.name, "ko")) });
  writeFileSync(path.join(outDir, `${key}.json`), JSON.stringify({ key, name: sido.name, updatedAt, offices: sido.offices }));
}
writeFileSync(path.join(outDir, "index.json"), JSON.stringify(index, null, 1));
console.log(`영업 중 ${open}곳 중 ${index.total}곳 기록(주소 불명 ${skipped}곳 제외), 인력사무소 추정 ${index.laborTotal}곳, 기준일 ${updatedAt} → ${path.relative(root, outDir)}`);
