import React, { useState, useMemo } from 'react';
import {
  FileDown,
  SlidersHorizontal,
  Search,
  Check,
  X,
  Calendar,
  Clock,
  MapPin,
  Users,
  Key,
  AlertTriangle,
  Map,
  Menu,
  FileText,
  AlertCircle,
  ChevronDown,
  CheckCircle,
  Shield,
  Loader2,
  Lock,
  ClipboardList,
  Bell,
  Settings,
  Grid,
  Radio,
  FileSpreadsheet,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Booking } from '@church/shared/types';
import { useEscapeKey } from '../hooks/useEscapeKey';

export interface MobileAdminDashboardProps {
  currentBranch?: string;
  initialBookings?: Booking[];
  onApprove?: (id: number) => void;
  onReject?: (id: number, reason: string) => void;
  onAssignRoom?: (id: number, roomName: string) => void;
  onImportSheet?: (url: string) => Promise<void>;
  roomsList?: string[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  allowedTabs?: Array<{ id: string; label: string }>;
  pendingCount?: number;
  children?: React.ReactNode;
}

const defaultMockBookings: Booking[] = [
  {
    id: 101,
    full_name: '張家豪',
    room_name: '大禮堂',
    booking_date: '2026-07-16',
    start_time: '09:00',
    end_time: '12:00',
    pastoral_zone: '青少牧區',
    purpose: '小組敬拜練習與主日排練',
    attendance_count: 15,
    status: 'pending'
  },
  {
    id: 102,
    full_name: '李美玲',
    room_name: '第一教室',
    booking_date: '2026-07-16',
    start_time: '14:00',
    end_time: '16:00',
    pastoral_zone: '社青牧區',
    purpose: '成人主日學造就課程',
    attendance_count: 8,
    status: 'pending'
  },
  {
    id: 103,
    full_name: '陳志強',
    room_name: '副堂',
    booking_date: '2026-07-17',
    start_time: '19:30',
    end_time: '21:30',
    pastoral_zone: '成人牧區',
    purpose: '週五禱告會預備會',
    attendance_count: 25,
    status: 'approved',
    access_code: '882091'
  },
  {
    id: 104,
    full_name: '林欣怡',
    room_name: '第三教室',
    booking_date: '2026-07-18',
    start_time: '10:00',
    end_time: '11:30',
    pastoral_zone: '兒童牧區',
    purpose: '主日兒童事工會議',
    attendance_count: 6,
    status: 'approved',
    access_code: '451029'
  },
  {
    id: 105,
    full_name: '王小明',
    room_name: '第一教室',
    booking_date: '2026-07-14',
    start_time: '13:00',
    end_time: '15:00',
    pastoral_zone: '青少牧區',
    purpose: '吉他彈唱教學',
    attendance_count: 4,
    status: 'rejected'
  }
] as Booking[];

const defaultRooms = ['大禮堂', '副堂', '第一教室', '第二教室', '第三教室'];

const defaultAllowedTabs = [
  { id: 'bookings', label: '預約審核' },
  { id: 'issues', label: '異常回報' },
  { id: 'map', label: '即時地圖' },
  { id: 'special-events', label: '婚禮重要活動' },
  { id: 'cleaning', label: '打掃清潔稽核' },
  { id: 'violations', label: '違規紀錄名單' },
  { id: 'weekly', label: '場地借用概況' },
  { id: 'announcements', label: '據點公告管理' },
  { id: 'rooms', label: '場地空間配置' },
  { id: 'public_spaces', label: '公共空間規劃' },
  { id: 'tuya', label: '智慧裝置連線' }
];

export default function MobileAdminDashboard({
  currentBranch = '仁愛堂',
  initialBookings = defaultMockBookings,
  onApprove,
  onReject,
  onAssignRoom,
  onImportSheet,
  roomsList = defaultRooms,
  activeTab: externalActiveTab,
  onTabChange,
  allowedTabs = defaultAllowedTabs,
  pendingCount,
  children
}: MobileAdminDashboardProps) {
  const [internalActiveTab, setInternalActiveTab] = useState('bookings');
  const activeTab = externalActiveTab !== undefined ? externalActiveTab : internalActiveTab;

  const handleTabSelect = (tab: string) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };

  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [subTab, setSubTab] = useState<'pending' | 'lock' | 'history'>('pending');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [timeSortOrder, setTimeSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [filterConflictsOnly, setFilterConflictsOnly] = useState(false);

  const [tempRoom, setTempRoom] = useState<string>('all');
  const [tempSortOrder, setTempSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [tempConflicts, setTempConflicts] = useState(false);

  const [isImportDrawerOpen, setIsImportDrawerOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);
  const [assigningBookingId, setAssigningBookingId] = useState<number | null>(null);
  const [rejectingBookingId, setRejectingBookingId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEscapeKey(() => !isImporting && setIsImportDrawerOpen(false), isImportDrawerOpen);
  useEscapeKey(() => setIsMoreDrawerOpen(false), isMoreDrawerOpen);
  useEscapeKey(() => setAssigningBookingId(null), assigningBookingId !== null);
  useEscapeKey(() => { setRejectingBookingId(null); setRejectionReason(''); }, rejectingBookingId !== null);
  useEscapeKey(() => setIsFilterDrawerOpen(false), isFilterDrawerOpen);

  const validateGoogleSheetUrl = (url: string): boolean => {
    const trimmed = url.trim();
    if (!trimmed) {
      setImportError('請輸入連結網址');
      return false;
    }
    if (/<script|javascript:|data:/i.test(trimmed)) {
      setImportError('輸入包含不安全的安全字元，請重新輸入');
      return false;
    }
    const sheetRegex = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+\/(edit|preview|htmlview|viewform)?/;
    if (!sheetRegex.test(trimmed)) {
      setImportError('無效的連結！請提供合法的 Google 試算表共用網址');
      return false;
    }
    setImportError('');
    return true;
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = validateGoogleSheetUrl(sheetUrl);
    if (!isValid) return;
    const cleanUrl = sheetUrl.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
    setIsImporting(true);
    try {
      if (onImportSheet) {
        await onImportSheet(cleanUrl);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      setImportSuccess(true);
      setSheetUrl('');
      setTimeout(() => {
        setIsImportDrawerOpen(false);
        setImportSuccess(false);
      }, 1500);
    } catch {
      setImportError('解析失敗，請確認該試算表是否已開啟權限');
    } finally {
      setIsImporting(false);
    }
  };

  const escapedSearchQuery = useMemo(() => {
    return searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }, [searchQuery]);

  const sourceBookings = useMemo(() => {
    return externalActiveTab !== undefined ? initialBookings : bookings;
  }, [externalActiveTab, initialBookings, bookings]);

  // Compute Metrics values for cards
  const metrics = useMemo(() => {
    const pending = sourceBookings.filter(b => b.status === 'pending').length;
    const approved = sourceBookings.filter(b => b.status === 'approved').length;
    const total = sourceBookings.length;
    const rejected = sourceBookings.filter(b => b.status === 'rejected').length;
    return { pending, approved, total, rejected };
  }, [sourceBookings]);

  const filteredBookings = useMemo(() => {
    return sourceBookings
      .filter((booking) => {
        if (subTab === 'pending') {
          if (booking.status !== 'pending') return false;
        } else if (subTab === 'lock') {
          if (booking.status !== 'approved') return false;
        } else if (subTab === 'history') {
          if (booking.status === 'pending') return false;
        }
        if (selectedRoom !== 'all' && booking.room_name !== selectedRoom) {
          return false;
        }
        if (filterConflictsOnly) {
          const conflictingRooms = ['大禮堂', '第一教室'];
          if (!conflictingRooms.includes(booking.room_name)) return false;
        }
        if (escapedSearchQuery) {
          const regex = new RegExp(escapedSearchQuery, 'i');
          const matchName = regex.test(booking.full_name);
          const matchRoom = regex.test(booking.room_name);
          const matchPurpose = regex.test(booking.purpose);
          const matchZone = regex.test(booking.pastoral_zone);
          if (!matchName && !matchRoom && !matchPurpose && !matchZone) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(`${a.booking_date}T${a.start_time}`);
        const dateB = new Date(`${b.booking_date}T${b.start_time}`);
        return timeSortOrder === 'newest'
          ? dateB.getTime() - dateA.getTime()
          : dateA.getTime() - dateB.getTime();
      });
  }, [sourceBookings, subTab, selectedRoom, filterConflictsOnly, escapedSearchQuery, timeSortOrder]);

  const openFilterDrawer = () => {
    setTempRoom(selectedRoom);
    setTempSortOrder(timeSortOrder);
    setTempConflicts(filterConflictsOnly);
    setIsFilterDrawerOpen(true);
  };

  const applyFilters = () => {
    setSelectedRoom(tempRoom);
    setTimeSortOrder(tempSortOrder);
    setFilterConflictsOnly(tempConflicts);
    setIsFilterDrawerOpen(false);
  };

  const resetFilters = () => {
    setTempRoom('all');
    setTempSortOrder('newest');
    setTempConflicts(false);
  };

  const handleApproveAction = (id: number) => {
    if (onApprove) {
      onApprove(id);
    } else {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                status: 'approved',
                access_code: Math.floor(100000 + Math.random() * 900000).toString()
              }
            : b
        )
      );
    }
  };

  const confirmRejectAction = () => {
    if (rejectingBookingId === null) return;
    const cleanReason = rejectionReason.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (onReject) {
      onReject(rejectingBookingId, cleanReason);
    } else {
      setBookings((prev) =>
        prev.map((b) => (b.id === rejectingBookingId ? { ...b, status: 'rejected' } : b))
      );
    }
    setRejectingBookingId(null);
    setRejectionReason('');
  };

  const handleAssignAction = (bookingId: number, roomName: string) => {
    if (onAssignRoom) {
      onAssignRoom(bookingId, roomName);
    } else {
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, room_name: roomName } : b)));
    }
    setAssigningBookingId(null);
  };

  const getBottomNavIcon = (id: string, active: boolean) => {
    const cls = `w-5 h-5 ${active ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-400'}`;
    switch (id) {
      case 'bookings':
        return <ClipboardList className={cls} />;
      case 'issues':
        return <AlertTriangle className={cls} />;
      case 'map':
        return <Map className={cls} />;
      default:
        return <Menu className={cls} />;
    }
  };

  const getMoreMenuIcon = (id: string) => {
    const cls = "w-4 h-4 text-zinc-400";
    switch (id) {
      case 'special-events':
        return <FileText className={cls} />;
      case 'cleaning':
        return <CheckCircle className={cls} />;
      case 'violations':
        return <Lock className={cls} />;
      case 'weekly':
        return <Calendar className={cls} />;
      case 'announcements':
        return <Bell className={cls} />;
      case 'rooms':
        return <Settings className={cls} />;
      case 'public_spaces':
        return <Grid className={cls} />;
      case 'tuya':
        return <Radio className={cls} />;
      default:
        return <FileText className={cls} />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col max-w-md mx-auto relative shadow-2xl pb-24 border-x border-zinc-900 select-none">
      
      {/* 頂部導覽列 Header */}
      <header className="sticky top-0 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 z-30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 text-white p-1.5 rounded-lg shadow-sm">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-wider text-white">同工管理看板</h1>
            <div className="flex items-center gap-1 text-[9px] text-zinc-500 font-bold">
              <MapPin className="w-3 h-3 text-zinc-600" />
              <span>{currentBranch}</span>
              <ChevronDown className="w-2.5 h-2.5" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'bookings' && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setIsImportDrawerOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-[10px] font-bold text-zinc-300 shadow-sm focus:outline-none"
            >
              <FileDown className="w-3.5 h-3.5 text-zinc-400" />
              <span>匯入排程</span>
            </motion.button>
          )}
          
          <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-bold text-indigo-400">
            AD
          </div>
        </div>
      </header>

      {/* 主要內容區 */}
      {activeTab === 'bookings' ? (
        <main className="flex-1 p-4 space-y-5 overflow-y-auto">
          
          {/* Segmented Control / Statistics Summary */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-white flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-amber-400" /> 空間核准進度
              </h2>
              <span className="text-[10px] text-zinc-500 font-bold">當前篩選: {filteredBookings.length} 筆</span>
            </div>

            {/* ── Metric Cards with Hover Shimmers ── */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '待審件數', val: metrics.pending, color: 'text-amber-400', path: 'M0,15 Q15,5 30,10 T60,2' },
                { label: '門鎖已發', val: metrics.approved, color: 'text-emerald-400', path: 'M0,12 Q15,14 30,5 T60,10' },
                { label: '本月總數', val: metrics.total, color: 'text-indigo-400', path: 'M0,18 Q15,8 30,14 T60,5' }
              ].map((card, i) => (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.03 }}
                  className="relative overflow-hidden bg-zinc-900 border border-zinc-800/80 rounded-2xl p-3 flex flex-col justify-between h-20 shadow-inner group"
                >
                  {/* Shimmer Effect */}
                  <div className="absolute inset-0 w-[200%] bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none" />

                  <span className="text-[9px] font-bold text-zinc-500">{card.label}</span>
                  <div className="flex items-end justify-between mt-1">
                    <span className={`text-xl font-black ${card.color}`}>{card.val}</span>
                    <svg className="w-12 h-6 opacity-40 shrink-0" viewBox="0 0 60 20">
                      <path d={card.path} fill="none" stroke="currentColor" strokeWidth="2" className={card.color} />
                    </svg>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Segmented Control */}
            <div className="bg-zinc-900/60 border border-zinc-800 p-1 rounded-xl flex gap-1 select-none">
              {(['pending', 'lock', 'history'] as const).map((tabId) => (
                <button
                  key={tabId}
                  onClick={() => setSubTab(tabId)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                    subTab === tabId
                      ? 'bg-zinc-800 text-white border border-zinc-800/50 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tabId === 'pending' && '待審核'}
                  {tabId === 'lock' && '門鎖金鑰'}
                  {tabId === 'history' && '歷史紀錄'}
                </button>
              ))}
            </div>
          </div>

          {/* 搜尋與篩選列 */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
              <input
                type="text"
                placeholder="搜尋姓名、場地、用途..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border border-zinc-800 rounded-xl bg-zinc-950 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-zinc-200 shadow-inner transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="清除搜尋內容"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-[9px] rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button
              onClick={openFilterDrawer}
              className={`p-2 rounded-xl border flex items-center justify-center transition-all bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-zinc-300 shadow-sm ${
                selectedRoom !== 'all' || timeSortOrder !== 'newest' || filterConflictsOnly
                  ? 'border-indigo-500 ring-2 ring-indigo-500/10'
                  : 'border-zinc-800'
              }`}
              data-testid="filter-button"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* 篩選標籤摘要 */}
          {(selectedRoom !== 'all' || timeSortOrder !== 'newest' || filterConflictsOnly) && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold mr-1">篩選條件:</span>
              {selectedRoom !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-zinc-900 border border-zinc-800 text-zinc-300 text-[9px] px-2 py-0.5 rounded-md">
                  {selectedRoom}
                  <button
                    type="button"
                    onClick={() => setSelectedRoom('all')}
                    aria-label="清除場地篩選"
                    className="p-[7px] -m-[7px] rounded-full text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
              {timeSortOrder !== 'newest' && (
                <span className="inline-flex items-center gap-1 bg-zinc-900 border border-zinc-800 text-zinc-300 text-[9px] px-2 py-0.5 rounded-md">
                  時間：舊到新
                  <button
                    type="button"
                    onClick={() => setTimeSortOrder('newest')}
                    aria-label="清除時間排序篩選"
                    className="p-[7px] -m-[7px] rounded-full text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
              {filterConflictsOnly && (
                <span className="inline-flex items-center gap-1 bg-zinc-900 border border-zinc-800 text-zinc-300 text-[9px] px-2 py-0.5 rounded-md">
                  衝突時段
                  <button
                    type="button"
                    onClick={() => setFilterConflictsOnly(false)}
                    aria-label="清除衝突時段篩選"
                    className="p-[7px] -m-[7px] rounded-full text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setSelectedRoom('all');
                  setTimeSortOrder('newest');
                  setFilterConflictsOnly(false);
                }}
                className="text-[9px] text-indigo-400 hover:text-indigo-300 underline font-bold pl-1"
              >
                清除全部
              </button>
            </div>
          )}

          {/* 預約列表卡片佈局 */}
          <div className="space-y-3">
            {filteredBookings.length > 0 ? (
              filteredBookings.map((booking) => (
                <motion.div
                  key={booking.id}
                  whileHover={{ scale: 1.01 }}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-md relative overflow-hidden"
                >
                  {/* Left Status Bar */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 ${
                      booking.status === 'pending'
                        ? 'bg-amber-500'
                        : booking.status === 'approved'
                        ? 'bg-emerald-500'
                        : 'bg-rose-500'
                    }`}
                  />

                  <div className="space-y-3 pl-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-extrabold text-sm text-zinc-100">{booking.full_name}</h3>
                        <span className="inline-block bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] font-bold px-1.5 py-0.5 rounded mt-1">
                          {booking.pastoral_zone}
                        </span>
                      </div>

                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${
                          booking.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : booking.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {booking.status === 'pending' && '待審核'}
                        {booking.status === 'approved' && '已同意'}
                        {booking.status === 'rejected' && '已拒絕'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs text-zinc-400 border-t border-b border-zinc-800 py-3 my-1">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="font-bold text-zinc-200">{booking.room_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{booking.attendance_count} 人</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{booking.booking_date}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{booking.start_time} - {booking.end_time}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-1.5 text-xs text-zinc-400 leading-relaxed bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800">
                      <FileText className="w-3.5 h-3.5 text-zinc-600 shrink-0 mt-0.5" />
                      <p className="line-clamp-2">{booking.purpose}</p>
                    </div>

                    {/* Animated Access Code View */}
                    {subTab === 'lock' && booking.status === 'approved' && booking.access_code && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="flex items-center justify-between bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl text-xs font-mono select-all"
                      >
                        <div className="flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5 text-zinc-500" />
                          <span className="text-zinc-400">門鎖密碼</span>
                        </div>
                        <span className="font-extrabold tracking-widest text-indigo-400 text-sm">{booking.access_code}</span>
                      </motion.div>
                    )}

                    {booking.status === 'pending' && (
                      <div className="flex gap-2 pt-1 select-none">
                        <button
                          onClick={() => setRejectingBookingId(booking.id)}
                          className="flex-1 py-2 rounded-xl border border-zinc-800 hover:bg-zinc-800 text-xs font-bold text-zinc-300 focus:outline-none"
                        >
                          拒絕
                        </button>
                        <button
                          onClick={() => setAssigningBookingId(booking.id)}
                          className="flex-1 py-2 rounded-xl border border-zinc-800 hover:bg-zinc-800 text-xs font-bold text-zinc-300 focus:outline-none"
                        >
                          更換場地
                        </button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleApproveAction(booking.id)}
                          className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-600 text-white text-xs font-extrabold flex items-center justify-center gap-1 shadow-sm focus:outline-none"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>同意核可</span>
                        </motion.button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="py-12 border border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center p-6 bg-zinc-900/20">
                <AlertCircle className="w-8 h-8 text-zinc-700 mb-2" />
                <p className="text-xs text-zinc-500 font-bold">尚無符合搜尋條件的預約明細</p>
              </div>
            )}
          </div>
        </main>
      ) : (
        /* 當前非預約審核時，渲染外部帶入的子分頁 (IssuesTab, TuyaTab, ViolationsTab 等) */
        <main className="flex-1 p-4 overflow-y-auto">
          {children ? (
            <div className="bg-zinc-950 rounded-2xl min-h-[500px]">
              {children}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-zinc-500">
              功能分頁加載中...
            </div>
          )}
        </main>
      )}

      {/* 底部固定導覽列 */}
      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-950/90 backdrop-blur-md border-t border-zinc-900 px-4 py-2 flex justify-around items-center z-40 select-none">
        <button
          onClick={() => handleTabSelect('bookings')}
          className={`flex flex-col items-center py-1 gap-1 text-[9px] font-bold transition-all ${
            activeTab === 'bookings' ? 'text-indigo-400' : 'text-zinc-500'
          }`}
        >
          <div className="relative">
            {getBottomNavIcon('bookings', activeTab === 'bookings')}
            {pendingCount && pendingCount > 0 ? (
              <span className="absolute -top-1 -right-2 bg-indigo-600 text-white text-[8px] font-black px-1 rounded-full border border-zinc-950">
                {pendingCount}
              </span>
            ) : (
              bookings.filter((b) => b.status === 'pending').length > 0 && activeTab !== 'bookings' && (
                <span className="absolute -top-1 -right-2 bg-indigo-600 text-white text-[8px] font-black px-1 rounded-full border border-zinc-950">
                  {bookings.filter((b) => b.status === 'pending').length}
                </span>
              )
            )}
          </div>
          <span>預約審核</span>
        </button>

        <button
          onClick={() => handleTabSelect('issues')}
          className={`flex flex-col items-center py-1 gap-1 text-[9px] font-bold transition-all ${
            activeTab === 'issues' ? 'text-indigo-400' : 'text-zinc-500'
          }`}
        >
          {getBottomNavIcon('issues', activeTab === 'issues')}
          <span>異常回報</span>
        </button>

        <button
          onClick={() => handleTabSelect('map')}
          className={`flex flex-col items-center py-1 gap-1 text-[9px] font-bold transition-all ${
            activeTab === 'map' ? 'text-indigo-400' : 'text-zinc-500'
          }`}
        >
          {getBottomNavIcon('map', activeTab === 'map')}
          <span>即時地圖</span>
        </button>

        <button
          onClick={() => setIsMoreDrawerOpen(true)}
          className={`flex flex-col items-center py-1 gap-1 text-[9px] font-bold transition-all ${
            isMoreDrawerOpen ? 'text-indigo-400' : 'text-zinc-500'
          }`}
        >
          {getBottomNavIcon('more', isMoreDrawerOpen)}
          <span>更多選單</span>
        </button>
      </footer>

      {/* ── 底部抽屜 1: Google 試算表排程匯入 ── */}
      <AnimatePresence>
        {isImportDrawerOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end justify-center z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
              onClick={() => !isImporting && setIsImportDrawerOpen(false)}
            />
            
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              role="dialog"
              aria-modal="true"
              aria-label="Google 試算表排程匯入"
              className="relative bg-zinc-900 border-t border-zinc-800 rounded-t-3xl shadow-2xl w-full max-w-md p-6 pb-8 z-50 flex flex-col gap-4"
            >
              <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto" />
              
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                    <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                    <span>Google 試算表排程匯入</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
                    輸入已共用為「知道連結的人均可檢視」的 Google 試算表連結。系統將自動解析格線並覆蓋此據點的預約排程。
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={() => setIsImportDrawerOpen(false)}
                  aria-label="關閉視窗"
                  className="p-2.5 -m-1.5 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleImportSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">試算表共用連結</label>
                  <input
                    type="text"
                    disabled={isImporting || importSuccess}
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                    className={`w-full p-3 border border-zinc-800 rounded-xl text-xs bg-zinc-950 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 shadow-inner font-mono ${
                      importError ? 'border-rose-500 focus:ring-rose-500/20' : ''
                    }`}
                  />
                  
                  {importError && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium pt-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{importError}</span>
                    </div>
                  )}

                  {importSuccess && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium pt-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>排程資料成功解析並已匯入！</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 select-none">
                  <button
                    type="button"
                    disabled={isImporting || importSuccess}
                    onClick={() => setIsImportDrawerOpen(false)}
                    className="flex-1 py-3 rounded-xl border border-zinc-800 hover:bg-zinc-800 text-xs font-bold text-zinc-400 focus:outline-none"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isImporting || importSuccess}
                    className={`flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-2 focus:outline-none ${
                      isImporting || importSuccess ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>解析中...</span>
                      </>
                    ) : (
                      <span>啟動排程匯入</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 底部抽屜 2: 更多分頁選單 (Drawer) ── */}
      <AnimatePresence>
        {isMoreDrawerOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end justify-center z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
              onClick={() => setIsMoreDrawerOpen(false)}
            />
            
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              role="dialog"
              aria-modal="true"
              aria-label="更多管理功能分頁"
              className="relative bg-zinc-900 border-t border-zinc-800 rounded-t-3xl shadow-2xl w-full max-w-md p-5 pb-8 z-50 flex flex-col gap-4 max-h-[80vh] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto" />
              
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <h3 className="text-sm font-extrabold text-white">⚙️ 更多管理功能分頁</h3>
                <button
                  type="button"
                  onClick={() => setIsMoreDrawerOpen(false)}
                  aria-label="關閉視窗"
                  className="p-2.5 -m-1.5 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1 select-none">
                {allowedTabs
                  .filter(tab => !['bookings', 'issues', 'map'].includes(tab.id))
                  .map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <motion.button
                        key={tab.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          handleTabSelect(tab.id);
                          setIsMoreDrawerOpen(false);
                        }}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs text-left font-bold transition-all focus:outline-none ${
                          active
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg shrink-0 ${active ? 'bg-indigo-700' : 'bg-zinc-900 border border-zinc-800'}`}>
                          {getMoreMenuIcon(tab.id)}
                        </div>
                        <span className="truncate">{tab.label}</span>
                      </motion.button>
                    );
                  })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal 3: 指派場地 ── */}
      {assigningBookingId !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            role="dialog"
            aria-modal="true"
            aria-label="調整/指派場地空間"
            className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl w-full max-w-sm flex flex-col gap-4 text-left shadow-2xl"
          >
            <div>
              <h4 className="text-sm font-extrabold text-white">⚙️ 調整/指派場地空間</h4>
              <p className="text-[11px] text-zinc-400 mt-1">請為張家豪的待審預約指派或更動活動空間：</p>
            </div>
            
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {roomsList.map((roomName) => (
                <button
                  key={roomName}
                  onClick={() => handleAssignAction(assigningBookingId, roomName)}
                  className="w-full text-left p-3 rounded-xl border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-xs font-bold text-zinc-300 transition-all focus:outline-none"
                >
                  🏫 {roomName}
                </button>
              ))}
            </div>

            <button
              onClick={() => setAssigningBookingId(null)}
              className="py-2.5 rounded-xl border border-zinc-800 hover:bg-zinc-800 text-xs font-bold text-zinc-400 focus:outline-none"
            >
              取消關閉
            </button>
          </motion.div>
        </div>
      )}

      {/* ── Modal 4: 拒絕預約原因填寫 ── */}
      {rejectingBookingId !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            role="dialog"
            aria-modal="true"
            aria-label="拒絕此項空間預約"
            className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl w-full max-w-sm flex flex-col gap-4 text-left shadow-2xl"
          >
            <div>
              <h4 className="text-sm font-extrabold text-white">❌ 拒絕此項空間預約</h4>
              <p className="text-[11px] text-zinc-400 mt-1">請簡短填寫退回原因，以利預約人收到通知：</p>
            </div>
            
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="例如：當天有大型裝修工程、人數未達該空間低消限制..."
              className="w-full p-3 border border-zinc-800 rounded-xl text-xs bg-zinc-950 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 resize-none"
            />

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setRejectingBookingId(null);
                  setRejectionReason('');
                }}
                className="flex-1 py-2.5 rounded-xl border border-zinc-800 hover:bg-zinc-800 text-xs font-bold text-zinc-400 focus:outline-none"
              >
                取消
              </button>
              <button
                onClick={confirmRejectAction}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-600 text-white text-xs font-bold focus:outline-none"
              >
                確認退回
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* ── Modal 5: 篩選條件 ── */}
      {isFilterDrawerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            role="dialog"
            aria-modal="true"
            aria-label="篩選與排序預約"
            className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl w-full max-w-sm flex flex-col gap-4 text-left shadow-2xl"
          >
            <div>
              <h4 className="text-sm font-extrabold text-white">🔍 篩選與排序預約</h4>
              <p className="text-[11px] text-zinc-400 mt-1">設定您想要查看的欄位條件：</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">特定場地</label>
                <select
                  value={tempRoom}
                  onChange={(e) => setTempRoom(e.target.value)}
                  className="w-full p-2.5 border border-zinc-800 rounded-xl text-xs bg-zinc-950 text-zinc-300 focus:outline-none"
                >
                  <option value="all">所有場地空間</option>
                  {roomsList.map((room) => (
                    <option key={room} value={room}>{room}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">時間排序</label>
                <select
                  value={tempSortOrder}
                  onChange={(e) => setTempSortOrder(e.target.value as 'newest' | 'oldest')}
                  className="w-full p-2.5 border border-zinc-800 rounded-xl text-xs bg-zinc-950 text-zinc-300 focus:outline-none"
                >
                  <option value="newest">時間由新到舊 (預設)</option>
                  <option value="oldest">時間由舊到新</option>
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1.5">
                <input
                  type="checkbox"
                  checked={tempConflicts}
                  onChange={(e) => setTempConflicts(e.target.checked)}
                  className="rounded border-zinc-800 bg-zinc-950 text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-xs text-zinc-300">僅顯示衝突場地 (大禮堂、第一教室)</span>
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  resetFilters();
                  setIsFilterDrawerOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl border border-zinc-800 hover:bg-zinc-800 text-xs font-bold text-zinc-500 focus:outline-none"
              >
                重設
              </button>
              <button
                onClick={applyFilters}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-600 text-white text-xs font-bold focus:outline-none"
              >
                套用篩選
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
