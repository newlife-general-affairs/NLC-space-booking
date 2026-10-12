import { AlertTriangle, ChevronLeft, CheckCircle2 } from 'lucide-react';
import type { StatusMsg } from '@church/shared/types';
import { Button, EmptyState, SelectField, TextAreaField } from '../ui';

interface SelectableItem { value: string; label: string; }

interface IssueReportPageProps {
  currentBranch: string;
  selectableItems: SelectableItem[];
  selectedTarget: string;
  description: string;
  submitting: boolean;
  statusMsg: StatusMsg;
  onTargetChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onSubmit: () => void;
  onContinue: () => void;
  onBack: () => void;
  backLabel?: string;
}

export default function IssueReportPage({
  currentBranch, selectableItems, selectedTarget, description,
  submitting, statusMsg,
  onTargetChange, onDescriptionChange, onSubmit, onContinue, onBack,
  backLabel,
}: IssueReportPageProps) {
  const isSuccess = statusMsg?.type === 'success';

  return (
    <div className="py-4">
      {!isSuccess && (
        <button onClick={onBack} className="text-sm font-bold text-ink-soft flex items-center gap-1 mb-4">
          <ChevronLeft size={16} /> 返回{backLabel || '首頁'}
        </button>
      )}

      {isSuccess ? (
        <div className="text-center py-8 space-y-6">
          <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={30} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-ink">問題回報成功！</h2>
            <p className="text-ink-soft text-sm leading-relaxed">
              感謝您的協助！管理同工已收到您的異常通報，將會儘速進行維護處理。您可以在「我的租借記錄」中追蹤處理狀態。
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button variant="primary" fullWidth onClick={onBack}>返回{backLabel || '首頁'}</Button>
            <Button variant="ghost" fullWidth onClick={onContinue}>繼續回報其他問題</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-warning/10 text-warning rounded-2xl flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-ink">回報場地狀況</h2>
              <p className="text-ink-faint text-xs mt-0.5">回報「{currentBranch}」的場地設備、燈具或清潔等異常問題</p>
            </div>
          </div>

          {statusMsg?.text && statusMsg?.type === 'error' && (
            <div className="p-3.5 rounded-xl font-bold flex items-center gap-2.5 bg-danger/10 text-danger text-sm">
              <span className="shrink-0">⚠️</span>
              <span>{statusMsg.text}</span>
            </div>
          )}

          {!selectableItems || selectableItems.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="您目前在此據點沒有可回報的場地或空間" />
          ) : (
            <form onSubmit={e => { e.preventDefault(); onSubmit(); }} className="space-y-4">
              <SelectField label="選擇發生問題的場地或空間" required value={selectedTarget} onChange={e => onTargetChange(e.target.value)}>
                <option value="" disabled>請選擇場地或空間</option>
                {selectableItems.map(item => (
                  <option key={item?.value} value={item?.value}>{item?.label}</option>
                ))}
              </SelectField>

              <TextAreaField
                label="問題詳細描述"
                required
                rows={4}
                value={description}
                onChange={e => onDescriptionChange(e.target.value)}
                placeholder="請詳細描述設備、清潔或門鎖等問題（例如：冷氣不冷、麥克風沒電、投影機沒畫面...）"
              />

              <Button type="submit" variant="primary" fullWidth loading={submitting}>
                {submitting ? '傳送中…' : '送出回報'}
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
