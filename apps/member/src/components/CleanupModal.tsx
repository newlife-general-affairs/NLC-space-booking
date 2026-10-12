import { useState, useRef } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Star, UploadCloud, CheckCircle } from 'lucide-react';
import type { Booking } from '@church/shared/types';
import { apiCompleteUsage } from '@church/shared/api';
import { Button, Sheet } from '../ui';

interface CleanupModalProps {
  booking: Booking;
  getToken: () => string;
  onSuccess: (msg: string) => void;
  onClose: () => void;
  onRefresh: () => void;
}

const BASE_CHECKLIST = {
  powerOff: false,
  trashSorted: false,
  tablesRestored: false,
  audioOff: false,
  doorsLocked: false,
};

export default function CleanupModal({ booking, getToken, onSuccess, onClose, onRefresh }: CleanupModalProps) {
  const rawAssignments = booking.cleaning_assignments || '';
  const parts = rawAssignments.split('::');
  const spacesList = parts[0] || '';
  const assignState = parts[1] || '';
  const progressKeys = parts[2] ? parts[2].split(',') : [];
  const isRejected = assignState === 'rejected';

  const assignedSpaces = spacesList
    ? spacesList.split(',').map(s => s.trim()).filter(s => s && s !== '無另外分配')
    : [];

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = { ...BASE_CHECKLIST };
    assignedSpaces.forEach(space => { init[`cleaning_${space}`] = false; });
    progressKeys.forEach((key: string) => {
      if (key in init || key.startsWith('cleaning_')) init[key] = true;
    });
    return init;
  });

  const isAllChecked = Object.values(checklist).every(v => v === true);
  const toggle = (key: string, checked: boolean) => setChecklist(prev => ({ ...prev, [key]: checked }));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; preview: string } | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('請上傳照片檔案！');
      return;
    }
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev === null || prev >= 100) {
          clearInterval(interval);
          setUploadedFile({ name: file.name, size: `${(file.size / 1024 / 1024).toFixed(2)} MB`, preview: URL.createObjectURL(file) });
          return null;
        }
        return prev + 25;
      });
    }, 150);
  };

  const handleDragOver = (e: DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const res = await apiCompleteUsage(getToken(), booking.id);
      const data = await res.json();
      if (res.ok) {
        setStep(3);
        setTimeout(() => { onSuccess('🎉 ' + data.message); onClose(); onRefresh(); }, 2200);
      } else {
        alert(data.error || '歸還失敗，請重試');
      }
    } catch {
      alert('網路連線異常，請稍後重試');
    } finally {
      setSubmitting(false);
    }
  };

  const renderCheckItem = (key: string, label: string, desc: string, checked: boolean) => (
    <label key={key} className="flex items-start gap-3.5 cursor-pointer p-3.5 bg-surface-sunken rounded-xl">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => toggle(key, e.target.checked)}
        className="mt-0.5 w-5 h-5 rounded-md accent-primary shrink-0"
      />
      <div className="select-none flex-1">
        <div className="text-xs font-bold text-ink">{label}</div>
        <div className="text-[10px] text-ink-faint mt-0.5 leading-normal">{desc}</div>
      </div>
    </label>
  );

  const footer = step === 3 ? undefined : step === 1 ? (
    <div className="flex gap-3">
      <Button variant="ghost" fullWidth onClick={onClose}>取消</Button>
      <Button variant="primary" fullWidth disabled={!isAllChecked} onClick={() => setStep(2)}>下一步：拍照回報</Button>
    </div>
  ) : (
    <div className="flex gap-3">
      <Button variant="ghost" fullWidth disabled={submitting} onClick={() => setStep(1)}>上一步</Button>
      <Button variant="primary" fullWidth loading={submitting} onClick={handleConfirm}>
        {!submitting && <CheckCircle size={14} />} 確認完成並歸還
      </Button>
    </div>
  );

  return (
    <Sheet
      open
      onClose={onClose}
      dismissible={step !== 3}
      title={step === 3 ? undefined : (isRejected ? '場地使用複檢確認' : '場地完畢與收拾檢查')}
      footer={footer}
    >
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="space-y-4">
            <p className="text-ink-soft text-xs leading-normal">
              {isRejected ? (
                <>為您保留上次合格項目，請針對<strong className="text-danger">未勾選的項目</strong>完成打掃以符合覆檢規範：</>
              ) : (
                <>感謝借用 <strong className="text-primary">{booking.room_name}</strong>。為了確保下一位使用者權益，請確認收拾完成：</>
              )}
            </p>

            <div className="space-y-2.5">
              {renderCheckItem('powerOff', '電源與電器關閉', '已關閉冷氣、電燈、投影機及其他電器電源', !!checklist.powerOff)}
              {renderCheckItem('tablesRestored', '桌椅收拾歸位', '已將桌子、椅子排列整齊，並放回原本的使用位置', !!checklist.tablesRestored)}
              {renderCheckItem('trashSorted', '垃圾分類與帶走', '已將垃圾、回收分類，並將廢棄物包妥順手帶走', !!checklist.trashSorted)}
              {renderCheckItem('audioOff', '音響及麥克風設備', '已關閉麥克風、擴大機及音響電源，並將器材歸位', !!checklist.audioOff)}
              {renderCheckItem('doorsLocked', '門窗上鎖確認', '已確認關閉所有氣密窗及出入口門禁', !!checklist.doorsLocked)}

              {assignedSpaces.length > 0 && (
                <div className="border-t border-border pt-3 mt-2 space-y-2.5">
                  <div className="text-[10px] font-bold text-success tracking-wider uppercase">公共區域打掃分配</div>
                  {assignedSpaces.map(space =>
                    renderCheckItem(`cleaning_${space}`, `公共區打掃：${space}`, '此公共空間已指派由您打掃，已確實恢復清潔', !!checklist[`cleaning_${space}`])
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.25 }} className="space-y-4">
            <p className="text-ink-soft text-xs leading-normal">請提供一張場地整齊照片以加速審核。您也可以給予本次使用評分。</p>

            <div className="space-y-1.5">
              <label className="label">復歸狀況照</label>
              <div
                role="button"
                tabIndex={0}
                aria-label="上傳復歸狀況照"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  dragOver ? 'border-primary bg-primary-soft' : uploadedFile ? 'border-border bg-surface-sunken' : 'border-border bg-surface-sunken'
                }`}
              >
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                {uploadProgress !== null ? (
                  <div className="w-full flex flex-col items-center gap-2 py-2">
                    <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <span className="text-[10px] text-ink-faint font-bold">照片上傳中 {uploadProgress}%</span>
                  </div>
                ) : uploadedFile ? (
                  <div className="flex items-center gap-3 w-full text-left">
                    <img src={uploadedFile.preview} alt="Preview" className="w-12 h-12 object-cover rounded-lg shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-ink truncate">{uploadedFile.name}</p>
                      <p className="text-[10px] text-ink-faint mt-0.5">{uploadedFile.size}</p>
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }} className="p-1.5 text-danger rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="w-7 h-7 text-ink-faint" />
                    <div className="text-center">
                      <p className="text-xs font-bold text-ink">點按或將相片拖曳至此</p>
                      <p className="text-[10px] text-ink-faint mt-0.5">僅支援 JPG, PNG 圖片格式</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="label">場地滿意度</label>
              <div className="flex justify-around items-center bg-surface-sunken p-2.5 rounded-2xl">
                {[1, 2, 3, 4, 5].map((val) => {
                  const active = rating >= val;
                  return (
                    <button key={val} type="button" onClick={() => setRating(val)} className={`p-1.5 rounded-full transition-colors ${active ? 'text-accent' : 'text-ink-faint'}`}>
                      <Star size={20} fill={active ? 'currentColor' : 'none'} strokeWidth={2} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="label">借用與收拾備註</label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="可在此填寫您的回饋或異常問題反映..."
                rows={2}
                className="input min-h-[80px] py-2.5"
              />
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="py-6 flex flex-col items-center justify-center text-center space-y-5">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center">
              <svg className="w-9 h-9 text-success" viewBox="0 0 52 52">
                <motion.circle cx="26" cy="26" r="25" fill="none" stroke="currentColor" strokeWidth="3.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease: 'easeInOut' }} />
                <motion.path fill="none" stroke="currentColor" strokeWidth="3.5" d="M14 27l8 8 16-16" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.5, ease: 'easeInOut' }} />
              </svg>
            </div>
            <div className="space-y-1.5">
              <h4 className="text-lg font-black text-ink">歸還成功！</h4>
              <p className="text-xs text-ink-soft leading-normal max-w-[240px] mx-auto">場地已順利完成借用結案。感謝您對場地收拾與清潔的維護！</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}
