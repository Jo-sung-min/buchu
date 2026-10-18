import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "처음 시작하는 제휴마케팅 가이드", description: "서비스 선택부터 링크 발급, 콘텐츠 작성, 성과 확인까지. 제휴마케팅의 첫걸음을 함께해요." };
const steps = [
  { title: "나에게 맞는 서비스 찾기", text: "평소 관심 있는 상품과 내가 운영하는 채널을 먼저 떠올려 보세요. 부추에서 서비스를 비교한 뒤, 공식 사이트에서 가입 대상과 채널 심사 조건을 확인하세요.", tip: "처음에는 익숙한 채널 하나에 집중해 보세요." },
  { title: "가입하고, 나만의 링크 만들기", text: "선택한 서비스에서 회원가입과 필요한 채널 등록을 진행하세요. 참여 승인을 받은 뒤 소개하고 싶은 상품이나 캠페인을 골라, 서비스가 제공하는 제휴 링크를 발급받으세요.", tip: "부추에서는 제휴 링크를 발급하지 않아요. 각 공식 서비스에서 만들 수 있어요." },
  { title: "도움이 되는 콘텐츠로 추천하기", text: "누구에게 도움이 되는지, 어떤 점을 비교하면 좋은지 내 관점으로 소개하세요. 직접 사용하지 않았다면 사용 후기처럼 표현하지 마세요. 제휴 관계가 있다는 사실을 독자가 쉽게 알 수 있도록, 서비스의 최신 광고 표시 안내를 따라 주세요.", tip: "링크를 올리기 전에 활동 채널과 서비스 양쪽의 게시 정책을 확인해요." },
  { title: "성과를 확인하고, 조금씩 개선하기", text: "공식 서비스의 성과 화면에서 클릭과 전환, 승인 상태를 확인하세요. 클릭만으로 수익이 발생하지 않을 수 있고, 취소나 반품으로 성과가 달라질 수 있어요. 정산 조건과 지급 일정도 함께 살펴보세요.", tip: "예상 성과와 최종 정산 금액은 다를 수 있어요. 수익을 보장하는 부업은 아니에요." },
];
export default function GuidePage() {
  return <div className="guide-page"><div className="guide-hero"><div className="container"><span className="eyebrow"><span />처음 시작하는 당신을 위해</span><h1>링크 하나에서 시작하는<br /><span>나의 첫 제휴마케팅.</span></h1><p>거창한 준비보다, 나다운 추천 하나.<br />부추와 함께 순서대로 살펴보세요.</p><div className="guide-meta"><Icon name="book" size={16} />입문 가이드<span>·</span>4단계로 알아보기</div></div></div><div className="guide-content"><section className="guide-definition"><span className="section-kicker">AFFILIATE MARKETING</span><h2>제휴마케팅이 무엇인가요?</h2><p>상품이나 서비스를 나만의 제휴 링크로 소개하고, 그 링크를 통해 구매 등 정해진 성과가 발생하면 조건에 따라 보상을 받는 활동이에요. 콘텐츠를 만드는 사람, 상품을 판매하는 곳, 추천을 보고 선택하는 사람이 연결됩니다.</p><div className="flow-row"><span><Icon name="link" />링크 발급</span><Icon name="arrow" size={18} /><span><Icon name="heart" />콘텐츠로 추천</span><Icon name="arrow" size={18} /><span><Icon name="leaf" />성과 확인</span></div></section><ol className="guide-steps">{steps.map((step, i) => <li key={step.title}><span className="guide-step-number">0{i + 1}</span><div><h2>{step.title}</h2><p>{step.text}</p><div className="guide-tip"><Icon name="spark" size={17} />{step.tip}</div></div></li>)}</ol><section className="guide-checklist"><h2>첫 링크를 올리기 전, 체크!</h2><ul>{["공식 서비스의 가입·승인 조건을 확인했나요?", "내 채널에서 허용되는 홍보 방식인가요?", "제휴 관계에 대한 안내를 알아보기 쉽게 표시했나요?", "수수료·취소·정산 조건을 확인했나요?"].map(item => <li key={item}><Icon name="check" size={17} />{item}</li>)}</ul></section><div className="guide-end"><h2>이제, 나에게 맞는 부업을 만나볼까요?</h2><Link href="/programs#discover" className="button button-green">부업 정보 둘러보기 <Icon name="arrow" size={18} /></Link></div></div></div>;
}
