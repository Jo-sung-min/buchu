import Link from "next/link";
import { BuchuMark } from "@/components/icons";
export default function NotFound() {
  return <div className="container empty-state not-found"><BuchuMark size={50} /><h1>아직 싹이 트지 않은 페이지예요.</h1><p>주소를 다시 확인하거나, 다른 부업을 살펴보세요.</p><Link href="/" className="button button-green">부추 홈으로 돌아가기</Link></div>;
}
