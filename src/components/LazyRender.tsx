'use client';

import React from 'react';

interface LazyRenderProps {
  children: React.ReactNode;
}

export default function LazyRender({ children }: LazyRenderProps) {
  // display: contents を伴うラッパー要素に IntersectionObserver を適用すると、
  // レイアウト上のサイズが0になり交差を検知できなくなる不具合が発生します。
  // 今回のデータ量（数十件程度）では遅延レンダリングによるパフォーマンス向上は不要なため、
  // 常に即時レンダリングを行うように修正します。
  return <>{children}</>;
}
