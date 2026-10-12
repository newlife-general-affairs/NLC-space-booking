interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hidden -mx-4 px-4 pb-1" role="tablist">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-bold transition-colors flex items-center gap-1.5 ${
              active ? 'bg-primary text-primary-ink' : 'bg-surface-sunken text-ink-soft'
            }`}
          >
            {opt.label}
            {opt.count !== undefined && opt.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${active ? 'bg-white/20' : 'bg-white text-ink-faint'}`}>
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
