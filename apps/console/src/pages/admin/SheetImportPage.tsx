import { useState } from 'react';
import { AlertCircle, FileSpreadsheet } from 'lucide-react';
import { apiImportRoomsFromSheet } from '@church/shared/api';

interface SheetImportPageProps {
  getToken: () => string;
}

const SHEET_URL_PATTERN = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/;

export default function SheetImportPage({ getToken }: SheetImportPageProps) {
  const [sheetUrl, setSheetUrl] = useState('');
  const [error, setError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    const url = sheetUrl.trim();
    if (!url) {
      setError('請先輸入 Google 試算表連結');
      return;
    }
    if (!SHEET_URL_PATTERN.test(url)) {
      setError('連結格式不正確，請貼上 Google 試算表的共用網址');
      return;
    }
    setError('');
    if (!window.confirm('⚠️ 警告：此動作會從試算表自動建立未登錄的場地，並依據試算表內容【覆蓋並清空】對應日期與場地現有的所有預約！\n\n確定要執行匯入嗎？')) {
      return;
    }
    setIsImporting(true);
    try {
      const res = await apiImportRoomsFromSheet(getToken(), url);
      const result = await res.json();
      if (res.ok) {
        alert(`🎉 匯入成功！\n工作表名稱：${result.sheetName}\n解析場地數：${result.roomsParsed} 個\n匯入預約數：${result.bookingsParsed} 筆`);
        setSheetUrl('');
      } else {
        setError(`匯入失敗：${result.error || '未知錯誤'}`);
      }
    } catch (err) {
      console.error(err);
      setError('連線伺服器發生錯誤，請稍後再試');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
        <FileSpreadsheet className="text-emerald-600" size={20} /> Google 試算表排程匯入
      </h3>

      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 leading-relaxed">
        匯入會依試算表內容<strong>覆蓋並清空</strong>對應日期與場地現有的所有預約，並自動建立尚未登錄的場地。執行前請先確認試算表內容正確。
      </div>

      <div className="space-y-2">
        <label htmlFor="sheet-url" className="block text-xs font-bold text-slate-700">試算表共用連結</label>
        <p className="text-[11px] text-slate-500">
          請先把試算表設為「知道連結的任何人均可檢視」。系統會解析格線、比對子空間（如第五教室）後匯入。
        </p>
        <input
          id="sheet-url"
          type="url"
          placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
          value={sheetUrl}
          onChange={e => { setSheetUrl(e.target.value); setError(''); }}
          disabled={isImporting}
          className={`w-full p-3 border rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-mono ${error ? 'border-rose-400' : 'border-slate-200'}`}
        />
        {error && (
          <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
            <AlertCircle size={14} /> {error}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleImport}
        disabled={isImporting}
        className={`w-full sm:w-auto font-bold py-3 px-5 rounded-xl text-sm transition-all ${
          isImporting ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
        }`}
      >
        {isImporting ? '正在解析…' : '分析並匯入'}
      </button>
    </div>
  );
}
