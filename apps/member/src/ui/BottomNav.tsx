import type { LucideIcon } from 'lucide-react';

interface NavItem<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

interface BottomNavProps<T extends string> {
  items: NavItem<T>[];
  active: string;
  onChange: (id: T) => void;
}

export function BottomNav<T extends string>({ items, active, onChange }: BottomNavProps<T>) {
  return (
    <nav className="mobile-app-nav" aria-label="主要功能">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={active === id ? 'is-active' : ''}
          aria-current={active === id ? 'page' : undefined}
        >
          <Icon size={20} strokeWidth={active === id ? 2.5 : 2} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
