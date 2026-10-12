import { useEffect, useState } from 'react';
import { Share, Smartphone, X } from 'lucide-react';
import { Button, Sheet } from '../../ui';
import { hasDeferredInstallPrompt, isIOS, isStandalone, onInstallPromptReady, promptInstall } from './installPrompt';

const VISIT_KEY = 'member:visitCount';
const DISMISS_KEY = 'member:installBannerDismissed';
const MIN_VISITS_BEFORE_PROMPT = 2;

function bumpVisitCount(): number {
  const count = Number(localStorage.getItem(VISIT_KEY) || '0') + 1;
  localStorage.setItem(VISIT_KEY, String(count));
  return count;
}

export function InstallBanner() {
  const [ready, setReady] = useState(hasDeferredInstallPrompt());
  const [visits] = useState(bumpVisitCount);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const [showIOSSheet, setShowIOSSheet] = useState(false);

  useEffect(() => onInstallPromptReady(() => setReady(true)), []);

  const standalone = isStandalone();
  const ios = isIOS();
  const eligible = !standalone && !dismissed && visits >= MIN_VISITS_BEFORE_PROMPT && (ready || ios);

  if (!eligible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <>
      <div className="mb-4 flex items-center gap-3 p-3.5 bg-primary-soft rounded-2xl">
        <div className="w-9 h-9 rounded-xl bg-primary text-primary-ink flex items-center justify-center shrink-0">
          <Smartphone size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black text-ink">安裝到主畫面</div>
          <div className="text-[11px] text-ink-soft">像 App 一樣快速開啟，不需要每次打開瀏覽器</div>
        </div>
        <Button variant="primary" onClick={() => (ios ? setShowIOSSheet(true) : promptInstall())} className="!min-h-[36px] !px-3 text-xs shrink-0">
          安裝
        </Button>
        <button type="button" onClick={dismiss} className="text-ink-faint shrink-0" aria-label="關閉">
          <X size={16} />
        </button>
      </div>

      <Sheet open={showIOSSheet} onClose={() => setShowIOSSheet(false)} title="加入主畫面">
        <ol className="space-y-4 text-sm text-ink-soft">
          <li className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-primary-soft text-primary font-black flex items-center justify-center text-xs shrink-0">1</span>
            點擊瀏覽器底部的分享鈕 <Share size={16} className="text-primary shrink-0" />
          </li>
          <li className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-primary-soft text-primary font-black flex items-center justify-center text-xs shrink-0">2</span>
            選單中選擇「加入主畫面」
          </li>
          <li className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-primary-soft text-primary font-black flex items-center justify-center text-xs shrink-0">3</span>
            點擊右上角「新增」即完成
          </li>
        </ol>
      </Sheet>
    </>
  );
}
