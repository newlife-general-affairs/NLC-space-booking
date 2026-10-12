import { useState, useEffect } from 'react';
import { useAuth } from '../auth';
import {
  apiFetchSpecialBookings,
  apiUpdateBookingStatus,
  apiUpdateBooking,
  apiDeleteBooking,
  apiFetchRooms
} from '../api';
import { Calendar, Download, Building2, Search, ArrowLeft, Pencil, Trash2, Check, X } from 'lucide-react';

interface Room {
  id: number;
  name: string;
  branch: string;
}

interface SpecialBooking {
  id: number;
  room_id: number;
  rooms: { name: string; branch: string };
  full_name: string;
  pastoral_zone: string;
  purpose: string;
  booking_type: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  attendance_count: number;
  status: string;
  phone?: string;
}

interface DisplayRow {
  date: string;
  dayOfWeek: string;
  eventName: string;
  bookingType: string;
  mainTimeText: string;
  otherRoomsText: string;
  isFirstOfEvent: boolean;
  eventRowsCount: number;
  mainTimeRowSpan: number;
  otherRoomsRowSpan: number;
}

function getChineseDayOfWeek(dateStr: string) {
  const dateObj = new Date(dateStr);
  const day = dateObj.getDay();
  return ['日', '一', '二', '三', '四', '五', '六'][day];
}

function formatCleanTimeRange(start: string, end: string) {
  const startH = start.substring(0, 2);
  const startM = start.substring(3, 5);
  const endH = end.substring(0, 2);
  const endM = end.substring(3, 5);
  if (startM === '00' && endM === '00') {
    return `${parseInt(startH)}-${parseInt(endH)}`;
  }
  return `${startH}${startM}-${endH}${endM}`;
}

