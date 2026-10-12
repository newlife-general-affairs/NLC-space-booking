import { useCallback, useEffect, useState } from 'react';
import { apiFetchFormIntake, apiResolveFormIntake } from '@church/shared/api';
import type { FormIntakeLog } from '@church/shared/types';

interface Props {
  getToken: () => string;
}

const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('zh-TW', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export default function FormIntakeTab({ getToken }: Props) {
  const [rows, setRows] = useState<FormIntakeLog[]>([]);
  const [filter, setFilter] = useState<'unresolved' | 'all'>('unresolved');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchFormIntake(getToken(), filter);
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [getToken, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleResolved = async (row: FormIntakeLog) => {
    setBusyId(row.id);
    try {
      const res = await apiResolveFormIntake(getToken(), row.id, !row.resolved);
      if (res.ok) load();
      else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || '操作失敗');
      }
    } catch {
      alert('網路錯誤，請稍後重試');
    } finally {
      setBusyId(null);
    }
  };

  const unresolvedCount = rows.filter((r) => !r.resolved).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            📥 表單匯入紀錄
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            每一列是一次 Google 表單提交。解析成功的已自動建立待審核預約；解析失敗 / 需人工確認的在這裡逐筆處理。
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl select-none">
          {(['unresolved', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filter === f ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f === 'unresolved' ? `待處理 (${unresolvedCount})` : '全部'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">載入中...</div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-400">
          {filter === 'unresolved' ? '沒有待處理的表單提交 🎉' : '尚無任何表單匯入紀錄'}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const created = row.created_booking_ids?.length || 0;
            const review = row.needs_review?.length || 0;
            const skipped = row.skipped?.length || 0;
            const expanded = expandedId === row.id;
            return (
              <div
                key={row.id}
                className={`rounded-2xl border p-4 transition-colors ${
                  row.resolved
                    ? 'bg-slate-50 border-slate-200 opacity-70'
                    : skipped > 0 || review > 0
                    ? 'bg-amber-50/50 border-amber-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-slate-800 text-sm">
                        {row.borrower_name || '（未填姓名）'}
                      </span>
                      {row.pastoral_zone && (
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                          {row.pastoral_zone}
                        </span>
                      )}
                      {row.form_type && (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                          {row.form_type}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-3">
                      <span>📞 {row.phone || '—'}</span>
                      <span>🕗 {fmtTime(row.received_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setExpandedId(expanded ? null : row.id)}
                      className="text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      {expanded ? '收合' : '看內容'}
                    </button>
                    <button
                      onClick={() => toggleResolved(row)}
                      disabled={busyId === row.id}
                      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                        row.resolved
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {row.resolved ? '↩ 取消標記' : '✓ 標記已處理'}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-2.5">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    已建立 {created} 筆待審核
                  </span>
                  {review > 0 && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full">
                      需人工確認 {review}
                    </span>
                  )}
                  {skipped > 0 && (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                      未能解析 {skipped}
                    </span>
                  )}
                  {row.error && (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                      錯誤：{row.error}
                    </span>
                  )}
                </div>

                {expanded && (
                  <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                    {review > 0 && (
                      <div>
                        <div className="text-[11px] font-black text-amber-700 mb-1">需人工確認</div>
                        <ul className="space-y-1">
                          {row.needs_review.map((it, i) => (
                            <li
                              key={i}
                              className="text-[11px] text-slate-700 bg-white border border-amber-200 rounded-lg px-2.5 py-1.5"
                            >
                              <span className="font-mono break-all">{it.raw}</span>
                              {it.reason && (
                                <span className="block text-amber-700 mt-0.5">↳ {it.reason}</span>
                              )}
                              {it.bookingId && (
                                <span className="block text-slate-400 mt-0.5">預約 #{it.bookingId}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {skipped > 0 && (
                      <div>
                        <div className="text-[11px] font-black text-rose-700 mb-1">未能解析（未建立預約）</div>
                        <ul className="space-y-1">
                          {row.skipped.map((it, i) => (
                            <li
                              key={i}
                              className="text-[11px] text-slate-700 bg-white border border-rose-200 rounded-lg px-2.5 py-1.5"
                            >
                              <span className="font-mono break-all">{it.raw || '（空白）'}</span>
                              {it.reason && (
                                <span className="block text-rose-600 mt-0.5">↳ {it.reason}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div>
                      <div className="text-[11px] font-black text-slate-600 mb-1">原始表單內容</div>
                      <pre className="text-[10px] leading-relaxed text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(row.raw_payload, null, 2)}
                      </pre>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      表單回應 ID：{row.form_response_id}
                      {row.resolved && row.resolved_by && ` ・ 已由 ${row.resolved_by} 處理`}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
