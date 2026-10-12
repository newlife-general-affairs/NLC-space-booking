import { useState } from 'react';
import { Calendar, ChevronLeft, Megaphone } from 'lucide-react';
import type { Announcement } from '@church/shared/types';
import { EmptyState, ListRow, Sheet } from '../ui';

interface AnnouncementsPageProps {
  announcements: Announcement[];
  onBack?: () => void;
}

export default function AnnouncementsPage({ announcements, onBack }: AnnouncementsPageProps) {
  const [selected, setSelected] = useState<Announcement | null>(null);

  return (
    <div className="py-4">
      <div className="flex items-center gap-3 mb-5">
        {onBack && (
          <button onClick={onBack} className="text-ink-soft"><ChevronLeft size={20} /></button>
        )}
        <h2 className="text-lg font-black text-ink flex items-center gap-2">
          <Megaphone size={18} className="text-primary" /> 系統重要公告
        </h2>
      </div>

      {announcements.length === 0 ? (
        <EmptyState icon={Megaphone} title="目前尚無任何公告" />
      ) : (
        <div className="space-y-2.5">
          {announcements.map(a => (
            <ListRow
              key={a.id}
              onClick={() => setSelected(a)}
              icon={<Calendar size={16} />}
              title={a.title}
              subtitle={new Date(a.created_at).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })}
            />
          ))}
        </div>
      )}

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.title}>
        {selected && (
          <>
            <div className="text-xs text-ink-faint mb-4">
              發布日期：{new Date(selected.created_at).toLocaleString('zh-TW')}
            </div>
            <div className="text-sm text-ink-soft whitespace-pre-wrap leading-relaxed">{selected.content}</div>
          </>
        )}
      </Sheet>
    </div>
  );
}