export default function SpecialEventsPage({
  currentBranch,
  onBack,
  hideBack = false,
  isAdmin = false,
}: {
  currentBranch: string;
  onBack?: () => void;
  hideBack?: boolean;
  isAdmin?: boolean;
}) {
  const { getToken } = useAuth();
  const [bookings, setBookings] = useState<SpecialBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [hideExpired, setHideExpired] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sub tab selection
  const [activeSubTab, setActiveSubTab] = useState<'view' | 'edit'>('view');

  // Available rooms for editing
  const [rooms, setRooms] = useState<Room[]>([]);

  // Editing state
  const [editingBooking, setEditingBooking] = useState<SpecialBooking | null>(null);
  const [editPurpose, setEditPurpose] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editRoomId, setEditRoomId] = useState<number>(0);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPastoralZone, setEditPastoralZone] = useState('');
  const [editType, setEditType] = useState('重要');
  const [editAttendance, setEditAttendance] = useState(10);

  const refreshSpecialBookings = () => {
    setLoading(true);
    apiFetchSpecialBookings(currentBranch, getToken() || undefined)
      .then((data) => {
        if (Array.isArray(data)) {
          setBookings(data);
        }
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    refreshSpecialBookings();
  }, [currentBranch, getToken]);

  useEffect(() => {
    if (isAdmin) {
      apiFetchRooms(currentBranch)
        .then((data) => {
          if (Array.isArray(data)) setRooms(data);
        })
        .catch(console.error);
    }
  }, [isAdmin, currentBranch]);

  const handleApproveBooking = async (b: SpecialBooking) => {
    if (!window.confirm(`確定要核可「${b.full_name}」的預約申請嗎？`)) return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await apiUpdateBookingStatus(token, b.id, 'approved');
      if (res.ok) {
        refreshSpecialBookings();
      } else {
        const err = await res.json();
        alert(err.error || '核可失敗');
      }
    } catch {
      alert('操作失敗，請檢查網路連線');
    }
  };

  const handleRejectBooking = async (b: SpecialBooking) => {
    const reason = window.prompt(`請輸入拒絕「${b.full_name}」預約申請的原因：`);
    if (reason === null) return;
    if (!reason.trim()) return alert('拒絕原因不能為空');
    const token = getToken();
    if (!token) return;
    try {
      const res = await apiUpdateBookingStatus(token, b.id, 'rejected', reason.trim());
      if (res.ok) {
        refreshSpecialBookings();
      } else {
        const err = await res.json();
        alert(err.error || '拒絕失敗');
      }
    } catch {
      alert('操作失敗，請檢查網路連線');
    }
  };

  const handleDeleteBooking = async (b: SpecialBooking) => {
    if (!window.confirm(`確定要刪除「${b.full_name}」的這筆預約申請嗎？此動作無法復原。`)) return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await apiDeleteBooking(token, b.id);
      if (res.ok) {
        refreshSpecialBookings();
      } else {
        const err = await res.json();
        alert(err.error || '刪除失敗');
      }
    } catch {
      alert('操作失敗，請檢查網路連線');
    }
  };

  const handleOpenEdit = (b: SpecialBooking) => {
    setEditingBooking(b);
    setEditPurpose(b.purpose || '');
    setEditDate(b.booking_date || '');
    setEditStartTime(b.start_time?.substring(0, 5) || '');
    setEditEndTime(b.end_time?.substring(0, 5) || '');
    setEditRoomId(b.room_id || 0);
    setEditFullName(b.full_name || '');
    setEditPhone(b.phone || '');
    setEditPastoralZone(b.pastoral_zone || '');
    setEditType(b.booking_type || '重要');
    setEditAttendance(b.attendance_count || 10);
  };

  const handleSaveEdit = async () => {
    if (!editingBooking) return;
    const token = getToken();
    if (!token) return;

    if (!editPurpose.trim()) return alert('請輸入項目內容 / 活動名稱');
    if (!editDate) return alert('請選擇日期');
    if (!editStartTime || !editEndTime) return alert('請選擇時間');
    if (editStartTime >= editEndTime) return alert('結束時間必須大於開始時間');
    if (!editRoomId) return alert('請選擇場地空間');
    if (!editFullName.trim()) return alert('請輸入聯絡人姓名');

    const updatedData = {
      purpose: editPurpose.trim(),
      booking_date: editDate,
      start_time: editStartTime + ':00',
      end_time: editEndTime + ':00',
      room_id: editRoomId,
      full_name: editFullName.trim(),
      phone: editPhone.trim(),
      pastoral_zone: editPastoralZone.trim(),
      booking_type: editType,
      attendance_count: editAttendance
    };

    try {
      const res = await apiUpdateBooking(token, editingBooking.id, updatedData);
      if (res.ok) {
        setEditingBooking(null);
        refreshSpecialBookings();
      } else {
        const err = await res.json();
        alert(err.error || '更新失敗');
      }
    } catch {
      alert('更新失敗，請檢查網路連線');
    }
  };

  // Group and sort logic
  // 1. Filter by search query and date parameters
  const todayStr = (() => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const taipeiDate = new Date(utc + (3600000 * 8));
    const yyyy = taipeiDate.getFullYear();
    const mm = String(taipeiDate.getMonth() + 1).padStart(2, '0');
    const dd = String(taipeiDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  })();

  console.log('[SpecialEventsPage debug]', {
    bookingsCount: bookings.length,
    hideExpired,
    startDate,
    endDate,
    todayStr,
    sampleBooking: bookings[0] ? { date: bookings[0].booking_date, name: bookings[0].full_name } : null
  });

  const filteredBookings = bookings.filter((b) => {
    // Hide expired info
    if (hideExpired && b.booking_date < todayStr) {
      return false;
    }

    // Start date filter
    if (startDate && b.booking_date < startDate) {
      return false;
    }

    // End date filter
    if (endDate && b.booking_date > endDate) {
      return false;
    }

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (b.full_name && b.full_name.toLowerCase().includes(q)) ||
      (b.purpose && b.purpose.toLowerCase().includes(q)) ||
      (b.rooms?.name && b.rooms.name.toLowerCase().includes(q)) ||
      (b.booking_date && b.booking_date.includes(q))
    );
  });

  console.log('[SpecialEventsPage debug] filteredBookingsCount:', filteredBookings.length);

  // 2. Group bookings by event key: `full_name` + `booking_type`
  const eventGroups: Record<string, SpecialBooking[]> = {};
  filteredBookings.forEach((b) => {
    const key = `${(b.full_name || '').trim()}::${b.booking_type || ''}`;
    if (!eventGroups[key]) {
      eventGroups[key] = [];
    }
    eventGroups[key].push(b);
  });

  // 3. For each group, get unique dates, sorted chronologically, and identify the earliest date
  const groupedEventsList = Object.entries(eventGroups).map(([key, list]) => {
    const [eventName, bookingType] = key.split('::');
    
    // Group by unique date
    const dateGroups: Record<string, SpecialBooking[]> = {};
    list.forEach((b) => {
      if (!dateGroups[b.booking_date]) {
        dateGroups[b.booking_date] = [];
      }
      dateGroups[b.booking_date].push(b);
    });

    const sortedDates = Object.keys(dateGroups).sort((a, b) => a.localeCompare(b));
    const earliestDate = sortedDates[0] || '';

    return {
      eventName,
      bookingType,
      dateGroups,
      sortedDates,
      earliestDate,
    };
  });

  // 4. Sort event groups by their earliest date chronologically
  groupedEventsList.sort((a, b) => a.earliestDate.localeCompare(b.earliestDate));

  // 5. Flatten back to display rows with rowSpan calculations
  const displayRows: DisplayRow[] = [];
  groupedEventsList.forEach((group) => {
    const totalRowsCount = group.sortedDates.length;

    // Pre-calculate data for each date row in this event group
    const datesData = group.sortedDates.map((date) => {
      const dayBookings = group.dateGroups[date];

      // Find bookings for rooms that contain "會堂"
      const mainBookings = dayBookings.filter((b) => b.rooms?.name.includes('會堂'));
      const otherBookings = dayBookings.filter((b) => !b.rooms?.name.includes('會堂'));

      let mainTimeText = '';
      if (mainBookings.length > 0) {
        mainTimeText = mainBookings
          .map((b) => {
            const cleanEventName = group.eventName.trim();
            let cleanPurpose = b.purpose.trim();
            
            // Strip event name prefix from purpose if it starts with it
            if (cleanPurpose.startsWith(cleanEventName)) {
              cleanPurpose = cleanPurpose.substring(cleanEventName.length).trim();
            }
            // Strip purpose if event name starts with it (e.g. Event: "健康講座第三期", Purpose: "健康講座")
            if (cleanEventName.startsWith(cleanPurpose)) {
              cleanPurpose = '';
            }

            if (!cleanPurpose) {
              return formatCleanTimeRange(b.start_time, b.end_time);
            }
            return `${cleanPurpose}${formatCleanTimeRange(b.start_time, b.end_time)}`;
          })
          .join('、');
      } else if (otherBookings.length === 1) {
        const b = otherBookings[0];
        const cleanEventName = group.eventName.trim();
        let cleanPurpose = b.purpose.trim();
        
        if (cleanPurpose.startsWith(cleanEventName)) {
          cleanPurpose = cleanPurpose.substring(cleanEventName.length).trim();
        }
        if (cleanEventName.startsWith(cleanPurpose)) {
          cleanPurpose = '';
        }
        
        const purposePart = cleanPurpose ? `/${cleanPurpose}` : '';
        mainTimeText = `${formatCleanTimeRange(b.start_time, b.end_time)}${purposePart}/${b.attendance_count}人/${b.rooms?.name}`;
      }

      let otherRoomsText = '';
      if (mainBookings.length > 0 || otherBookings.length > 1) {
        const targets = mainBookings.length > 0 ? otherBookings : otherBookings.slice(1);
        otherRoomsText = targets
          .map((b) => {
            const cleanEventName = group.eventName.trim();
            let cleanPurpose = b.purpose.trim();
            
            if (cleanPurpose.startsWith(cleanEventName)) {
              cleanPurpose = cleanPurpose.substring(cleanEventName.length).trim();
            }
            if (cleanEventName.startsWith(cleanPurpose)) {
              cleanPurpose = '';
            }
            
            const purposePart = cleanPurpose ? `/${cleanPurpose}` : '';
            return `${formatCleanTimeRange(b.start_time, b.end_time)}${purposePart}/${b.attendance_count}人/${b.rooms?.name}`;
          })
          .join('\n');
      }

      return {
        date,
        mainTimeText,
        otherRoomsText,
      };
    });

    // Compute row spans for mainTimeText and otherRoomsText by merging consecutive identical values
    const mainTimeRowSpans = new Array(totalRowsCount).fill(1);
    let i = 0;
    while (i < totalRowsCount) {
      let j = i + 1;
      while (j < totalRowsCount && datesData[j].mainTimeText === datesData[i].mainTimeText) {
        mainTimeRowSpans[j] = 0;
        j++;
      }
      mainTimeRowSpans[i] = j - i;
      i = j;
    }

    const otherRoomsRowSpans = new Array(totalRowsCount).fill(1);
    let k = 0;
    while (k < totalRowsCount) {
      let l = k + 1;
      while (l < totalRowsCount && datesData[l].otherRoomsText === datesData[k].otherRoomsText) {
        otherRoomsRowSpans[l] = 0;
        l++;
      }
      otherRoomsRowSpans[k] = l - k;
      k = l;
    }

    // Push dates to displayRows with computed rowspan values
    datesData.forEach((d, dateIdx) => {
      displayRows.push({
        date: d.date.replace(/-/g, '/'),
        dayOfWeek: getChineseDayOfWeek(d.date),
        eventName: group.eventName,
        bookingType: group.bookingType,
        mainTimeText: d.mainTimeText,
        otherRoomsText: d.otherRoomsText,
        isFirstOfEvent: dateIdx === 0,
        eventRowsCount: totalRowsCount,
        mainTimeRowSpan: mainTimeRowSpans[dateIdx],
        otherRoomsRowSpan: otherRoomsRowSpans[dateIdx],
      });
    });
  });

  // Export CSV function
  const handleExportCSV = () => {
    if (displayRows.length === 0) return;
    const headers = ['日期', '週', '內容', '會堂場地借用', '其他場地需求'];
    
    // Process rows for CSV
    const csvRows = [headers.join(',')];
    
    displayRows.forEach((r) => {
      const dateCol = `"${r.date}"`;
      const weekCol = `"${r.dayOfWeek}"`;
      const nameCol = r.isFirstOfEvent ? `"${r.eventName}"` : '""';
      const mainCol = r.mainTimeRowSpan > 0 ? `"${r.mainTimeText.replace(/"/g, '""')}"` : '""';
      const otherCol = r.otherRoomsRowSpan > 0 ? `"${r.otherRoomsText.replace(/\n/g, '; ').replace(/"/g, '""')}"` : '""';
      csvRows.push([dateCol, weekCol, nameCol, mainCol, otherCol].join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\n'); // Add BOM for excel traditional Chinese encoding support
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${currentBranch}_婚禮與重要活動安排表_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 py-4 px-3 md:px-4 animate-in fade-in duration-300">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm">
        <div className="flex items-center gap-3">
          {!hideBack && onBack && (
            <button
              onClick={onBack}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-1.5 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 select-none hover:scale-105 active:scale-95 duration-200"
            >
              <ArrowLeft size={14} /> 返回
            </button>
          )}
          <div>
            <span className="text-[10px] md:text-xs font-black text-indigo-600/80 tracking-wider uppercase flex items-center gap-1 select-none">
              <Building2 size={12} /> {currentBranch} 據點
            </span>
            <h2 className="text-lg md:text-2xl font-black text-slate-800 tracking-tight mt-0.5">
              💒 婚禮與重要活動安排表
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Export button */}
          <button
            onClick={handleExportCSV}
            disabled={displayRows.length === 0}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Download size={14} /> 匯出 CSV 試算表
          </button>
        </div>
      </div>

      {/* Admin Tab Mode selection */}
      {isAdmin && (
        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1.5 max-w-[280px] select-none shadow-inner">
          <button
            onClick={() => setActiveSubTab('view')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
              activeSubTab === 'view'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            📋 呈現結果
          </button>
          <button
            onClick={() => setActiveSubTab('edit')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
              activeSubTab === 'edit'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ✏️ 編輯管理
          </button>
        </div>
      )}

      {/* Filter and Search Panel */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
          {/* Text Search */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
            <Search className="text-slate-400 mr-2 shrink-0" size={16} />
            <input
              type="text"
              placeholder="搜尋活動內容、場地或日期..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-bold text-slate-707 placeholder-slate-400 bg-transparent outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold pl-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Date Range Picker */}
          <div className="flex items-center gap-2 lg:col-span-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 w-full shadow-sm">
              <span className="text-[10px] font-extrabold text-slate-400 shrink-0">開始日期</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
              />
              {startDate && (
                <button
                  onClick={() => setStartDate('')}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
            <span className="text-slate-400 text-xs font-bold shrink-0">至</span>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 w-full shadow-sm">
              <span className="text-[10px] font-extrabold text-slate-400 shrink-0">結束日期</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
              />
              {endDate && (
                <button
                  onClick={() => setEndDate('')}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Checkbox Toggle and Clear */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 flex-wrap gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-600">
            <input
              type="checkbox"
              checked={hideExpired}
              onChange={(e) => setHideExpired(e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
            />
            <span>隱藏已結束 (過期) 的活動</span>
          </label>
          
          {(searchQuery || startDate || endDate || !hideExpired) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStartDate('');
                setEndDate('');
                setHideExpired(true);
              }}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              重設篩選條件
            </button>
          )}
        </div>
      </div>

      {/* Tab contents */}
      {activeSubTab === 'view' ? (
        /* Spreadsheet Main Grid */
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-slate-500 font-bold text-sm">正在載入安排表資料...</p>
            </div>
          ) : displayRows.length === 0 ? (
            <div className="py-24 text-center text-slate-400 italic bg-white flex flex-col items-center justify-center gap-3">
              <div className="p-4 bg-slate-50 text-slate-400 rounded-full">
                <Calendar size={28} />
              </div>
              <div className="font-bold text-slate-500">此據點目前無任何婚禮與重要活動借用安排</div>
            </div>
          ) : (
            <>
            {/* 手機版：唯讀卡片式時間軸 */}
            <div className="md:hidden divide-y divide-slate-100">
              {displayRows.map((row, idx) => (
                <div key={idx} className={`p-4 ${row.isFirstOfEvent ? 'bg-slate-50/40' : ''}`}>
                  {row.isFirstOfEvent && (
                    <div className="font-black text-slate-900 text-sm mb-2">{row.eventName}</div>
                  )}
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
                    <span>{row.date}</span>
                    <span className="text-slate-300">·</span>
                    <span>週{row.dayOfWeek}</span>
                  </div>
                  {row.mainTimeText && (
                    <div className="text-xs text-slate-700 font-semibold">{row.mainTimeText}</div>
                  )}
                  {row.otherRoomsText && (
                    <div className="text-[11px] text-slate-500 whitespace-pre-line mt-1">{row.otherRoomsText}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse border-2 border-black">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-black select-none">
                    <th colSpan={4} className="p-3 border-r-2 border-black text-center font-black text-slate-800 bg-slate-100/70 border-b-2 border-black text-sm">
                      會堂場地借用
                    </th>
                    <th className="p-3 text-center font-black text-slate-800 bg-slate-100/70 border-b-2 border-black text-sm">
                      其他場地需求
                    </th>
                  </tr>
                  <tr className="bg-slate-50/50 border-b-2 border-black text-slate-500 font-bold select-none">
                    <th className="p-3 text-center w-24 border-r-2 border-black border-b-2 border-black">日期</th>
                    <th className="p-3 text-center w-12 border-r-2 border-black border-b-2 border-black">週</th>
                    <th className="p-3 text-left w-56 border-r-2 border-black border-b-2 border-black">內容</th>
                    <th className="p-3 text-left w-64 border-r-2 border-black border-b-2 border-black">時間</th>
                    <th className="p-3 text-left border-b-2 border-black">其他場地需求</th>
                  </tr>
                </thead>
                <tbody className="bg-white font-medium text-slate-700">
                  {displayRows.map((row, idx) => {
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        {/* Date */}
                        <td className="p-3 text-center border-r-2 border-black border-b-2 border-black whitespace-nowrap font-bold text-slate-600">
                          {row.date}
                        </td>
                        {/* Day of Week */}
                        <td className="p-3 text-center border-r-2 border-black border-b-2 border-black whitespace-nowrap font-bold text-slate-500">
                          {row.dayOfWeek}
                        </td>
                        {/* Event Name (Merged vertically via rowspan) */}
                        {row.isFirstOfEvent ? (
                          <td
                            rowSpan={row.eventRowsCount}
                            className="p-3 border-r-2 border-black border-b-2 border-black font-black text-slate-900 bg-slate-50/30 text-sm align-middle"
                          >
                            <div className="max-w-[14rem] break-words leading-relaxed">
                              {row.eventName}
                            </div>
                          </td>
                        ) : null}
                        {/* Main Room Time (Merged dynamically via rowspan) */}
                        {row.mainTimeRowSpan > 0 ? (
                          <td
                            rowSpan={row.mainTimeRowSpan}
                            className="p-3 border-r-2 border-black border-b-2 border-black font-bold text-slate-800 bg-white leading-relaxed align-middle"
                          >
                            {row.mainTimeText ? (
                              <span>{row.mainTimeText}</span>
                            ) : (
                              <span className="text-slate-300 italic">-</span>
                            )}
                          </td>
                        ) : null}
                        {/* Other Requirements (Merged dynamically via rowspan) */}
                        {row.otherRoomsRowSpan > 0 ? (
                          <td
                            rowSpan={row.otherRoomsRowSpan}
                            className="p-3 bg-white leading-relaxed border-b-2 border-black border-r-2 border-black align-middle"
                          >
                            {row.otherRoomsText ? (
                              <div className="whitespace-pre-line text-slate-500 font-semibold text-[11px]">
                                {row.otherRoomsText}
                              </div>
                            ) : (
                              <span className="text-slate-300 italic">-</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      ) : (
        /* Edit Management Table List */
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden p-6 space-y-4">
          <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2 select-none">
            ✏️ 婚禮與重要活動借用清單管理
          </h3>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-slate-500 font-bold text-sm">正在載入資料...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="py-24 text-center text-slate-400 italic bg-white flex flex-col items-center justify-center gap-3">
              <div className="p-4 bg-slate-50 text-slate-400 rounded-full">
                <Calendar size={28} />
              </div>
              <div className="font-bold text-slate-500">無符合條件的活動預約</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold select-none">
                    <th className="p-3">項目名稱/內容</th>
                    <th className="p-3">類型</th>
                    <th className="p-3">日期 & 時間</th>
                    <th className="p-3">場地空間</th>
                    <th className="p-3">借用人資訊</th>
                    <th className="p-3">狀態</th>
                    <th className="p-3 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white font-medium text-slate-700 divide-y divide-slate-100">
                  {filteredBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-bold text-slate-900">{b.purpose}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.booking_type === '婚禮' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          {b.booking_type}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-600">{b.booking_date}</div>
                        <div className="font-mono text-indigo-600 text-[10px] mt-0.5">
                          {b.start_time?.substring(0, 5)} - {b.end_time?.substring(0, 5)}
                        </div>
                      </td>
                      <td className="p-3 font-bold text-slate-800">{b.rooms?.name || '未知場地'}</td>
                      <td className="p-3">
                        <div className="font-bold">{b.full_name}</div>
                        {b.phone && <div className="text-[10px] text-slate-500 mt-0.5">📞 {b.phone}</div>}
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">{b.pastoral_zone || '無區名'}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.status === 'approved' 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                            : 'bg-rose-50 text-rose-500 border border-rose-100 animate-pulse'
                        }`}>
                          {b.status === 'approved' ? '已核可' : '待審核'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {b.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApproveBooking(b)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95 flex items-center justify-center gap-1"
                                title="核可"
                              >
                                <Check size={12} /> 核可
                              </button>
                              <button
                                onClick={() => handleRejectBooking(b)}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-2 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95 flex items-center justify-center gap-1"
                                title="拒絕"
                              >
                                <X size={12} /> 拒絕
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleOpenEdit(b)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95 flex items-center justify-center gap-1"
                            title="編輯"
                          >
                            <Pencil size={12} /> 編輯
                          </button>
                          <button
                            onClick={() => handleDeleteBooking(b)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95 flex items-center justify-center gap-1"
                            title="刪除"
                          >
                            <Trash2 size={12} /> 刪除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Booking Modal */}
      {editingBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                ✏️ 編輯活動預約詳細資料
              </h3>
              <button
                onClick={() => setEditingBooking(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-600">項目內容 / 活動名稱</label>
                <input
                  type="text"
                  value={editPurpose}
                  onChange={(e) => setEditPurpose(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-bold text-slate-700 bg-white"
                  placeholder="例如: 婚禮、主日崇拜"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">預約性質</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-bold text-slate-700 bg-white"
                  >
                    <option value="重要">重要</option>
                    <option value="婚禮">婚禮</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600">預估人數</label>
                  <input
                    type="number"
                    value={editAttendance}
                    onChange={(e) => setEditAttendance(Number(e.target.value))}
                    className="w-full p-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-bold text-slate-700 bg-white"
                    min={1}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600">日期</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-bold text-slate-700 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">開始時間</label>
                  <input
                    type="time"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-bold text-slate-700 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">結束時間</label>
                  <input
                    type="time"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-bold text-slate-700 bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600">借用空間場地</label>
                <select
                  value={editRoomId}
                  onChange={(e) => setEditRoomId(Number(e.target.value))}
                  className="w-full p-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-bold text-slate-700 bg-white"
                >
                  <option value={0}>請選擇空間...</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">聯絡人姓名</label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-bold text-slate-700 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">聯絡電話</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-bold text-slate-700 bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600">所屬牧區</label>
                <input
                  type="text"
                  value={editPastoralZone}
                  onChange={(e) => setEditPastoralZone(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-bold text-slate-700 bg-white"
                  placeholder="例如: 仁愛一區"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setEditingBooking(null)}
                className="bg-white border border-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all active:scale-95 shadow-sm"
              >
                儲存變更
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
