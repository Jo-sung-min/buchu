"use client";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <div className="container empty-state not-found"><h1>잠시 정보를 불러오지 못했어요.</h1><p>잠시 후 다시 시도해 주세요.</p><button className="button button-green" onClick={reset}>다시 시도하기</button></div>;
}
