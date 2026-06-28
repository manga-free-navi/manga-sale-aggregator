'use client';

import React, { useState, useEffect, useRef } from 'react';

interface LazyRenderProps {
  children: React.ReactNode;
}

export default function LazyRender({ children }: LazyRenderProps) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '300px', // 画面に入る300px手前でプリロードしてスクロール時のガタつきを防ぐ
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{
        width: '100%',
        height: '100%',
        minHeight: isIntersecting ? 'auto' : '380px',
        boxSizing: 'border-box'
      }}
    >
      {isIntersecting ? (
        children
      ) : (
        // ロード完了前は実体プレースホルダー（高さ380px）を描画して高さを確保する
        <div
          className="lazy-placeholder"
          style={{
            width: '100%',
            height: '380px', // BookCardの標準的な高さ
            background: 'rgba(30, 41, 59, 0.4)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );
}
