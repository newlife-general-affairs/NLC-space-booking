import { useState, useEffect } from 'react';
import { Calendar, Eye, EyeOff, Key, FileSpreadsheet } from 'lucide-react';
import {
  apiFetchRooms,
  apiUpdateBookingStatus,
  apiAssignBookingRoom,
  apiDeleteBooking,
  apiSendPassword,
  apiResendPasswordEmail,
  apiFetchPublicSpaces,
  apiAssignCleaning,
  apiImportRoomsFromSheet,
} from '@church/shared/api';
import AssignCleaningModal from '../../components/AssignCleaningModal';
import AdminInspectionModal from '../../components/AdminInspectionModal';
import ConflictBoard from './ConflictBoard';
import { computeOverlapMap } from '@church/shared/domain/bookingConflicts';
import type { Booking, PublicSpace, Room } from '@church/shared/types';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface BookingsTabProps {
  data: Booking[];
  getToken: () => string;
  onRefresh: () => void;
  tabMode?: 'bookings' | 'cleaning' | 'lock-management';
}

export default function BookingsTab({ data, getToken, onRefresh, tabMode = 'bookings' }: BookingsTabProps) {
  const [assigningBooking, setAssigningBooking] = useState<Booking | null>(null);
  const [assignRoomId, setAssignRoomId] = useState<number | null>(null);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [revealedIds, setRevealedIds] = useState<number[]>([]);
  const [assigningCleaningBooking, setAssigningCleaningBooking] = useState<Booking | null>(null);
  const [publicSpaces, setPublicSpaces] = useState<PublicSpace[]>([]);
  const [inspectingBooking, setInspectingBooking] = useState<Booking | null>(null);
  const [subTab, setSubTab] = useState<'pending' | 'assigned' | 'operations' | 'all' | 'conflicts' | 'approved' | 'expired'>('pending');
  const [rejectionModal, setRejectionModal] = useState<{ bookingId: number; bookingName: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [boardOpen, setBoardOpen] = useState(false);

  useEscapeKey(() => { setRejectionModal(null); setRejectionReason(''); }, !!rejectionModal);
  useEscapeKey(() => setAssigningBooking(null), !!assigningBooking);

  const [sheetUrl, setSheetUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showOnlyConflicts, setShowOnlyConflicts] = useState(false);

  useEffect(() => {
    if (assigningBooking?.rooms?.branch) {
      apiFetchRooms(assigningBooking.rooms.branch)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy API callback; Room[] state validates the boundary
        .then(d => { if (Array.isArray(d)) setAvailableRooms(d.filter((r: any) => r.name !== '💒 由教會分配')); })
        .catch(console.error);
    }
  }, [assigningBooking]);

  // Reset selection when source data refreshes or changes
  useEffect(() => {
    setSelectedIds([]);
  }, [data]);

  // Reset subTab when tabMode changes
  useEffect(() => {
    setSubTab('pending');
  }, [tabMode]);

  const handleStatusChange = async (id: number, status: string, rejection_reason?: string) => {
    try {
      const res = await apiUpdateBookingStatus(getToken(), id, status, rejection_reason);
      if (res.ok) {
        onRefresh();
      } else {
        const err = await res.json();
        alert(err.error || '審核操作失敗');
      }
    } catch {
      alert('網路錯誤，請稍後重試');
    }
  };

  // 核可：需要確認防誤觸
  const handleApprove = (id: number, name: string) => {
    if (!window.confirm(`確定要核可「${name}」的預約申請嗎？`)) return;
    handleStatusChange(id, 'approved');
  };

  // 拒絕：開啟原因填寫 Modal
  const handleOpenRejectModal = (id: number, name: string) => {
    setRejectionReason('');
    setRejectionModal({ bookingId: id, bookingName: name });
  };

  const handleConfirmRejection = async () => {
    if (!rejectionModal) return;
    if (!rejectionReason.trim()) {
      alert('請填寫拒絕原因');
      return;
    }
    await handleStatusChange(rejectionModal.bookingId, 'rejected', rejectionReason.trim());
    setRejectionModal(null);
    setRejectionReason('');
  };

  const handleAssignRoom = async () => {
    if (!assigningBooking || !assignRoomId) return;
    try {
      const res = await apiAssignBookingRoom(getToken(), assigningBooking.id, assignRoomId);
      if (res.ok) { setAssigningBooking(null); onRefresh(); }
      else { const err = await res.json(); alert(err.error || '分配失敗'); }
    } catch { alert('網路錯誤，請稍後重試'); }
  };

  const handleToggleSelect = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(x => x !== id));
    }
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredBookings.map(b => b.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`確定要刪除這 ${selectedIds.length} 筆預約申請嗎？此動作無法復原。`)) return;
    try {
      const results = await Promise.all(selectedIds.map(id => apiDeleteBooking(getToken(), id)));
      const allOk = results.every(res => res.ok);
      if (allOk) {
        alert(`已成功刪除 ${selectedIds.length} 筆預約申請！`);
        setSelectedIds([]);
        onRefresh();
      } else {
        alert('部分預約申請刪除失敗，請檢查權限後重試');
        onRefresh();
      }
    } catch {
      alert('網路錯誤，請稍後重試');
    }
  };

  const handleImport = async () => {
    if (!sheetUrl.trim()) {
      alert('請先輸入 Google 試算表連結');
      return;
    }
    if (!window.confirm('⚠️ 警告：此動作會從試算表自動建立未登錄的場地，並依據試算表內容【覆蓋並清空】對應日期與場地現有的所有預約！\n\n確定要執行匯入嗎？')) {
      return;
    }
    setIsImporting(true);
    try {
      const res = await apiImportRoomsFromSheet(getToken(), sheetUrl.trim());
      const result = await res.json();
      if (res.ok) {
        alert(`🎉 匯入成功！\n工作表名稱：${result.sheetName}\n解析場地數：${result.roomsParsed} 個\n匯入預約數：${result.bookingsParsed} 筆`);
        setSheetUrl('');
        onRefresh();
      } else {
        alert(`❌ 匯入失敗：${result.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('連線伺服器發生錯誤，請稍後再試');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSendPassword = async (id: number) => {
    if (!window.confirm('確定要產生、同步並發送門鎖密碼信給借用人嗎？')) return;
    try {
      const res = await apiSendPassword(getToken(), id);
      const resData = await res.json();
      if (res.ok) {
        alert('密碼已成功產生、同步並寄出！');
        onRefresh();
      } else {
        alert(resData.error || '發生錯誤');
      }
    } catch (err) {
      console.error(err);
      alert('網路錯誤，請稍後重試');
    }
  };

  const handleResendEmail = async (id: number) => {
    if (!window.confirm('確定要重新發送密碼通知信給借用人嗎？')) return;
    try {
      const res = await apiResendPasswordEmail(getToken(), id);
      const resData = await res.json();
      if (res.ok) {
        alert('密碼通知信已成功重發！');
        onRefresh();
      } else {
        alert(resData.error || '發生錯誤');
      }
    } catch (err) {
      console.error(err);
      alert('網路錯誤，請稍後重試');
    }
  };

  const handleUpdatePassword = async (id: number) => {
    if (!window.confirm('確定要重新產生隨機密碼嗎？這將會註銷原密碼、同步新密碼至智慧鎖並重新寄送通知信。')) return;
    try {
      const res = await apiSendPassword(getToken(), id);
      const resData = await res.json();
      if (res.ok) {
        alert('密碼已成功更新、同步並寄出新信！');
        onRefresh();
      } else {
        alert(resData.error || '發生錯誤');
      }
    } catch (err) {
      console.error(err);
      alert('網路錯誤，請稍後重試');
    }
  };

  const handleRejectCleaning = async (b: Booking) => {
    if (!window.confirm('確定要退回此預約的打掃審核嗎？系統將為使用者保留合格項目，並通知其重新清潔。')) return;
    try {
      const raw = b.cleaning_assignments || '';
      const parts = raw.split('::');
      const spaces = parts[0] || '';
      const progress = parts[2] || '';
      const newCleanAssign = progress ? `${spaces}::rejected::${progress}` : `${spaces}::rejected`;
      const res = await apiAssignCleaning(getToken(), b.id, newCleanAssign);
      if (res.ok) {
        alert('已成功退回打掃申請，已保留合格項目並通知使用者。');
        onRefresh();
      } else {
        const err = await res.json();
        alert('操作失敗：' + (err.error || '未知錯誤'));
      }
    } catch {
      alert('網路錯誤，請稍後重試');
    }
  };

  // Helper to determine if a booking is overdue for return (1 hour past end time)
  const isOverdue = (dateStr: string, endTimeStr: string) => {
    try {
      const endPart = endTimeStr.substring(0, 5); // "HH:MM"
      const [parsedHours, minutes] = endPart.split(':').map(Number);
      let hours = parsedHours;
      hours += 1;
      let targetDateStr = dateStr;
      if (hours >= 24) {
        hours -= 24;
        const nextDay = new Date(dateStr);
        nextDay.setDate(nextDay.getDate() + 1);
        targetDateStr = nextDay.toISOString().split('T')[0];
      }
      const overdueTime = new Date(`${targetDateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
      return new Date() > overdueTime;
    } catch {
      return false;
    }
  };

  // Helper to check if a booking has already ended（結束時間 00:00 視為隔天凌晨）
  const hasEnded = (dateStr: string, endTimeStr: string) => {
    try {
      const endPart = endTimeStr.substring(0, 5);
      const [hours, minutes] = endPart.split(':').map(Number);
      let targetDateStr = dateStr;
      if (hours === 0 && minutes === 0) {
        const nextDay = new Date(dateStr);
        nextDay.setDate(nextDay.getDate() + 1);
        targetDateStr = nextDay.toISOString().split('T')[0];
      }
      const endTime = new Date(`${targetDateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
      return new Date() > endTime;
    } catch {
      return false;
    }
  };

  // Helper to determine if the booking has started using
  const getUsageStatus = (dateStr: string, startTimeStr: string) => {
    try {
      const startPart = startTimeStr.substring(0, 5);
      const [hours, minutes] = startPart.split(':').map(Number);
      const startTime = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
      return new Date() >= startTime ? 'using' : 'not_started';
    } catch {
      return 'not_started';
    }
  };

  // Get unique room names from the branch booking data
  const uniqueRooms = Array.from(new Set(data.map(b => b.rooms?.name).filter(Boolean))).sort();

  // Helper to determine sorting priority: 1 for pending approval or return inspection, 0 otherwise
  const getBookingPriority = (b: Booking) => {
    if (b.status === 'pending') return 1;
    if (b.status === 'approved' && !b.is_returned) {
      if (b.violation || isOverdue(b.booking_date, b.end_time)) return 0;
      const rawAssignments = b.cleaning_assignments || '';
      const parts = rawAssignments.split('::');
      const assignState = parts[1] || '';
      const isSubmitted = assignState === 'submitted' || assignState === 'resubmitted';
      const isRejected = assignState === 'rejected';
      if (isSubmitted || isRejected) return 1;
    }
    return 0;
  };

  // Filter and sort bookings client-side
  // 1. Calculate conflicts on the full data array (excluding rejected) — 共用工具
  const overlapMap = computeOverlapMap(data);

  // 2. Filter bookings client-side
  const filterList = data.filter(b => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      (b.rooms?.name || '').toLowerCase().includes(searchLower) ||
      (b.full_name || '').toLowerCase().includes(searchLower) ||
      (b.phone || '').toLowerCase().includes(searchLower) ||
      (b.user_email || '').toLowerCase().includes(searchLower) ||
      (b.purpose || '').toLowerCase().includes(searchLower) ||
      (b.access_code || '').toLowerCase().includes(searchLower);

    const matchesRoom = !selectedRoom || b.rooms?.name === selectedRoom;
    const matchesDate = !selectedDate || b.booking_date === selectedDate;

    // Filter by conflicts
    const matchesConflicts = !showOnlyConflicts || !!overlapMap[b.id];

    let matchesStatus = true;
    if (tabMode === 'bookings') {
      if (subTab === 'pending') {
        matchesStatus = b.status === 'pending' && !overlapMap[b.id] && !hasEnded(b.booking_date, b.end_time);
      } else if (subTab === 'conflicts') {
        matchesStatus = b.status === 'pending' && !!overlapMap[b.id] && !hasEnded(b.booking_date, b.end_time);
      } else if (subTab === 'approved') {
        matchesStatus = b.status === 'approved';
      } else if (subTab === 'expired') {
        matchesStatus = b.status === 'pending' && hasEnded(b.booking_date, b.end_time);
      } else {
        matchesStatus = !selectedStatus || b.status === selectedStatus;
      }
    } else if (tabMode === 'lock-management') {
      const isTuyaLinked = !!(b.tuya_device_id || b.rooms?.tuya_device_id);
      matchesStatus = b.status === 'approved' && isTuyaLinked;
    } else {
      // tabMode === 'cleaning'
      if (b.status !== 'approved') return false;
      const rawAssignments = b.cleaning_assignments || '';
      const parts = rawAssignments.split('::');
      const cleanAssignText = parts[0] || '';
      const assignState = parts[1] || '';
      const isSubmitted = assignState === 'submitted' || assignState === 'resubmitted';
      const isRejected = assignState === 'rejected';

      const overdue = isOverdue(b.booking_date, b.end_time);

      if (subTab === 'pending') {
        matchesStatus = !b.is_returned && !isSubmitted && !isRejected && !cleanAssignText && !overdue;
      } else if (subTab === 'assigned') {
        matchesStatus = !b.is_returned && !isSubmitted && !isRejected && !!cleanAssignText && !overdue;
      } else if (subTab === 'operations') {
        matchesStatus = !b.is_returned && (isSubmitted || isRejected) && !overdue;
      } else {
        matchesStatus = b.is_returned || overdue;
      }
    }

    return matchesSearch && matchesRoom && matchesStatus && matchesDate && matchesConflicts;
  });

  const getSortedBookings = (list: Booking[]) => {
    // Sort by submission time or booking time grouped by priority
    const priority1 = list.filter(b => getBookingPriority(b) === 1);
    const priority0 = list.filter(b => getBookingPriority(b) === 0);

    const compareSubmissionTime = (a: Booking, b: Booking) => {
      const timeA = a.created_at || '';
      const timeB = b.created_at || '';
      if (timeA && timeB && timeA !== timeB) {
        return sortOrder === 'desc' ? timeB.localeCompare(timeA) : timeA.localeCompare(timeB);
      }
      return sortOrder === 'desc' ? (b.id || 0) - (a.id || 0) : (a.id || 0) - (b.id || 0);
    };

    const compareBookingTime = (a: Booking, b: Booking) => {
      const dateA = a.booking_date || '';
      const dateB = b.booking_date || '';
      if (dateA !== dateB) {
        return sortOrder === 'desc' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
      }
      const timeA = a.start_time || '';
      const timeB = b.start_time || '';
      return sortOrder === 'desc' ? timeB.localeCompare(timeA) : timeA.localeCompare(timeB);
    };

    const compareFn = tabMode === 'cleaning' ? compareBookingTime : compareSubmissionTime;

    const sortedPriority1 = [...priority1].sort(compareFn);
    const sortedPriority0 = [...priority0].sort(compareFn);

    return [...sortedPriority1, ...sortedPriority0];
  };

  const filteredBookings = getSortedBookings(filterList);

  const statusStyle: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse',
  };
  const statusLabel: Record<string, string> = { approved: '已核可', rejected: '已拒絕', pending: '待審核' };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2 select-none">
          {tabMode === 'bookings' ? (
            <>
              <Calendar className="text-indigo-600" size={20} /> 預約申請審核
            </>
          ) : tabMode === 'lock-management' ? (
            <>
              <Key className="text-indigo-600" size={20} /> 門鎖密碼管理
            </>
          ) : (
            <>
              <Calendar className="text-indigo-600" size={20} /> 空間打掃與清潔稽核
            </>
          )}
        </h3>
        {tabMode === 'bookings' && selectedIds.length > 0 && (
          <button
            onClick={handleDeleteSelected}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 animate-in fade-in duration-200 shrink-0"
          >
            🗑️ 刪除所選預約 ({selectedIds.length})
          </button>
        )}
      </div>

      {tabMode === 'bookings' && (
        <div className="bg-slate-50/60 border border-slate-200 rounded-2xl p-6 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <h4 className="font-extrabold text-sm mb-2 text-slate-700 flex items-center gap-1.5 select-none">
              <FileSpreadsheet className="text-emerald-600" size={16} /> Google 試算表排程匯入
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              請輸入已共用為「知道連結的人均可檢視」的 Google 試算表連結。系統會自動解析視覺化格線、比對子空間（如第五教室），並覆蓋匯入場地預約。
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0 md:max-w-xl flex-1">
            <input
              type="text"
              placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
              className="p-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 shadow-sm flex-1 font-mono"
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
              disabled={isImporting}
            />
            <button
              onClick={handleImport}
              disabled={isImporting}
              className={`font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-sm active:scale-95 whitespace-nowrap flex items-center justify-center gap-2 ${
                isImporting 
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isImporting ? '🔄 正在解析...' : '📥 立即分析並匯入'}
            </button>
          </div>
        </div>
      )}

      {tabMode !== 'lock-management' && (
        <div className={`flex bg-slate-100 p-1.5 rounded-2xl gap-1.5 mb-6 select-none ${tabMode === 'bookings' ? 'max-w-3xl' : 'max-w-2xl'}`}>
          {tabMode === 'bookings' ? (
            <>
              <button
                onClick={() => { setSubTab('pending'); setSelectedIds([]); }}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                  subTab === 'pending'
                    ? 'bg-white text-indigo-700 shadow-md shadow-indigo-100/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
                }`}
              >
                <span>📋 待審核</span>
                {data.filter(b => b.status === 'pending' && !overlapMap[b.id] && !hasEnded(b.booking_date, b.end_time)).length > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full leading-none">
                    {data.filter(b => b.status === 'pending' && !overlapMap[b.id] && !hasEnded(b.booking_date, b.end_time)).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setSubTab('conflicts'); setSelectedIds([]); }}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                  subTab === 'conflicts'
                    ? 'bg-white text-indigo-700 shadow-md shadow-indigo-100/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
                }`}
              >
                <span>⚠️ 有衝突</span>
                {data.filter(b => b.status === 'pending' && !!overlapMap[b.id]).length > 0 && (
                  <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full leading-none">
                    {data.filter(b => b.status === 'pending' && !!overlapMap[b.id]).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setSubTab('approved'); setSelectedIds([]); }}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                  subTab === 'approved'
                    ? 'bg-white text-indigo-700 shadow-md shadow-indigo-100/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
                }`}
              >
                <span>✓ 審核通過</span>
                {data.filter(b => b.status === 'approved').length > 0 && (
                  <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full leading-none">
                    {data.filter(b => b.status === 'approved').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setSubTab('expired'); setSelectedIds([]); }}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                  subTab === 'expired'
                    ? 'bg-white text-indigo-700 shadow-md shadow-indigo-100/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
                }`}
              >
                <span>🕗 已過期</span>
                {data.filter(b => b.status === 'pending' && hasEnded(b.booking_date, b.end_time)).length > 0 && (
                  <span className="bg-slate-400 text-white text-[10px] font-black px-2 py-0.5 rounded-full leading-none">
                    {data.filter(b => b.status === 'pending' && hasEnded(b.booking_date, b.end_time)).length}
                  </span>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setSubTab('pending'); setSelectedIds([]); }}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                  subTab === 'pending'
                    ? 'bg-white text-indigo-700 shadow-md shadow-indigo-100/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
                }`}
              >
                <span>🧹 待分配打掃</span>
                {data.filter(b => {
                  if (b.status !== 'approved' || b.is_returned) return false;
                  const parts = (b.cleaning_assignments || '').split('::');
                  const assignState = parts[1] || '';
                  const cleanAssignText = parts[0] || '';
                  const isSubmitted = assignState === 'submitted' || assignState === 'resubmitted';
                  const isRejected = assignState === 'rejected';
                  const overdue = isOverdue(b.booking_date, b.end_time);
                  return !isSubmitted && !isRejected && !cleanAssignText && !overdue;
                }).length > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full leading-none">
                    {data.filter(b => {
                      if (b.status !== 'approved' || b.is_returned) return false;
                      const parts = (b.cleaning_assignments || '').split('::');
                      const assignState = parts[1] || '';
                      const cleanAssignText = parts[0] || '';
                      const isSubmitted = assignState === 'submitted' || assignState === 'resubmitted';
                      const isRejected = assignState === 'rejected';
                      const overdue = isOverdue(b.booking_date, b.end_time);
                      return !isSubmitted && !isRejected && !cleanAssignText && !overdue;
                    }).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setSubTab('assigned'); setSelectedIds([]); }}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                  subTab === 'assigned'
                    ? 'bg-white text-indigo-700 shadow-md shadow-indigo-100/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
                }`}
              >
                <span>✨ 已分配打掃</span>
                {data.filter(b => {
                  if (b.status !== 'approved' || b.is_returned) return false;
                  const parts = (b.cleaning_assignments || '').split('::');
                  const assignState = parts[1] || '';
                  const cleanAssignText = parts[0] || '';
                  const isSubmitted = assignState === 'submitted' || assignState === 'resubmitted';
                  const isRejected = assignState === 'rejected';
                  const overdue = isOverdue(b.booking_date, b.end_time);
                  return !isSubmitted && !isRejected && !!cleanAssignText && !overdue;
                }).length > 0 && (
                  <span className="bg-indigo-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full leading-none">
                    {data.filter(b => {
                      if (b.status !== 'approved' || b.is_returned) return false;
                      const parts = (b.cleaning_assignments || '').split('::');
                      const assignState = parts[1] || '';
                      const cleanAssignText = parts[0] || '';
                      const isSubmitted = assignState === 'submitted' || assignState === 'resubmitted';
                      const isRejected = assignState === 'rejected';
                      const overdue = isOverdue(b.booking_date, b.end_time);
                      return !isSubmitted && !isRejected && !!cleanAssignText && !overdue;
                    }).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setSubTab('operations'); setSelectedIds([]); }}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                  subTab === 'operations'
                    ? 'bg-white text-indigo-700 shadow-md shadow-indigo-100/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
                }`}
              >
                <span>🔍 待清潔檢查</span>
                {data.filter(b => {
                  if (b.status !== 'approved' || b.is_returned) return false;
                  const parts = (b.cleaning_assignments || '').split('::');
                  const assignState = parts[1] || '';
                  const overdue = isOverdue(b.booking_date, b.end_time);
                  return (assignState === 'submitted' || assignState === 'resubmitted' || assignState === 'rejected') && !overdue;
                }).length > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full leading-none animate-pulse">
                    {data.filter(b => {
                      if (b.status !== 'approved' || b.is_returned) return false;
                      const parts = (b.cleaning_assignments || '').split('::');
                      const assignState = parts[1] || '';
                      const overdue = isOverdue(b.booking_date, b.end_time);
                      return (assignState === 'submitted' || assignState === 'resubmitted' || assignState === 'rejected') && !overdue;
                    }).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setSubTab('all'); setSelectedIds([]); }}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                  subTab === 'all'
                    ? 'bg-white text-indigo-700 shadow-md shadow-indigo-100/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
                }`}
              >
                <span>📜 已歸還/打掃記錄</span>
              </button>
            </>
          )}
        </div>
      )}
            {/* ── Filters ── */}
      <div className="p-6 bg-slate-50/60 border border-slate-200/80 rounded-2xl mb-6 shadow-sm select-none backdrop-blur-sm">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
          <span>🔍</span> 搜尋與篩選條件
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 文字搜尋 */}
          <div className="relative">
            <input
              type="text"
              placeholder="搜尋姓名、場地、信箱..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-3.5 pr-8 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-medium text-slate-700 shadow-sm transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="清除搜尋文字"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 -m-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          {/* 特定日期篩選 */}
          <div className="relative">
            <input
              type={selectedDate ? "date" : "text"}
              placeholder="📅 選擇特定日期"
              value={selectedDate}
              onFocus={(e) => { e.target.type = "date"; }}
              onBlur={(e) => { if (!e.target.value) e.target.type = "text"; }}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full pl-3 pr-8 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-bold text-slate-700 cursor-pointer shadow-sm transition-all"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                aria-label="清除日期篩選"
                className="absolute right-8 top-1/2 -translate-y-1/2 p-1.5 -m-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          {/* 場地分類 */}
          <div>
            <select
              value={selectedRoom}
              onChange={e => setSelectedRoom(e.target.value)}
              aria-label="依場地空間篩選"
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-bold text-slate-700 shadow-sm transition-all cursor-pointer"
            >
              <option value="">💒 所有場地空間</option>
              {uniqueRooms.map(room => (
                <option key={room} value={room}>{room}</option>
              ))}
            </select>
          </div>

          {/* 時間排序 */}
          <div>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              aria-label="依時間排序"
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-bold text-slate-700 shadow-sm transition-all cursor-pointer"
            >
              <option value="desc">⏱️ 時間：新 → 舊</option>
              <option value="asc">⏱️ 時間：舊 → 新</option>
            </select>
          </div>
        </div>

        {/* 預約審核模式才顯示狀態篩選與衝突篩選 */}
        {tabMode === 'bookings' && (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-200/60 pt-4">
            {subTab === 'all' ? (
              <div className="max-w-xs w-full">
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  aria-label="依審核狀態篩選"
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-bold text-slate-700 shadow-sm transition-all cursor-pointer"
                >
                  <option value="">● 所有審核狀態</option>
                  <option value="pending">● 待審核</option>
                  <option value="approved">● 已核可</option>
                  <option value="rejected">● 已拒絕</option>
                </select>
              </div>
            ) : (
              <div />
            )}
            
            <label className="flex items-center gap-2 cursor-pointer select-none self-end sm:self-center">
              <input
                type="checkbox"
                checked={showOnlyConflicts}
                onChange={e => setShowOnlyConflicts(e.target.checked)}
                className="w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                ⚠️ 僅顯示時段衝突的預約 (
                <span className="text-rose-600 font-extrabold">
                  {Object.keys(overlapMap).filter(id => {
                    const b = data.find(x => x.id === Number(id));
                    if (!b) return false;
                    if (subTab === 'pending') return b.status === 'pending';
                    if (subTab === 'operations') return b.status === 'approved';
                    return true;
                  }).length}
                </span>
                )
              </span>
            </label>
          </div>
        )}
      </div>

      {tabMode === 'bookings' && subTab === 'conflicts' && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-4 py-3">
          <div className="text-xs font-bold text-indigo-900">
            🧩 用看板一次看清整天的場地佔用，把待審核的預約直接拖到空的場地欄
            <span className="block text-[11px] font-medium text-indigo-500 mt-0.5">
              已核可的預約需先「退回待審核」才能拖曳；拖曳只改場地，不改借用時間。
            </span>
          </div>
          <button
            onClick={() => setBoardOpen(true)}
            className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md active:scale-95"
          >
            🧩 開啟拖曳調整看板
          </button>
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200/80 rounded-2xl shadow-sm bg-white">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b border-slate-200 select-none">
              {tabMode === 'bookings' && (
                <th className="p-4 w-10 text-center select-none">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredBookings.length && filteredBookings.length > 0}
                    onChange={e => handleToggleAll(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
              )}
              <th className="p-4">預約資訊</th>
              <th className="p-4">借用人</th>
              {tabMode === 'bookings' && (
                <>
                  <th className="p-4 w-32">狀態</th>
                  <th className="p-4 w-44">審核與指派操作</th>
                </>
              )}
              {tabMode === 'lock-management' && (
                <>
                  <th className="p-4 w-36">門鎖密碼</th>
                  <th className="p-4 w-32">密碼管理</th>
                </>
              )}
              {tabMode === 'cleaning' && (
                <>
                  <th className="p-4">打掃與清潔稽核</th>
                  {subTab === 'all' && <th className="p-4 w-32">狀態</th>}
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredBookings.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    tabMode === 'bookings' ? 5 :
                    tabMode === 'lock-management' ? 4 :
                    (subTab === 'all' ? 4 : 3)
                  }
                  className="p-8 text-center text-slate-400 italic bg-white rounded-b-2xl"
                >
                  {data.length === 0 ? '目前無任何預約申請記錄' : '查無符合篩選條件的記錄'}
                </td>
              </tr>
            ) : (
              filteredBookings.map((b) => {
                const rawAssignments = b.cleaning_assignments || '';
                const parts = rawAssignments.split('::');
                const cleanAssignText = parts[0] || '';
                const assignState = parts[1] || '';
                const isSubmitted = assignState === 'submitted' || assignState === 'resubmitted';
                const isRejected = assignState === 'rejected';
                const overdue = isOverdue(b.booking_date, b.end_time);

                return (
                  <tr key={b.id} className={`transition-colors ${
                    overlapMap[b.id] 
                      ? 'bg-rose-50/85 hover:bg-rose-100/70 text-slate-800' 
                      : 'hover:bg-slate-50/40'
                  }`}>
                    {tabMode === 'bookings' && (
                      <td className="p-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(b.id)}
                          onChange={e => handleToggleSelect(b.id, e.target.checked)}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-slate-800 text-sm">{b.rooms?.name}</span>
                        {b.booking_type && (
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border select-none ${
                            b.booking_type === '婚禮' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                            b.booking_type === '重要' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            b.booking_type === '取消或異動' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                            'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {b.booking_type}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md inline-block mt-1">
                        📅 {b.booking_date} {b.start_time?.substring(0, 5)}-{b.end_time?.substring(0, 5)}
                      </div>
                      <div className="text-xs text-slate-600 mt-2 whitespace-pre-wrap break-all border-l-2 border-indigo-200 pl-2.5 py-0.5 font-medium italic">
                        {b.purpose} <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-normal not-italic ml-1">👥 {b.attendance_count}人</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1.5 font-bold">據點：{b.rooms?.branch}</div>
                      {tabMode === 'bookings' && overlapMap[b.id] && overlapMap[b.id].type === 'conflict' && (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-rose-50/80 border border-rose-100/60 space-y-1.5 max-w-md animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-600 text-white animate-pulse">
                              ⚠️ 空間時段衝突 (同場地)
                            </span>
                            <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                              申請順位: {String.fromCharCode(65 + overlapMap[b.id].index)}
                            </span>
                          </div>
                          <div className="text-[10px] text-rose-700 space-y-1 pt-1.5 border-t border-rose-100/50 font-medium">
                            <div className="font-bold flex items-center gap-1">
                              <span>🔗</span> 與以下預約時段重疊：
                            </div>
                            {overlapMap[b.id].conflictingWith.map((c, i) => (
                              <div key={i} className="flex flex-wrap items-center gap-x-1 pl-2 border-l-2 border-rose-300">
                                <span className="font-extrabold">{c.borrower}</span>
                                <span className="text-slate-500 font-mono">({c.time})</span>
                                <span className="text-rose-600 italic">「{c.purpose}」</span>
                                <span className={`text-[8px] px-1 rounded-full font-black border ${
                                  c.status === 'approved' 
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                                    : 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse'
                                }`}>
                                  {c.status === 'approved' ? '已核可' : '待審核'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800 text-sm">{b.full_name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">📞 {b.phone}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{b.user_email}</div>
                    </td>

                    {/* ─── 預約管理模式 (bookings) 專屬列 ─── */}
                    {tabMode === 'bookings' && (
                      <>
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black whitespace-nowrap border ${statusStyle[b.status] || statusStyle.pending}`}>
                              {statusLabel[b.status] || '待審核'}
                            </span>
                            {b.status === 'rejected' && b.rejection_reason && (
                              <div className="text-[10px] text-rose-600 bg-rose-50 border border-rose-100 rounded px-2 py-1 max-w-[160px] break-words leading-tight font-bold">
                                📝 {b.rejection_reason}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          {b.status === 'pending' ? (
                            <>
                              <div className="flex gap-1.5 mb-2">
                                <button
                                  onClick={() => handleApprove(b.id, b.full_name)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors active:scale-95"
                                >
                                  ✓ 核可
                                </button>
                                <button
                                  onClick={() => handleOpenRejectModal(b.id, b.full_name)}
                                  className="bg-rose-50 text-rose-600 border border-rose-200 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors active:scale-95"
                                >
                                  ✕ 拒絕
                                </button>
                              </div>
                              <button
                                onClick={() => { setAssigningBooking(b); setAssignRoomId(b.room_id); }}
                                className={`text-xs px-2.5 py-1.5 rounded-lg border font-bold transition-all active:scale-95 ${b.rooms?.name === '💒 由教會分配' ? 'bg-amber-50 text-amber-700 border-amber-300 animate-pulse' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100/60'}`}
                              >
                                📍 {b.rooms?.name === '💒 由教會分配' ? '指派場地' : '變更場地'}
                              </button>
                            </>
                          ) : (
                            <div className="flex flex-col gap-1.5 items-start">
                              {b.status === 'approved' && !hasEnded(b.booking_date, b.end_time) && (
                                <button
                                  onClick={() => { setAssigningBooking(b); setAssignRoomId(b.room_id); }}
                                  className="text-xs px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 transition-all active:scale-95 shadow-sm"
                                >
                                  📍 變更場地
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenRejectModal(b.id, b.full_name)}
                                className="bg-rose-50 text-rose-600 border border-rose-200 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors active:scale-95"
                                title="取消核可並拒絕"
                              >
                                ✕ 撤銷核可
                              </button>
                            </div>
                          )}
                        </td>
                      </>
                    )}

                    {/* ─── 門鎖密碼管理模式 (lock-management) 專屬列 ─── */}
                    {tabMode === 'lock-management' && (
                      <>
                        {/* 門鎖密碼 */}
                        <td className="p-4">
                          {b.access_code ? (
                            <div className="flex flex-col items-start gap-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono bg-indigo-50/80 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded text-xs font-bold tracking-widest shadow-sm">
                                  {revealedIds.includes(b.id) ? b.access_code : '••••'}
                                </span>
                                <button
                                  onClick={() => setRevealedIds(prev => prev.includes(b.id) ? prev.filter(x => x !== b.id) : [...prev, b.id])}
                                  data-no-debounce="true"
                                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                                  title={revealedIds.includes(b.id) ? '隱藏密碼' : '顯示密碼'}
                                >
                                  {revealedIds.includes(b.id) ? <EyeOff size={12} /> : <Eye size={12} />}
                                </button>
                              </div>
                              {(b.tuya_device_id || b.rooms?.tuya_device_id) && (
                                b.tuya_password_id
                                  ? <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1 mt-0.5">● 智慧鎖已同步</span>
                                  : <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 inline-flex items-center gap-1 mt-0.5">▲ 門鎖不同步</span>
                              )}
                            </div>
                          ) : hasEnded(b.booking_date, b.end_time) ? (
                            <span className="text-slate-400 text-xs italic">已過期</span>
                          ) : (
                            <span className="text-slate-400 text-xs italic">未發送</span>
                          )}
                        </td>

                        {/* 密碼管理 */}
                        <td className="p-4">
                          {hasEnded(b.booking_date, b.end_time) ? (
                            <span className="text-slate-400 text-xs italic">已過期</span>
                          ) : b.access_code ? (
                            <div className="flex flex-col gap-1.5 items-start">
                              <button
                                onClick={() => handleResendEmail(b.id)}
                                className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg font-bold transition-all active:scale-95 flex items-center justify-center gap-1 shadow-sm w-full sm:w-auto whitespace-nowrap"
                                title="重新發送密碼通知信給借用人"
                              >
                                ✉️ 重發郵件
                              </button>
                              <button
                                onClick={() => handleUpdatePassword(b.id)}
                                className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1.5 rounded-lg font-bold transition-all active:scale-95 flex items-center justify-center gap-1 shadow-sm w-full sm:w-auto whitespace-nowrap"
                                title="重新產生隨機密碼並更新同步"
                              >
                                🔄 更新密碼
                              </button>
                              <button
                                onClick={() => { setAssigningBooking(b); setAssignRoomId(b.room_id); }}
                                className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1.5 rounded-lg font-bold transition-all active:scale-95 flex items-center justify-center gap-1 shadow-sm w-full sm:w-auto whitespace-nowrap"
                              >
                                📍 變更場地
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1.5 items-start">
                              <button
                                onClick={() => handleSendPassword(b.id)}
                                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-bold transition-all shadow-sm active:scale-95 w-full sm:w-auto whitespace-nowrap"
                              >
                                <Key size={10} /> 發送密碼
                              </button>
                              <button
                                onClick={() => { setAssigningBooking(b); setAssignRoomId(b.room_id); }}
                                className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1.5 rounded-lg font-bold transition-all active:scale-95 flex items-center justify-center gap-1 shadow-sm w-full sm:w-auto whitespace-nowrap"
                              >
                                📍 變更場地
                              </button>
                            </div>
                          )}
                        </td>
                      </>
                    )}
                    
                    {/* ─── 清潔管理稽核模式 (cleaning) 專屬列 ─── */}
                    {tabMode === 'cleaning' && (
                      <>
                        {/* 1. 待指派與執行選單 */}
                        {subTab === 'pending' && (
                          <td className="p-4">
                            <div className="flex flex-col items-stretch gap-1.5 min-w-[130px] max-w-[160px]">
                              {/* 使用狀態 */}
                              {getUsageStatus(b.booking_date, b.start_time) === 'using' ? (
                                <div className="px-2.5 py-1 text-[10px] font-bold rounded-full border text-center bg-sky-50 text-sky-600 border-sky-200 select-none animate-pulse">
                                  ● 使用者使用中
                                </div>
                              ) : getUsageStatus(b.booking_date, b.start_time) === 'not_started' ? (
                                <div className="px-2.5 py-1 text-[10px] font-bold rounded-full border text-center bg-slate-50 text-slate-400 border-slate-200 select-none">
                                  尚未開始
                                </div>
                              ) : (
                                <div className="px-2.5 py-1 text-[10px] font-bold rounded-full border text-center bg-slate-50 text-slate-400 border-slate-200 select-none">
                                  使用者還未使用
                                </div>
                              )}
                              
                              {/* 指派狀態 */}
                              <div className="px-2 py-0.5 text-[9px] font-black rounded border text-center bg-amber-50 text-amber-700 border-amber-200 select-none animate-pulse">
                                ○ 待指派打掃
                              </div>
                              
                              {(() => {
                                const isNotStarted = getUsageStatus(b.booking_date, b.start_time) === 'not_started';
                                return (
                                  <button
                                    disabled={isNotStarted}
                                    onClick={async () => {
                                      setAssigningCleaningBooking(b);
                                      try {
                                        const res = await apiFetchPublicSpaces(b.rooms?.branch);
                                        if (Array.isArray(res)) setPublicSpaces(res);
                                      } catch (e) {
                                        console.error(e);
                                      }
                                    }}
                                    className={`px-2.5 py-1 text-[10px] font-bold rounded-full text-center w-full transition-all duration-200 border ${
                                      isNotStarted
                                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                        : 'text-indigo-600 hover:bg-indigo-50 border border-indigo-200'
                                    }`}
                                    title={isNotStarted ? '借用時間尚未開始，無法分配打掃' : ''}
                                  >
                                    {isNotStarted ? '時間未到' : '🧹 分配打掃'}
                                  </button>
                                );
                              })()}
                            </div>
                          </td>
                        )}

                        {/* 已指派打掃選單 */}
                        {subTab === 'assigned' && (
                          <td className="p-4">
                            <div className="flex flex-col items-stretch gap-1.5 min-w-[130px] max-w-[160px]">
                              {/* 使用狀態 */}
                              {getUsageStatus(b.booking_date, b.start_time) === 'using' ? (
                                <div className="px-2.5 py-1 text-[10px] font-bold rounded-full border text-center bg-sky-50 text-sky-600 border-sky-200 select-none animate-pulse">
                                  ● 使用者使用中
                                </div>
                              ) : getUsageStatus(b.booking_date, b.start_time) === 'not_started' ? (
                                <div className="px-2.5 py-1 text-[10px] font-bold rounded-full border text-center bg-slate-50 text-slate-400 border-slate-200 select-none">
                                  尚未開始
                                </div>
                              ) : (
                                <div className="px-2.5 py-1 text-[10px] font-bold rounded-full border text-center bg-slate-50 text-slate-400 border-slate-200 select-none">
                                  使用者還未使用
                                </div>
                              )}
                              
                              {/* 指派狀態 */}
                              <div className="px-2 py-0.5 text-[9px] font-black rounded border text-center bg-emerald-50 text-emerald-700 border-emerald-200 select-none">
                                ● 已指派打掃
                              </div>
                              
                              <button
                                onClick={async () => {
                                  setAssigningCleaningBooking(b);
                                  try {
                                    const res = await apiFetchPublicSpaces(b.rooms?.branch);
                                    if (Array.isArray(res)) setPublicSpaces(res);
                                  } catch (e) {
                                    console.error(e);
                                  }
                                }}
                                className="px-2.5 py-1 text-[10px] font-bold rounded-full text-indigo-600 hover:bg-indigo-50 border border-indigo-200 transition-colors text-center w-full"
                              >
                                🧹 重新分配
                              </button>
                              {cleanAssignText && (
                                <div className="text-[9px] text-emerald-600 font-semibold text-center mt-0.5 bg-emerald-50/30 py-0.5 border border-emerald-100 rounded">
                                  指派：{cleanAssignText}
                                </div>
                              )}
                            </div>
                          </td>
                        )}

                        {/* 2. 待清潔檢查選單 */}
                        {subTab === 'operations' && (
                          <td className="p-4">
                            <div className="flex flex-col items-stretch gap-1.5 min-w-[130px]">
                              {isSubmitted ? (
                                <>
                                  <div className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md font-bold animate-pulse text-center select-none">
                                    {assignState === 'resubmitted' ? '🔔 待檢查 (已複檢)' : '🔔 待檢查 (已打掃)'}
                                  </div>
                                  <button
                                    onClick={() => setInspectingBooking(b)}
                                    className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors shadow-sm text-center"
                                  >
                                    🔍 待檢查
                                  </button>
                                  <button
                                    onClick={() => handleRejectCleaning(b)}
                                    className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors shadow-sm text-center"
                                  >
                                    ❌ 檢查退回
                                  </button>
                                </>
                              ) : isRejected ? (
                                <>
                                  <div className="text-[10px] text-rose-600 bg-rose-50 border border-rose-200 px-2 py-1 rounded-md font-bold text-center select-none">
                                    ⚠️ 檢查退回 (待改善)
                                  </div>
                                  <button
                                    onClick={() => setInspectingBooking(b)}
                                    className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors shadow-sm text-center animate-pulse"
                                  >
                                    🔍 待檢查
                                  </button>
                                </>
                              ) : null}
                              {cleanAssignText && (
                                <div className="text-[9px] text-emerald-600 font-semibold text-center mt-0.5">
                                  指派：{cleanAssignText}
                                </div>
                              )}
                            </div>
                          </td>
                        )}

                        {/* 3. 已歸還/打掃記錄選單 */}
                        {subTab === 'all' && (
                          <>
                            <td className="p-4">
                              <div className="flex flex-col items-stretch gap-1.5 min-w-[130px]">
                                {b.is_returned ? (
                                  <span className="px-2.5 py-1 text-[10px] font-bold rounded-full border text-center bg-emerald-50 text-emerald-700 border-emerald-200 select-none">
                                    歸還成功
                                  </span>
                                ) : overdue ? (
                                  <div className="flex flex-col gap-1 items-stretch">
                                    <span className="px-2.5 py-1 text-[10px] font-extrabold rounded-md border text-center bg-rose-50 text-rose-700 border-rose-200 select-none">
                                      🚨 逾期未歸還
                                    </span>
                                    {b.violation && (
                                      <div className="text-[9px] text-rose-600 bg-rose-50/50 border border-rose-100 py-0.5 rounded text-center font-bold">
                                        已記點: {b.violation.reason || "未完整復歸"}
                                      </div>
                                    )}
                                    <div className="text-[9px] text-slate-500 bg-slate-50 border border-slate-200 py-0.5 rounded text-center font-semibold">
                                      {isSubmitted
                                        ? '打掃狀態: 待清潔檢查'
                                        : isRejected
                                        ? '打掃狀態: 清潔退回'
                                        : cleanAssignText
                                        ? `打掃狀態: 已指派(${cleanAssignText})`
                                        : '打掃狀態: 未指派'}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs italic text-center">無指派/進行中</span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black whitespace-nowrap border bg-emerald-50 text-emerald-700 border-emerald-200">
                                已核可
                              </span>
                            </td>
                          </>
                        )}
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── 拒絕預約原因 Modal ── */}
      {rejectionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" aria-label="拒絕預約申請" className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <span className="text-rose-600 text-xl font-black">✕</span>
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800">拒絕預約申請</h3>
                <div className="text-xs text-slate-500 mt-0.5">借用人：{rejectionModal.bookingName}</div>
              </div>
            </div>
            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                拒絕原因 <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="請說明拒絕此預約申請的原因（例如：場地時段已被保留、不符合使用規範等）"
                rows={4}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-400 resize-none transition-all"
                autoFocus
              />
              {rejectionReason.trim().length === 0 && (
                <p className="text-[11px] text-rose-500 mt-1.5 font-medium">⚠ 必須填寫拒絕原因才能送出</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setRejectionModal(null); setRejectionReason(''); }}
                className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-3 px-4 rounded-xl transition-all text-sm"
              >
                取消
              </button>
              <button
                onClick={handleConfirmRejection}
                disabled={!rejectionReason.trim()}
                className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-all text-sm shadow-md active:scale-95"
              >
                確認拒絕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 分配場地 Modal */}
      {assigningBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" aria-label="分配與變更場地" className="bg-white rounded-3xl p-5 sm:p-6 md:p-8 max-w-md w-full max-h-[82dvh] sm:max-h-[85dvh] overflow-y-auto shadow-2xl relative border border-slate-100">
            <button type="button" onClick={() => setAssigningBooking(null)} aria-label="關閉視窗" className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors font-bold text-lg">✕</button>
            <h3 className="text-xl font-black text-slate-800 mb-4">📍 分配與變更場地</h3>
            <div className="mb-6 space-y-2">
              <div className="text-sm font-bold text-slate-700">申請單資訊</div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="font-bold text-indigo-700 whitespace-pre-wrap break-all">{assigningBooking.purpose} ({assigningBooking.attendance_count}人)</div>
                <div className="text-sm text-slate-600 mt-1">{assigningBooking.booking_date} {assigningBooking.start_time?.substring(0, 5)} - {assigningBooking.end_time?.substring(0, 5)}</div>
                <div className="text-xs text-slate-500 mt-1">借用人：{assigningBooking.full_name}</div>
              </div>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-700">選擇要分配的實體場地</label>
              <select value={assignRoomId || ''} onChange={e => setAssignRoomId(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800">
                <option value="" disabled>請選擇場地</option>
                {availableRooms.map(r => <option key={r.id} value={r.id}>{r.name} (容納: {r.capacity}人)</option>)}
              </select>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setAssigningBooking(null)} className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold py-3 px-4 rounded-xl transition-all">取消</button>
              <button
                disabled={!assignRoomId || assignRoomId === assigningBooking.room_id}
                onClick={handleAssignRoom}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >確認分配</button>
            </div>
          </div>
        </div>
      )}

      {/* 分配公共空間打掃 Modal */}
      {assigningCleaningBooking && (
        <AssignCleaningModal
          booking={{
            ...assigningCleaningBooking,
            room_name: assigningCleaningBooking.rooms?.name || assigningCleaningBooking.room_name || ''
          }}
          bookings={data}
          publicSpaces={publicSpaces}
          getToken={getToken}
          onSuccess={(msg) => alert(msg)}
          onClose={() => setAssigningCleaningBooking(null)}
          onRefresh={onRefresh}
        />
      )}

      {/* 現場實地安全清潔稽核 Modal */}
      {inspectingBooking && (
        <AdminInspectionModal
          booking={{
            ...inspectingBooking,
            room_name: inspectingBooking.rooms?.name || inspectingBooking.room_name || ''
          }}
          getToken={getToken}
          onSuccess={(msg) => alert(msg)}
          onClose={() => setInspectingBooking(null)}
          onRefresh={onRefresh}
        />
      )}

      {/* 衝突拖曳調整看板 */}
      {boardOpen && (
        <ConflictBoard
          data={data}
          getToken={getToken}
          onClose={() => setBoardOpen(false)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
