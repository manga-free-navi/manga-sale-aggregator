'use client';

import React, { useState, useEffect, useRef } from 'react';

interface LazyRenderProps {
  children: React.ReactNode;
}

export default function LazyRender({ children }: LazyRenderProps) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsIntersecting(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect(); // 一度表示されたら監視を終了
        }
      },
      {
        rootMargin: '250px', // 画面に入る250px手前でレンダリング開始
      }
    );

    const currentRef = containerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // 漫画カードの高さは約 450px 前後なので、仮に 450px を最小高さとして確保
  return (
    <div ref={containerRef} style={{ minHeight: isIntersecting ? 'auto' : '450px', width: '100%', display: 'contents' }}>
      {isIntersecting ? children : (
        <div className="lazy-placeholder" style={{
          width: '100%',
          height: '450px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '12px',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
          boxSizing: 'border-box'
        }} />
      )}
    </div>
  );
}
