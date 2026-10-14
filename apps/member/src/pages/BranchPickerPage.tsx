import { Building2, ChevronRight, MapPin } from 'lucide-react';
import { BRANCHES } from '@church/shared/constants';

interface BranchPickerPageProps {
  onSelectBranch: (branch: string) => void;
}

export default function BranchPickerPage({ onSelectBranch }: BranchPickerPageProps) {
  return (
    <div className="py-8 flex flex-col items-center animate-fade-up">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary text-primary-ink rounded-3xl shadow-card mb-4">
          <Building2 size={30} />
        </div>
        <h2 className="text-xl font-black tracking-tight text-ink mb-2">主內同工與會眾場地預借</h2>
        <p className="text-ink-soft text-xs leading-relaxed max-w-xs mx-auto">
          歡迎使用雲端場地租借系統，請點擊下方您所在的聚會據點進入。
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 w-full">
        {BRANCHES.map((branch, idx) => (
          <button
            key={branch}
            onClick={() => onSelectBranch(branch)}
            className="card card-hover flex flex-col items-center gap-3 p-5 min-h-[148px] justify-center animate-fade-up"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <div className="w-11 h-11 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
              <MapPin size={20} />
            </div>
            <div className="text-base font-black text-ink">{branch}</div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-primary">
              進入 <ChevronRight size={12} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
