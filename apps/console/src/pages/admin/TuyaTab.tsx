import { useCallback, useState, useEffect } from 'react';
import { apiTestTuyaConnection, apiFetchTuyaDevicesStatus, apiControlTuyaDevice, apiUpdateRoom, apiUpdatePublicSpace } from '@church/shared/api';
import type { PublicSpace, Room, TuyaCommandValue, TuyaDeviceState, TuyaTestResult } from '@church/shared/types';
import { ShieldAlert, RefreshCw, Key, Lightbulb, Snowflake, Power, Plus, Minus, Unlock, Loader2, Settings, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface TuyaTabProps {
  data: Room[]; // Room list from parent
  currentBranch: string;
  getToken: () => string;
  onRefresh?: () => void;
}

// Helper to determine floor group based on space name
const getFloor = (name: string): string => {
  if (name.startsWith('B1-') || name.startsWith('B1')) return 'B1';
  if (name.startsWith('B2-') || name.startsWith('B2')) return 'B2';
  if (name.startsWith('一樓') || name.startsWith('1F') || name.startsWith('1F-')) return '1F';
  if (name.startsWith('二樓') || name.startsWith('2F') || name.startsWith('2F-')) return '2F';
  return '其他';
};

interface LightControlSectionProps {
  lightId: string;
  index: number;
  totalLights: number;
  devices: Record<string, TuyaDeviceState>;
  pendingCommands: Record<string, boolean>;
  onControl: (deviceId: string, code: string | Array<{ code: string; value: TuyaCommandValue }>, value?: TuyaCommandValue) => Promise<void>;
}

function LightControlSection({
  lightId,
  index,
  totalLights,
  devices,
  pendingCommands,
  onControl
}: LightControlSectionProps) {
  const light = devices[lightId] || { online: false, status: {} };
  const isUpdating = !!light.status?.updating;

  const switchKeys = light.status 
    ? Object.keys(light.status)
        .filter(key => key === 'switch' || /^switch_\d+$/.test(key))
        .sort((a, b) => {
          if (a === 'switch') return -1;
          if (b === 'switch') return 1;
          return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        })
    : [];

  const activeSwitchKeys = switchKeys.length > 0 ? switchKeys : ['switch'];
  const deviceDisplayName = totalLights > 1
    ? `空間照明開關 #${index + 1} (${lightId.slice(-4)})`
    : '空間照明開關';

  const anyOn = activeSwitchKeys.some(k => light.status ? !!light.status[k] : false);
  const isDisabled = pendingCommands[lightId] || isUpdating;

  return (
    <div className="p-3.5 bg-slate-50 border border-slate-200/50 rounded-2xl space-y-3">
      <div className="flex flex-col xs:flex-row xs:items-center justify-between pb-2.5 border-b border-slate-200/40 gap-2">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl shrink-0 transition-all duration-300 ${
            light.online ? 'bg-amber-50 text-amber-500' : 'bg-slate-100 text-slate-400'
          }`}>
            <Lightbulb size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-slate-800 truncate">{deviceDisplayName}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${light.online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span className="text-[10px] font-bold text-slate-400">
                {isUpdating ? '同步中...' : light.online ? '在線' : '未連線'}
              </span>
            </div>
          </div>
        </div>
        {activeSwitchKeys.length >= 1 && (
          <button
            disabled={isDisabled}
            onClick={() => onControl(lightId, activeSwitchKeys.map(k => ({ code: k, value: !anyOn })))}
            className={`w-full xs:w-auto px-2.5 py-1.5 border rounded-xl text-[10px] font-black transition-all active:scale-95 flex items-center justify-center gap-1 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
              anyOn 
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200' 
                : 'bg-amber-50 hover:bg-amber-100 text-amber-600 border-amber-200'
            }`}
          >
            {pendingCommands[lightId] ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <Power size={10} />
            )}
            {isUpdating ? '更新中' : anyOn ? '一鍵全關' : '一鍵全開'}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {activeSwitchKeys.map(switchKey => {
          const isLightOn = light.status ? !!light.status[switchKey] : false;
          let switchLabel = '主開關';
          if (switchKey.startsWith('switch_')) {
            const num = switchKey.replace('switch_', '');
            switchLabel = `按鍵 ${num}`;
          } else if (switchKey === 'switch_led') {
            switchLabel = 'LED指示燈';
          }

          return (
            <div key={switchKey} className="flex items-center justify-between bg-white/60 border border-slate-100 p-2.5 rounded-xl shadow-sm gap-2">
              <span className="text-xs font-bold text-slate-700">{switchLabel}</span>
              <button
                disabled={isDisabled}
                onClick={() => onControl(lightId, switchKey, !isLightOn)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shadow-sm border shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isLightOn
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {pendingCommands[lightId] && (
                  <Loader2 size={11} className="animate-spin" />
                )}
                <Power size={11} />
                {isUpdating ? '同步中' : isLightOn ? '已開啟' : '已關閉'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TuyaTab({ data: initialRooms, currentBranch, getToken, onRefresh }: TuyaTabProps) {
  const [tuyaTesting, setTuyaTesting] = useState(false);
  const [tuyaTestResult, setTuyaTestResult] = useState<TuyaTestResult | null>(null);
  
  // Real-time statuses loaded from backend
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [publicSpaces, setPublicSpaces] = useState<PublicSpace[]>([]);
  const [devices, setDevices] = useState<Record<string, TuyaDeviceState>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ID Editing states
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [editingPublicSpaceId, setEditingPublicSpaceId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ tuya_device_id: '', tuya_light_id: '', tuya_ac_id: '' });
  const [savingId, setSavingId] = useState<number | null>(null);

  // Floor Tabs State
  const [activeFloorTab, setActiveFloorTab] = useState<string>('');

  // Collapsible cards state: itemKey (e.g. 'room_8', 'space_12') -> boolean (false if expanded)
  // By default, since key is not in map, it defaults to collapsed (true)
  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>({});

  // Tracks loading states for individual device commands: deviceId -> true/false
  const [pendingCommands, setPendingCommands] = useState<Record<string, boolean>>({});

  // Quota Error Diagnosis Modal States
  const [quotaErrorModalOpen, setQuotaErrorModalOpen] = useState(false);
  const [quotaErrorMsg, setQuotaErrorMsg] = useState('');

  useEscapeKey(() => setQuotaErrorModalOpen(false), quotaErrorModalOpen);

  const fetchStatus = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    
    try {
      const branch = currentBranch;
      const res = await apiFetchTuyaDevicesStatus(getToken(), branch);
      if (res.success) {
        setRooms(res.rooms || []);
        setPublicSpaces(res.publicSpaces || []);
        setDevices(res.devices || {});
      } else {
        console.error('Fetch devices status failed:', res.error);
      }
    } catch (err) {
      console.error('Fetch devices status network error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentBranch, getToken]);

  useEffect(() => {
    fetchStatus();
    
    // Background polling fallback (run every 60 seconds to check online/offline and sync state)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchStatus(true);
      }
    }, 60000);

    // Visibility change listener: when coming back to the tab, sync once immediately
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchStatus(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Setup Server-Sent Events (SSE) listener for instant real-time updates
    const eventSource = new EventSource('/api/tuya/events');
    
    eventSource.onmessage = (event) => {
      try {
        const { deviceId, status } = JSON.parse(event.data);
        console.log(`[SSE] Device state change received for ${deviceId}:`, status);
        setDevices(prev => {
          const dev = prev[deviceId];
          if (!dev) return prev;
          return {
            ...prev,
            [deviceId]: {
              ...dev,
              status: {
                ...dev.status,
                ...status
              }
            }
          };
        });
      } catch (err) {
        console.error('[SSE] Failed to parse message data:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn('[SSE] EventSource encountered error, closing stream:', err);
      eventSource.close();
    };

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      eventSource.close();
    };
  }, [initialRooms, currentBranch, fetchStatus]);

  // Compute available floors
  const floorsSet = new Set<string>();
  rooms.forEach(r => floorsSet.add(getFloor(r.name)));
  publicSpaces.forEach(ps => floorsSet.add(getFloor(ps.name)));
  
  const availableFloors = Array.from(floorsSet).sort((a, b) => {
    const order = ['B1', 'B2', '1F', '2F', '其他'];
    const idxA = order.indexOf(a);
    const idxB = order.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  // Set default active tab
  useEffect(() => {
    if (availableFloors.length > 0 && !activeFloorTab) {
      if (availableFloors.includes('B1')) {
        setActiveFloorTab('B1');
      } else {
        setActiveFloorTab(availableFloors[0]);
      }
    }
  }, [rooms, publicSpaces, availableFloors, activeFloorTab]);

  const handleTestConnection = async () => {
    setTuyaTesting(true);
    setTuyaTestResult(null);
    try {
      const res = await apiTestTuyaConnection(getToken());
      setTuyaTestResult(res);
    } catch {
      setTuyaTestResult({ success: false, error: '網路連線異常，無法與後端伺服器通訊。' });
    } finally {
      setTuyaTesting(false);
    }
  };

  const handleControl = async (deviceId: string, code: string | Array<{ code: string; value: TuyaCommandValue }>, value?: TuyaCommandValue) => {
    setPendingCommands(prev => ({ ...prev, [deviceId]: true }));
    try {
      const commands = Array.isArray(code) ? code : [{ code, value: value ?? false }];
      const res = await apiControlTuyaDevice(getToken(), deviceId, commands);
      if (res.success) {
        setDevices(prev => {
          const dev = prev[deviceId] || { online: true, name: '智慧設備', status: {} };
          const updatedStatus = { ...dev.status };
          commands.forEach(cmd => {
            updatedStatus[cmd.code] = cmd.value;
          });
          return {
            ...prev,
            [deviceId]: {
              ...dev,
              status: updatedStatus
            }
          };
        });
      } else {
        if (res.error && (res.error.includes('60001001') || res.error.toLowerCase().includes('quota is insufficient'))) {
          setQuotaErrorMsg(res.error);
          setQuotaErrorModalOpen(true);
        } else {
          alert(`指令發送失敗: ${res.error || '未知錯誤'}`);
        }
      }
    } catch {
      alert('發送控制指令時發生網路異常');
    } finally {
      setPendingCommands(prev => ({ ...prev, [deviceId]: false }));
    }
  };

  const handleStartEdit = (room: Room) => {
    setEditingRoomId(room.id);
    setEditForm({
      tuya_device_id: room.tuya_device_id || '',
      tuya_light_id: room.tuya_light_id || '',
      tuya_ac_id: room.tuya_ac_id || ''
    });
  };

  const handleStartEditPublicSpace = (space: PublicSpace) => {
    setEditingPublicSpaceId(space.id);
    setEditForm({
      tuya_device_id: '',
      tuya_light_id: space.tuya_light_id || '',
      tuya_ac_id: ''
    });
  };

  const handleSaveIds = async (room: Room) => {
    setSavingId(room.id);
    try {
      const cleanInput = (val: string) => {
        return val
          .split(',')
          .map(id => id.trim())
          .filter(Boolean)
          .join(',');
      };

      const updatedData = {
        name: room.name,
        capacity: room.capacity,
        description: room.description,
        image_url: room.image_url,
        branch: room.branch,
        tuya_device_id: cleanInput(editForm.tuya_device_id) || null,
        tuya_light_id: cleanInput(editForm.tuya_light_id) || null,
        tuya_ac_id: cleanInput(editForm.tuya_ac_id) || null
      };

      const res = await apiUpdateRoom(getToken(), room.id, updatedData);
      if (res.ok) {
        setEditingRoomId(null);
        if (onRefresh) onRefresh();
        else fetchStatus(true);
      } else {
        alert('設定儲存失敗，請檢查資料格式或權限。');
      }
    } catch {
      alert('更新設備設定時發生網路異常。');
    } finally {
      setSavingId(null);
    }
  };

  const handleSavePublicSpaceIds = async (space: PublicSpace) => {
    setSavingId(space.id);
    try {
      const cleanInput = (val: string) => {
        return val
          .split(',')
          .map(id => id.trim())
          .filter(Boolean)
          .join(',');
      };

      const updatedData = {
        name: space.name,
        category: space.category || '空間',
        sort_order: space.sort_order || 0,
        branch: space.branch,
        tuya_light_id: cleanInput(editForm.tuya_light_id) || null
      };

      const res = await apiUpdatePublicSpace(getToken(), space.id, updatedData);
      if (res.ok) {
        setEditingPublicSpaceId(null);
        fetchStatus(true);
      } else {
        alert('設定儲存失敗，請檢查資料格式或權限。');
      }
    } catch {
      alert('更新設備設定時發生網路異常。');
    } finally {
      setSavingId(null);
    }
  };

  const toggleCollapse = (itemKey: string) => {
    setCollapsedItems(prev => ({
      ...prev,
      [itemKey]: prev[itemKey] === false ? true : false
    }));
  };

  const getDevice = (deviceId?: string | null) => {
    if (!deviceId) return null;
    return devices[deviceId] || { online: false, status: {} };
  };

  // Filter items based on active floor tab
  const filteredRooms = rooms.filter(r => getFloor(r.name) === activeFloorTab);
  const filteredPublicSpaces = publicSpaces.filter(ps => getFloor(ps.name) === activeFloorTab);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── 標題與頂部操作區 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 select-none">
        <div>
          <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
            🔌 Tuya 智慧裝置與電器控制主控台
          </h3>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            即時監控並控制各個樓層場地及公共空間的智慧門鎖、照明及冷氣空調運作狀況，並可設定綁定裝置 ID
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchStatus(true)}
            disabled={loading || refreshing}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all active:scale-95 disabled:opacity-50"
            title="重新整理狀態"
          >
            <RefreshCw size={15} className={`transition-all ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            disabled={tuyaTesting}
            onClick={handleTestConnection}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md active:scale-95 flex items-center gap-1.5 shrink-0 ${
              tuyaTesting ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {tuyaTesting ? '連線測試中...' : '🔌 測試 Tuya 雲端連線'}
          </button>
        </div>
      </div>

      {/* ── 雲端連線測試結果 ── */}
      {tuyaTestResult && (
        <div className={`p-5 rounded-2xl border font-semibold shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
          tuyaTestResult.success 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {tuyaTestResult.success ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold">
                <span>✅</span> {tuyaTestResult.message}
              </div>
              <div className="text-xs font-mono font-normal opacity-75 bg-emerald-100/50 p-2.5 rounded-xl border border-emerald-200/40 truncate">
                Token 預覽: {tuyaTestResult.tokenPreview}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold">
                <ShieldAlert size={16} className="text-rose-500" />
                <span>連線失敗</span>
              </div>
              <div className="text-xs font-mono font-normal opacity-75 bg-rose-100/50 p-2.5 rounded-xl border border-rose-200/40 whitespace-pre-wrap break-all">
                錯誤訊息: {tuyaTestResult.error}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 樓層切換分頁 ── */}
      {availableFloors.length > 1 && (
        <div className="flex gap-2 border-b border-slate-100 pb-3 overflow-x-auto scrollbar-hide">
          {availableFloors.map(floor => (
            <button
              key={floor}
              onClick={() => setActiveFloorTab(floor)}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 whitespace-nowrap flex items-center gap-1.5 ${
                activeFloorTab === floor
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-150'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🏢 {floor} 樓層
            </button>
          ))}
        </div>
      )}

      {/* ── 載入中骨架屏 ── */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="border border-slate-200 rounded-3xl p-6 bg-white space-y-4 animate-pulse">
              <div className="h-6 w-32 bg-slate-200 rounded-lg" />
              <div className="space-y-3">
                <div className="h-14 bg-slate-100 rounded-2xl" />
                <div className="h-14 bg-slate-100 rounded-2xl" />
                <div className="h-14 bg-slate-100 rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8 sm:space-y-10 animate-in fade-in duration-300">
          
          {/* 🏫 聚會與活動場地 Section */}
          <div className="space-y-4">
            <h4 className="font-extrabold text-slate-700 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2 select-none">
              🏫 聚會與活動場地 ({filteredRooms.length})
            </h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
              {filteredRooms.length === 0 ? (
                <div className="col-span-full border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-400 italic bg-white select-none">
                  此樓層目前無設定任何活動場地。
                </div>
              ) : (
                filteredRooms.map((room) => {
                  const isEditing = editingRoomId === room.id;
                  const itemKey = `room_${room.id}`;
                  const isCollapsed = collapsedItems[itemKey] !== false;
                  
                  const lockIds = room.tuya_device_id ? room.tuya_device_id.split(',').map((id: string) => id.trim()).filter(Boolean) : [];
                  const lightIds = room.tuya_light_id ? room.tuya_light_id.split(',').map((id: string) => id.trim()).filter(Boolean) : [];
                  const acIds = room.tuya_ac_id ? room.tuya_ac_id.split(',').map((id: string) => id.trim()).filter(Boolean) : [];
                  const hasDevices = lockIds.length > 0 || lightIds.length > 0 || acIds.length > 0;

                  // Check if this room shares its name with any public space (hybrid space)
                  const isHybrid = publicSpaces.some((ps) => ps.name === room.name && ps.branch === room.branch);

                  return (
                    <div key={room.id} className={`border rounded-3xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between ${isEditing ? 'border-indigo-400 bg-white ring-2 ring-indigo-500/10' : 'border-slate-200 bg-white'}`}>
                      <div>
                        {/* Room title & Settings/Collapse trigger buttons */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-slate-100 pb-3 select-none">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <h4 
                              className="font-extrabold text-slate-800 text-base flex items-center gap-1.5 cursor-pointer hover:text-indigo-600 transition-colors truncate"
                              onClick={() => toggleCollapse(itemKey)}
                            >
                              🏫 {room.name}
                            </h4>
                            {isHybrid && (
                              <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0" title="此場地亦為公共空間">
                                🔄 共享場地
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                            <span className="bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[9px] font-bold">
                              {room.branch}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {!isEditing && (
                                <button
                                  onClick={() => handleStartEdit(room)}
                                  className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                                  title="設定設備 ID"
                                >
                                  <Settings size={15} />
                                </button>
                              )}
                              <button
                                onClick={() => toggleCollapse(itemKey)}
                                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-all"
                                title={isCollapsed ? '展開控制台' : '收合控制台'}
                              >
                                {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Collapsible Panel Content */}
                        {!isCollapsed && (
                          <div className="animate-in slide-in-from-top-1 duration-150 space-y-4">
                            {/* Conditional: Edit ID inputs or Status Monitoring dashboard */}
                            {isEditing ? (
                              <div className="space-y-4 animate-in fade-in duration-200">
                                <h5 className="text-xs font-black text-indigo-600 mb-2">⚙️ 設定智慧裝置 ID</h5>
                                
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1">智慧門鎖 ID (Lock Device ID)</label>
                                  <input 
                                    type="text" 
                                    className="border border-slate-200 p-2.5 text-xs font-mono w-full rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none text-slate-800" 
                                    placeholder="請輸入門鎖設備 ID，若無則留空" 
                                    value={editForm.tuya_device_id} 
                                    onChange={e => setEditForm({ ...editForm, tuya_device_id: e.target.value })} 
                                  />
                                  <p className="text-[9px] text-slate-400 mt-1 font-semibold">* 支援綁定多個，請用半形逗號 `,` 分隔（例如：ID1,ID2）</p>
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1">智慧電燈開關 ID (Light Device ID)</label>
                                  <input 
                                    type="text" 
                                    className="border border-slate-200 p-2.5 text-xs font-mono w-full rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none text-slate-800" 
                                    placeholder="請輸入電燈開關設備 ID，若無則留空" 
                                    value={editForm.tuya_light_id} 
                                    onChange={e => setEditForm({ ...editForm, tuya_light_id: e.target.value })} 
                                  />
                                  <p className="text-[9px] text-slate-400 mt-1 font-semibold">* 支援綁定多個，請用半形逗號 `,` 分隔（例如：ID1,ID2）</p>
                                  {isHybrid && (
                                    <p className="text-[9px] text-amber-600 mt-1 font-bold">ℹ️ 提醒：此為共享場地，儲存後會同步更新至對應公共空間的電燈開關 ID。</p>
                                  )}
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1">智慧空調冷氣 ID (AC Device ID)</label>
                                  <input 
                                    type="text" 
                                    className="border border-slate-200 p-2.5 text-xs font-mono w-full rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none text-slate-800" 
                                    placeholder="請輸入冷氣空調設備 ID，若無則留空" 
                                    value={editForm.tuya_ac_id} 
                                    onChange={e => setEditForm({ ...editForm, tuya_ac_id: e.target.value })} 
                                  />
                                  <p className="text-[9px] text-slate-400 mt-1 font-semibold">* 支援綁定多個，請用半形逗號 `,` 分隔（例如：ID1,ID2）</p>
                                </div>

                                <div className="flex gap-2 pt-3 border-t border-slate-100 justify-end">
                                  <button 
                                    disabled={savingId === room.id}
                                    onClick={() => handleSaveIds(room)} 
                                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-all flex items-center gap-1 active:scale-95 shadow-sm"
                                  >
                                    {savingId === room.id ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <Save size={13} />
                                    )}
                                    儲存
                                  </button>
                                  <button 
                                    disabled={savingId === room.id}
                                    onClick={() => setEditingRoomId(null)} 
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3.5 py-2 rounded-xl text-xs transition-all active:scale-95"
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                {!hasDevices ? (
                                  <div className="py-8 text-center border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 text-xs select-none">
                                    ⚠️ 尚未綁定任何智慧裝置<br />
                                    <button
                                      onClick={() => handleStartEdit(room)}
                                      className="text-indigo-600 hover:text-indigo-800 font-bold mt-2 inline-block hover:underline"
                                    >
                                      ⚙️ 立即前往綁定裝置 ID
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-3.5">
                                    
                                    {/* 1. 智慧鎖 Lock Component */}
                                    {lockIds.map((lockId: string, index: number) => {
                                      const lock = getDevice(lockId);
                                      if (!lock) return null;
                                      
                                      const isUpdating = !!lock.status?.updating;
                                      const displayName = lockIds.length > 1
                                        ? `智慧密碼門鎖 #${index + 1} (${lockId.slice(-4)})`
                                        : '智慧密碼門鎖';

                                      return (
                                        <div key={lockId} className="flex flex-col xs:flex-row xs:items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl gap-2 transition-colors">
                                          <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-xl shrink-0 ${lock.online ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-slate-100 text-slate-500'}`}>
                                              <Key size={18} />
                                            </div>
                                            <div className="min-w-0">
                                              <div className="text-xs font-extrabold text-slate-800 truncate">{displayName}</div>
                                              <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                                  isUpdating 
                                                    ? 'bg-blue-500 animate-ping' 
                                                    : lock.online 
                                                    ? 'bg-emerald-500 animate-pulse' 
                                                    : 'bg-slate-400'
                                                }`} />
                                                <span className="text-[10px] font-bold text-slate-500">
                                                  {isUpdating ? '同步中...' : lock.online ? '在線' : '離線'}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="xs:text-right">
                                            <button
                                              disabled={pendingCommands[lockId] || isUpdating}
                                              onClick={() => handleControl(lockId, 'unlock', true)}
                                              className="w-full xs:w-auto px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 transition-all bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                              {pendingCommands[lockId] || isUpdating ? (
                                                <Loader2 size={13} className="animate-spin" />
                                              ) : (
                                                <Unlock size={13} />
                                              )}
                                              {isUpdating ? '同步中' : '遠端開鎖'}
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}

                                    {/* 2. 智慧開關 / 電燈 Light Component */}
                                    {lightIds.map((lightId: string, index: number) => (
                                      <LightControlSection
                                        key={lightId}
                                        lightId={lightId}
                                        index={index}
                                        totalLights={lightIds.length}
                                        devices={devices}
                                        pendingCommands={pendingCommands}
                                        onControl={handleControl}
                                      />
                                    ))}

                                    {/* 3. 智慧冷氣 / 空調 AC Component */}
                                    {acIds.map((acId: string, index: number) => {
                                      const ac = getDevice(acId);
                                      if (!ac) return null;

                                      const isUpdating = !!ac.status?.updating;
                                      const displayName = acIds.length > 1
                                        ? `恆溫冷氣空調 #${index + 1} (${acId.slice(-4)})`
                                        : '恆溫冷氣空調';

                                      return (
                                        <div key={acId} className="p-3.5 bg-slate-50 border border-slate-200/50 rounded-2xl space-y-3.5">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 min-w-0">
                                              <div className={`p-2.5 rounded-xl shrink-0 transition-all duration-300 ${
                                                ac.online && ac.status.switch 
                                                  ? 'bg-sky-50 text-sky-500 shadow-sm ring-4 ring-sky-100/50' 
                                                  : 'bg-slate-100 text-slate-400'
                                              }`}>
                                                <Snowflake size={18} />
                                              </div>
                                              <div className="min-w-0">
                                                <div className="text-xs font-extrabold text-slate-800 truncate">{displayName}</div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ac.online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                                  <span className="text-[10px] font-bold text-slate-400 truncate">
                                                    {isUpdating ? '同步中...' : ac.online 
                                                      ? (ac.status.switch 
                                                          ? `運作中 (${ac.status.mode === 'cool' ? '冷氣' : ac.status.mode === 'heat' ? '暖氣' : '送風'})` 
                                                          : '已關閉') 
                                                      : '未連線'}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                            
                                            <button
                                              disabled={pendingCommands[acId] || isUpdating}
                                              onClick={() => handleControl(acId, 'switch', !ac.status.switch)}
                                              className={`p-2 rounded-xl transition-all active:scale-95 border shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                                                ac.status.switch
                                                  ? 'bg-sky-500 hover:bg-sky-600 text-white border-sky-600'
                                                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                                              }`}
                                              title={ac.status.switch ? '關閉電源' : '開啟電源'}
                                            >
                                              {pendingCommands[acId] || isUpdating ? (
                                                <Loader2 size={13} className="animate-spin" />
                                              ) : (
                                                <Power size={13} />
                                              )}
                                            </button>
                                          </div>

                                          <div className={`flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-200/50 transition-opacity duration-300 ${ac.status.switch && !isUpdating ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                            <div className="bg-white border border-slate-100 p-2 rounded-xl flex items-center justify-between shadow-inner w-full sm:w-auto sm:flex-1">
                                              <button
                                                disabled={!ac.status.switch || pendingCommands[acId] || isUpdating}
                                                onClick={() => handleControl(acId, 'temp_set', (ac.status.temp_set || 26) - 1)}
                                                className="p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                              >
                                                <Minus size={13} />
                                              </button>
                                              <span className="text-sm font-extrabold text-slate-800 font-mono">
                                                {ac.status.temp_set || 26}°C
                                              </span>
                                              <button
                                                disabled={!ac.status.switch || pendingCommands[acId] || isUpdating}
                                                onClick={() => handleControl(acId, 'temp_set', (ac.status.temp_set || 26) + 1)}
                                                className="p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                              >
                                                <Plus size={13} />
                                              </button>
                                            </div>

                                            <div className="flex gap-1 w-full sm:w-auto sm:flex-1">
                                              <button
                                                disabled={!ac.status.switch || pendingCommands[acId] || isUpdating}
                                                onClick={() => handleControl(acId, 'mode', 'cool')}
                                                className={`flex-1 py-2 text-[10px] font-black rounded-xl border transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                                                  ac.status.mode === 'cool'
                                                    ? 'bg-sky-50 text-sky-600 border-sky-200 shadow-sm font-black'
                                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                                }`}
                                              >
                                                ❄️ 制冷
                                              </button>
                                              <button
                                                disabled={!ac.status.switch || pendingCommands[acId] || isUpdating}
                                                onClick={() => handleControl(acId, 'mode', 'fan')}
                                                className={`flex-1 py-2 text-[10px] font-black rounded-xl border transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                                                  ac.status.mode === 'fan'
                                                    ? 'bg-slate-100 text-slate-600 border-slate-300 shadow-sm font-black'
                                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                                }`}
                                              >
                                                🌀 送風
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 🧹 公共空間照明 Section */}
          <div className="space-y-4">
            <h4 className="font-extrabold text-slate-700 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2 select-none">
              🧹 公共空間照明 ({filteredPublicSpaces.length})
            </h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
              {filteredPublicSpaces.length === 0 ? (
                <div className="col-span-full border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-400 italic bg-white select-none">
                  此樓層目前無設定任何公共空間。
                </div>
              ) : (
                filteredPublicSpaces.map((space) => {
                  const isEditing = editingPublicSpaceId === space.id;
                  const itemKey = `space_${space.id}`;
                  const isCollapsed = collapsedItems[itemKey] !== false;
                  
                  const lightIds = space.tuya_light_id ? space.tuya_light_id.split(',').map((id: string) => id.trim()).filter(Boolean) : [];
                  const hasDevices = lightIds.length > 0;

                  // Check if this space is also registered as a rentable room (hybrid space)
                  const isHybrid = rooms.some((r) => r.name === space.name && r.branch === space.branch);

                  return (
                    <div key={space.id} className={`border rounded-3xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between ${isEditing ? 'border-indigo-400 bg-white ring-2 ring-indigo-500/10' : 'border-slate-200 bg-white'}`}>
                      <div>
                        {/* Space title & Settings/Collapse trigger buttons */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-slate-100 pb-3 select-none">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <h4 
                              className="font-extrabold text-slate-800 text-base flex items-center gap-1.5 cursor-pointer hover:text-indigo-600 transition-colors truncate"
                              onClick={() => toggleCollapse(itemKey)}
                            >
                              🧹 {space.name}
                            </h4>
                            {isHybrid && (
                              <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0" title="此空間可提供場地租借">
                                🔄 共享場地
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                            <span className="bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider shadow-sm select-none">
                              {space.category}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {!isEditing && (
                                <button
                                  onClick={() => handleStartEditPublicSpace(space)}
                                  className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                                  title="設定電燈開關 ID"
                                >
                                  <Settings size={15} />
                                </button>
                              )}
                              <button
                                onClick={() => toggleCollapse(itemKey)}
                                className="p-1 hover:bg-slate-100 text-slate-455 hover:text-slate-700 rounded-lg transition-all"
                                title={isCollapsed ? '展開控制台' : '收合控制台'}
                              >
                                {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Collapsible Panel Content */}
                        {!isCollapsed && (
                          <div className="animate-in slide-in-from-top-1 duration-150 space-y-4">
                            {/* Conditional: Edit ID inputs or Status Monitoring dashboard */}
                            {isEditing ? (
                              <div className="space-y-4 animate-in fade-in duration-200">
                                <h5 className="text-xs font-black text-indigo-600 mb-2">⚙️ 設定公共空間電燈 ID</h5>
                                
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1">智慧電燈開關 ID (Light Device ID)</label>
                                  <input 
                                    type="text" 
                                    className="border border-slate-200 p-2.5 text-xs font-mono w-full rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none text-slate-800" 
                                    placeholder="請輸入電燈開關設備 ID，若無則留空" 
                                    value={editForm.tuya_light_id} 
                                    onChange={e => setEditForm({ ...editForm, tuya_light_id: e.target.value })} 
                                  />
                                  <p className="text-[9px] text-slate-400 mt-1 font-semibold">* 支援綁定多個，請用半形逗號 `,` 分隔（例如：ID1,ID2）</p>
                                  {isHybrid && (
                                    <p className="text-[9px] text-amber-600 mt-1 font-bold">ℹ️ 提醒：此為共享場地，儲存後會同步更新至對應場地的電燈開關 ID。</p>
                                  )}
                                </div>

                                <div className="flex gap-2 pt-3 border-t border-slate-100 justify-end">
                                  <button 
                                    disabled={savingId === space.id}
                                    onClick={() => handleSavePublicSpaceIds(space)} 
                                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-all flex items-center gap-1 active:scale-95 shadow-sm"
                                  >
                                    {savingId === space.id ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <Save size={13} />
                                    )}
                                    儲存
                                  </button>
                                  <button 
                                    disabled={savingId === space.id}
                                    onClick={() => setEditingPublicSpaceId(null)} 
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3.5 py-2 rounded-xl text-xs transition-all active:scale-95"
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                {!hasDevices ? (
                                  <div className="py-8 text-center border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 text-xs select-none">
                                    ⚠️ 尚未綁定任何智慧電燈<br />
                                    <button
                                      onClick={() => handleStartEditPublicSpace(space)}
                                      className="text-indigo-600 hover:text-indigo-800 font-bold mt-2 inline-block hover:underline"
                                    >
                                      ⚙️ 立即前往綁定電燈 ID
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-3.5">
                                    {/* Light Component */}
                                    {lightIds.map((lightId: string, index: number) => (
                                      <LightControlSection
                                        key={lightId}
                                        lightId={lightId}
                                        index={index}
                                        totalLights={lightIds.length}
                                        devices={devices}
                                        pendingCommands={pendingCommands}
                                        onControl={handleControl}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── Tuya Quota Error Diagnostic Modal ── */}
      {quotaErrorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" aria-label="Tuya 額度錯誤診斷" className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl shrink-0">
                <ShieldAlert size={28} />
              </div>
              <div className="min-w-0">
                <h4 className="text-base font-extrabold text-slate-800">
                  ⚠️ Tuya 塗鴉平台裝置控制配額限制
                </h4>
                <p className="text-xs text-slate-400 mt-1 font-semibold font-mono">
                  錯誤代碼: 60001001 (Quota Insufficient)
                </p>
              </div>
            </div>

            {/* Error Message Details */}
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs font-semibold text-rose-800 space-y-1">
              <div className="font-bold flex items-center gap-1">❌ 原始錯誤訊息：</div>
              <div className="font-mono break-all font-normal opacity-90">{quotaErrorMsg}</div>
            </div>

            {/* Explanations & Instructions */}
            <div className="space-y-4 text-xs font-semibold text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
              <p className="text-slate-500 font-bold">
                這通常並非本系統程式碼錯誤，而是由於塗鴉 IoT 開發平台對您的雲端專案設定了「可控制設備配額」限制。請依照下列步驟至塗鴉平台排除問題：
              </p>
              
              <ol className="list-decimal pl-4.5 space-y-2.5 font-bold">
                <li>
                  <span className="text-slate-800 font-extrabold">登入塗鴉 IoT 開發平台：</span><br />
                  使用管理員帳號前往 <a href="https://iot.tuya.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 hover:underline">Tuya IoT Platform (iot.tuya.com)</a> 並登入。
                </li>
                <li>
                  <span className="text-slate-800 font-extrabold">進入您的雲端專案：</span><br />
                  於左側選單點選 <span className="text-slate-800">「云开发 (Cloud)」</span> &gt; <span className="text-slate-800">「开发管理 (Development)」</span>，點選進入您目前使用的專案。
                </li>
                <li>
                  <span className="text-slate-800 font-extrabold">管理設備授權池 (Controllable Device Pool)：</span><br />
                  切換至 <span className="text-slate-800">「設備 (Devices)」</span> 頁籤 &gt; 點選 <span className="text-slate-800">「Controllable Device Pool (可控制設備池)」</span>。
                </li>
                <li>
                  <span className="text-slate-800 font-extrabold">移除閒置的測試設備：</span><br />
                  因為塗鴉免費/試用版專案限制了同時能控制的設備總數。請將目前沒有在現場使用的設備 ID 進行「解綁」或「移除」，釋出配額。
                </li>
                <li>
                  <span className="text-slate-800 font-extrabold">專案過期免費續期：</span><br />
                  若您的免費開發專案試用期已滿（通常是一年），請至 <span className="text-slate-800">「云开发 (Cloud)」</span> &gt; <span className="text-slate-800">「服务項目 (Cloud Services)」</span> &gt; <span className="text-slate-800">「云开发服务计划 (Cloud Development Plan)」</span> 申請免費續期即可。
                </li>
              </ol>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <a 
                href="https://iot.tuya.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 text-center flex-1 sm:flex-none"
              >
                🌐 前往塗鴉平台
              </a>
              <button
                onClick={() => setQuotaErrorModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all active:scale-95 flex-1 sm:flex-none"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
