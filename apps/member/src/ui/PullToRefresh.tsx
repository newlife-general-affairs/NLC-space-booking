import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
}

const THRESHOLD = 64;

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if ((containerRef.current?.scrollTop ?? 0) > 0) return;
    startY.current = e.touches[0].clientY;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setPull(Math.min(delta * 0.5, THRESHOLD * 1.4));
  };

  const onTouchEnd = async () => {
    if (pull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPull(0);
    startY.current = null;
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ transform: pull ? `translateY(${pull}px)` : undefined, transition: pull ? 'none' : 'transform .2s ease' }}
    >
      <div
        className="flex items-center justify-center text-ink-faint overflow-hidden transition-[height] duration-150"
        style={{ height: refreshing ? 40 : pull }}
        aria-hidden="true"
      >
        <RefreshCw size={16} className={refreshing || pull >= THRESHOLD ? 'animate-spin' : ''} />
      </div>
      {children}
    </div>
  );
}
