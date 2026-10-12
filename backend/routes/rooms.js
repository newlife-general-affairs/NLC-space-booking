const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { authMiddleware, requireRole } = require('../authMiddleware');
const { sanitizeString } = require('../validators');

// 獲取場地 (可選據點過濾)
router.get('/', async (req, res) => {
  const { branch } = req.query;
  let query = supabase.from('rooms').select('*').order('id', { ascending: true });
  if (branch) query = query.eq('branch', branch);
  
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Failed to fetch rooms' });
  res.json(data);
});

// 管理員新增場地
router.post('/', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { name, capacity, description, image_url, branch, tuya_device_id, tuya_light_id, tuya_ac_id } = req.body;

  if (!name || !branch) return res.status(400).json({ error: '場地名稱與據點為必填欄位' });

  if (req.user.role !== 'system_admin' && req.user.branch !== branch) {
    return res.status(403).json({ error: '您無權管理此據點的場地' });
  }

  const cleanName = sanitizeString(name, 100);
  const cleanDesc = sanitizeString(description, 500);

  // 檢查是否已存在同名場地
  const { data: existing } = await supabase
    .from('rooms')
    .select('id')
    .eq('name', cleanName)
    .eq('branch', branch)
    .maybeSingle();

  if (existing) {
    return res.status(400).json({ error: `此據點已存在名為「${cleanName}」的場地，名稱不能重複` });
  }

  const { data, error } = await supabase
    .from('rooms')
    .insert([{ name: cleanName, capacity: Number(capacity) || 0, description: cleanDesc, image_url, branch, tuya_device_id, tuya_light_id, tuya_ac_id }])
    .select();

  if (error) return res.status(500).json({ error: error.message });

  // Sync to public_spaces if tuya_light_id is set
  if (tuya_light_id) {
    await supabase
      .from('public_spaces')
      .update({ tuya_light_id })
      .eq('name', cleanName)
      .eq('branch', branch);
  }

  res.status(201).json(data[0]);
});

// 儲存場地座標 (供地圖編輯模式使用)
router.put('/:id/polygon', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { id } = req.params;
  const { polygon_points } = req.body;
  
  const { data: room } = await supabase.from('rooms').select('branch').eq('id', id).single();
  if (req.user.role !== 'system_admin' && req.user.branch !== '全' && (!room || room.branch !== req.user.branch)) {
    return res.status(403).json({ error: '您無權管理此據點的場地座標' });
  }

  const { data, error } = await supabase
    .from('rooms')
    .update({ polygon_points })
    .eq('id', id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

// 獲取特定空間某日的借用記錄
router.get('/:id/bookings', async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;
  let query = supabase.from('bookings').select('start_time, end_time').eq('room_id', id).order('start_time', { ascending: true });
  if (date) query = query.eq('booking_date', date);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Failed to fetch room bookings' });
  res.json(data);
});

// 管理員修改場地
router.put('/:id', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { id } = req.params;
  const { name, capacity, description, image_url, branch, tuya_device_id, tuya_light_id, tuya_ac_id } = req.body;

  if (!name) return res.status(400).json({ error: '場地名稱為必填欄位' });

  const { data: room } = await supabase.from('rooms').select('branch').eq('id', id).single();
  if (!room) return res.status(404).json({ error: '找不到該場地' });

  if (req.user.role !== 'system_admin' && req.user.branch !== '全' && room.branch !== req.user.branch) {
    return res.status(403).json({ error: '您無權修改此據點的場地' });
  }

  const cleanName = sanitizeString(name, 100);
  const cleanDesc = sanitizeString(description, 500);

  // 檢查是否已存在同名場地
  const { data: existing } = await supabase
    .from('rooms')
    .select('id')
    .eq('name', cleanName)
    .eq('branch', room.branch)
    .neq('id', id)
    .maybeSingle();

  if (existing) {
    return res.status(400).json({ error: `此據點已存在名為「${cleanName}」的場地，名稱不能重複` });
  }

  const { data, error } = await supabase.from('rooms').update({ name: cleanName, capacity: Number(capacity) || 0, description: cleanDesc, image_url, branch, tuya_device_id, tuya_light_id, tuya_ac_id }).eq('id', id).select().single();
  if (error) return res.status(500).json({ error: 'Failed to update room' });

  // Sync to public_spaces if tuya_light_id is updated
  if (req.body.hasOwnProperty('tuya_light_id')) {
    await supabase
      .from('public_spaces')
      .update({ tuya_light_id })
      .eq('name', cleanName)
      .eq('branch', branch);
  }

  res.json(data);
});

// 管理員批次刪除場地
router.post('/batch-delete', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '請提供要刪除的場地 ID 列表' });
  }

  if (req.user.role !== 'system_admin' && req.user.branch !== '全') {
    const { data: roomsToCheck, error: fetchErr } = await supabase
      .from('rooms')
      .select('branch')
      .in('id', ids);

    if (fetchErr) return res.status(500).json({ error: '取得場地資訊失敗' });
    
    const unauthorized = roomsToCheck.some(r => r.branch !== req.user.branch);
    if (unauthorized) {
      return res.status(403).json({ error: '您無權刪除其他據點的場地' });
    }
  }

  // 1. 刪除預約
  const { error: bookingsDelErr } = await supabase
    .from('bookings')
    .delete()
    .in('room_id', ids);

  if (bookingsDelErr) return res.status(500).json({ error: `刪除場地預約失敗: ${bookingsDelErr.message}` });

  // 2. 刪除場地
  const { error: roomsDelErr } = await supabase
    .from('rooms')
    .delete()
    .in('id', ids);

  if (roomsDelErr) return res.status(500).json({ error: `批次刪除場地失敗: ${roomsDelErr.message}` });

  res.json({ message: '批次刪除成功' });
});

// 管理員刪除場地
router.delete('/:id', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { id } = req.params;
  const { data: room } = await supabase.from('rooms').select('branch').eq('id', id).single();
  if (!room) return res.status(404).json({ error: '找不到該場地' });

  if (req.user.role !== 'system_admin' && req.user.branch !== '全' && room.branch !== req.user.branch) {
    return res.status(403).json({ error: '您無權刪除此據點的場地' });
  }

  const { error } = await supabase.from('rooms').delete().eq('id', id);
  if (error) return res.status(500).json({ error: 'Failed to delete room' });
  res.json({ message: 'Deleted successfully' });
});

// 📥 從 Google 試算表匯入場地與預約資料
router.post('/import-sheets', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { sheetUrl } = req.body;
  if (!sheetUrl) {
    return res.status(400).json({ error: '請提供 Google 試算表連結' });
  }

  try {
    // 1. 解析試算表 ID 與 gid
    const sheetIdMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
      return res.status(400).json({ error: '無效的 Google 試算表連結，找不到試算表 ID' });
    }
    const spreadsheetId = sheetIdMatch[1];
    
    let gid = null;
    const gidMatch = sheetUrl.match(/[#?&]gid=([0-9]+)/);
    if (gidMatch) {
      gid = gidMatch[1];
    }

    // 2. 獲取 htmlview 以對照 gid 與工作表名稱
    const htmlUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview`;
    const htmlRes = await fetch(htmlUrl);
    if (!htmlRes.ok) {
      return res.status(400).json({ error: '無法讀取該試算表，請確認已設定為「知道連結的人均可檢視」' });
    }
    const htmlText = await htmlRes.text();

    let targetSheetName = null;
    const sheetMapping = [];
    const mappingRegex = /name:\s*"([^"]+)"[^}]+gid:\s*"([^"]+)"/g;
    let mapMatch;

    function unescapeJsString(str) {
      return str
        .replace(/\\x([0-9a-fA-F]{2})/g, (match, hex) => {
          return String.fromCharCode(parseInt(hex, 16));
        })
        .replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
          return String.fromCharCode(parseInt(hex, 16));
        })
        .replace(/\\(.)/g, (match, char) => {
          if (char === '/') return '/';
          if (char === '"') return '"';
          if (char === "'") return "'";
          if (char === '\\') return '\\';
          if (char === 'n') return '\n';
          if (char === 'r') return '\r';
          if (char === 't') return '\t';
          return match;
        });
    }

    while ((mapMatch = mappingRegex.exec(htmlText)) !== null) {
      sheetMapping.push({ gid: mapMatch[2], name: unescapeJsString(mapMatch[1]) });
    }

    if (gid) {
      const foundSheet = sheetMapping.find(s => s.gid === gid);
      if (foundSheet) {
        targetSheetName = foundSheet.name;
      }
    }

    // 3. 下載 XLSX 檔案
    const xlsxUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
    const xlsxRes = await fetch(xlsxUrl);
    if (!xlsxRes.ok) {
      return res.status(400).json({ error: '下載 Excel 檔案失敗，請稍後再試' });
    }
    const arrayBuffer = await xlsxRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. 解析 XLSX
    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // 找出所有可見的工作表，忽略隱藏的工作表
    const visibleSheetNames = [];
    const sheetNames = workbook.SheetNames;
    const sheetsMeta = workbook.Workbook?.Sheets || [];

    sheetNames.forEach((name, idx) => {
      const isHidden = sheetsMeta[idx]?.Hidden === 1 || sheetsMeta[idx]?.Hidden === 2;
      if (!isHidden) {
        visibleSheetNames.push(name);
      }
    });

    if (visibleSheetNames.length === 0) {
      return res.status(400).json({ error: '此 Excel 檔案中沒有任何可見的工作表' });
    }

    function normalizeSheetName(name) {
      return name ? name.replace(/[\\/?*:[\]]/g, '').trim() : '';
    }

    let actualSheetName = null;
    if (targetSheetName) {
      const targetNorm = normalizeSheetName(targetSheetName);
      // 優先尋找可見的工作表
      actualSheetName = visibleSheetNames.find(name => normalizeSheetName(name) === targetNorm);
      
      // 如果可見的找不到，但在所有工作表中能找到，代表已被隱藏
      if (!actualSheetName) {
        const foundHidden = sheetNames.find(name => normalizeSheetName(name) === targetNorm);
        if (foundHidden) {
          return res.status(400).json({ error: `指定的工作表「${targetSheetName}」在試算表中已被隱藏，無法匯入！` });
        }
        return res.status(400).json({ error: `找不到工作表：${targetSheetName}` });
      }
    } else {
      actualSheetName = visibleSheetNames[0];
    }
    
    const sheet = workbook.Sheets[actualSheetName];
    if (!sheet) {
      return res.status(400).json({ error: `找不到工作表：${targetSheetName || actualSheetName}` });
    }

    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    const merges = sheet['!merges'] || [];

    // 輔助函式：尋找合併儲存格的 Master Cell
    function findMergedMasterCell(r, c) {
      for (const merge of merges) {
        if (r >= merge.s.r && r <= merge.e.r && c >= merge.s.c && c <= merge.e.c) {
          return merge;
        }
      }
      return null;
    }

    function getCellValue(r, c) {
      const merge = findMergedMasterCell(r, c);
      const targetCell = merge ? merge.s : { r, c };
      const cellRef = XLSX.utils.encode_cell(targetCell);
      const cell = sheet[cellRef];
      if (!cell) return '';

      // 若為 Date 儲存格且值為 JS Date 物件，轉為 YYYY-MM-DD
      if (cell.t === 'd' && cell.v instanceof Date) {
        const d = cell.v;
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }

      const val = cell.w !== undefined ? cell.w : (cell.v !== undefined ? String(cell.v) : '');
      return val.trim();
    }

    function parseCleanDate(dateVal) {
      if (!dateVal) return null;
      const cleaned = dateVal.replace(/[\s\r\n]+/g, '');
      const dateMatch = cleaned.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
      if (dateMatch) {
        return `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      }
      const shortDateMatch = cleaned.match(/(\d{1,2})[-/.](\d{1,2})/);
      if (shortDateMatch) {
        const year = new Date().getFullYear();
        return `${year}-${shortDateMatch[1].padStart(2, '0')}-${shortDateMatch[2].padStart(2, '0')}`;
      }
      return null;
    }

    let isSecondFormat = false;
    let headerRowIndex = -1;

    for (let r = 0; r < Math.min(15, range.e.r + 1); r++) {
      const cellA = getCellValue(r, 0);
      const cellC = getCellValue(r, 2);
      if (cellA === '日期' && cellC === '內容') {
        isSecondFormat = true;
        headerRowIndex = r;
        break;
      }
    }

    const { data: dbRooms, error: roomsFetchErr } = await supabase.from('rooms').select('*');
    if (roomsFetchErr) throw roomsFetchErr;
    const adminBranch = req.user?.branch || '仁愛堂';

    // ── 智慧型場地匹配輔助函數 ──
    function getKeywordsForRoom(room) {
      const name = room.name;
      const keywords = [name];
      const lowerName = name.toLowerCase();
      
      const numMap = {
        '第一教室': ['1', '一教', '1教'],
        '第二教室': ['2', '二教', '2教'],
        '第三教室': ['3', '三教', '3教'],
        '第四教室': ['4', '四教', '4教'],
        '第五教室': ['5', '五教', '5教'],
        '第一': ['1'], '第二': ['2'], '第三': ['3'], '第四': ['4'], '第五': ['5'], '第六': ['6'],
        '互動區-一': ['1', '互動區一'],
        '互動區-二': ['2', '互動區二'],
        '互動區-三': ['3', '互動區三'],
        '互動區-四': ['4', '互動區四'],
        '互動區第2區塊': ['2', '互動區2', '2區塊'],
        '互動區第4區塊': ['4', '互動區4', '4區塊'],
        '互動區第6區塊': ['6', '互動區6', '6區塊'],
        '會堂': ['大會堂', '會堂'],
        '走道': ['走廊', '走道'],
        '廚房前': ['廚房'],
        '豆腐區': ['豆腐']
      };
      
      for (const [key, replacementList] of Object.entries(numMap)) {
        if (name.includes(key)) {
          for (const rep of replacementList) {
            keywords.push(name.replace(key, rep));
            if (name.startsWith('B2-') || name.startsWith('B1-')) {
              const shortName = name.substring(3);
              keywords.push(shortName);
              keywords.push(shortName.replace(key, rep));
              
              const prefix = name.substring(0, 2);
              keywords.push(prefix + shortName);
              keywords.push(prefix + shortName.replace(key, rep));
            }
          }
        }
      }
      
      keywords.push(lowerName.replace(/[-_\s]/g, ''));
      
      const uniqueKeywords = [...new Set(keywords.map(k => k.toLowerCase().trim()))].filter(Boolean);
      return uniqueKeywords.sort((a, b) => b.length - a.length);
    }

    function findBestMatchingRoom(rawName, dbRooms, branch) {
      if (!rawName) return null;

      const cleanName = rawName.trim();
      if (!cleanName) return null;

      const normKey = cleanName.toLowerCase().replace(/[-_\s]/g, '');

      const aliasMap = {
        'b25': 'B2-第五教室',
        '第五教室': 'B2-第五教室',
        '五教': 'B2-第五教室',
        'b2五教': 'B2-第五教室',
        'b2-5': 'B2-第五教室',
        'b21': 'B2-第一教室',
        '第一教室': 'B2-第一教室',
        '一教': 'B2-第一教室',
        'b2-1': 'B2-第一教室',
        'b22': 'B2-第二教室',
        '第二教室': 'B2-第二教室',
        '二教': 'B2-第二教室',
        'b2-2': 'B2-第二教室',
        'b23': 'B2-第三教室',
        '第三教室': 'B2-第三教室',
        '三教': 'B2-第三教室',
        'b2-3': 'B2-第三教室',
        'b24': 'B2-第四教室',
        '第四教室': 'B2-第四教室',
        '四教': 'B2-第四教室',
        'b2-4': 'B2-第四教室',
        'b1大會堂': 'B1-會堂',
        '大會堂': 'B1-會堂',
        '會堂': 'B1-會堂',
        '仁愛會堂': 'B1-會堂',
        '副堂': 'B1-副堂',
        'b1副堂': 'B1-副堂',
        'b2走廊': 'B2-走道',
        'b2走道': 'B2-走道',
        'b2-走廊': 'B2-走道',
        '走廊': 'B2-走道',
        '走道': 'B2-走道',
        '豆腐': 'B2-豆腐區',
        '豆腐區': 'B2-豆腐區',
        'b2豆腐': 'B2-豆腐區',
        'b2豆腐區': 'B2-豆腐區',
        '廚房': 'B2-廚房前',
        '廚房前': 'B2-廚房前',
        'b2廚房': 'B2-廚房前',
        'b11': 'B1-互動區-一',
        'b12': 'B1-互動區第2區塊',
        'b13': 'B1-互動區-三',
        'b14': 'B1-互動區第4區塊',
        'b15': 'B1-互動區第5區塊',
        'b16': 'B1-互動區第6區塊'
      };

      const aliasTargetName = aliasMap[normKey];

      function getFeatureKey(s) {
        let val = s.toLowerCase().trim();
        // 移除據點名稱以防干擾
        val = val.replace(/(仁愛堂|士林堂|新莊堂|大福堂)/g, '');
        const numMap = {
          '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
          '六': '6', '七': '7', '八': '8', '九': '9', '十': '10'
        };
        for (const [zh, en] of Object.entries(numMap)) {
          val = val.replace(new RegExp(zh, 'g'), en);
        }
        val = val.replace(/(互動區|教室|區塊|第|區|座位|區域|沙發區|中間)/g, '');
        val = val.replace(/[-_\s+、,，&()（）]/g, '');
        return val;
      }

      const rawFeature = getFeatureKey(cleanName);

      // --- 同據點優先匹配 (branch) ---
      
      // 1. 同據點：精準名稱
      let match = dbRooms.find(r => r.name === cleanName && r.branch === branch);
      if (match) return match;

      // 2. 同據點：別名對照表
      if (aliasTargetName) {
        match = dbRooms.find(r => r.name === aliasTargetName && r.branch === branch);
        if (match) return match;
      }

      // 3. 同據點：特徵值匹配
      if (rawFeature) {
        match = dbRooms.find(r => r.branch === branch && getFeatureKey(r.name) === rawFeature);
        if (match) return match;
      }

      // 4. 同據點：模糊包含
      match = dbRooms.find(r => r.branch === branch && (r.name.includes(cleanName) || cleanName.includes(r.name)));
      if (match) return match;

      if (rawFeature) {
        match = dbRooms.find(r => r.branch === branch && (rawFeature.includes(getFeatureKey(r.name)) || getFeatureKey(r.name).includes(rawFeature)));
        if (match) return match;
      }

      // --- 跨據點次之匹配 (全/跨據點) ---

      // 5. 跨據點：精準名稱
      match = dbRooms.find(r => r.name === cleanName);
      if (match) return match;

      // 6. 跨據點：別名對照表
      if (aliasTargetName) {
        match = dbRooms.find(r => r.name === aliasTargetName);
        if (match) return match;
      }

      // 7. 跨據點：特徵值匹配
      if (rawFeature) {
        match = dbRooms.find(r => getFeatureKey(r.name) === rawFeature);
        if (match) return match;
      }

      // 8. 跨據點：模糊包含
      match = dbRooms.find(r => r.name.includes(cleanName) || cleanName.includes(r.name));
      if (match) return match;

      if (rawFeature) {
        match = dbRooms.find(r => rawFeature.includes(getFeatureKey(r.name)) || getFeatureKey(r.name).includes(rawFeature));
        if (match) return match;
      }

      // 9. 兜底回傳「由教會分配」的據點場地
      match = dbRooms.find(r => r.name.includes('由教會分配') && r.branch === branch);
      if (match) return match;

      match = dbRooms.find(r => r.name.includes('由教會分配'));
      if (match) return match;

      return dbRooms[0] || null;
    }

    function isRoomToken(token, dbRooms) {
      const t = token.toLowerCase().trim();
      if (!t) return false;
      
      if (t.match(/(b1|b2|會堂|副堂|教室|走廊|走道|豆腐|互動|區塊|區|廚房|新娘|分配|堂)/i)) {
        return true;
      }
      
      const roomKeywords = [
        'b21', 'b22', 'b23', 'b24', 'b25', 'b11', 'b12', 'b13', 'b14', 'b15', 'b16',
        'b2-1', 'b2-2', 'b2-3', 'b2-4', 'b2-5', 'b1-1', 'b1-2', 'b1-3', 'b1-4', 'b1-5', 'b1-6'
      ];
      if (roomKeywords.includes(t)) {
        return true;
      }
      
      if (dbRooms.some(r => r.name !== '💒 由教會分配' && r.name.toLowerCase() === t)) {
        return true;
      }
      
      return false;
    }

    function extractMatchedRoomsFromRow(r, range, dbRooms, adminBranch) {
      const matched = [];
      const seenIds = new Set();
      
      // 掃描第2欄 (Column C) 開始到最後一欄，排除第3欄 (Column D - 時間)
      for (let c = 2; c <= range.e.c; c++) {
        if (c === 3) continue; // 排除時間欄位
        
        const val = getCellValue(r, c);
        if (!val) continue;
        
        // 依常見分隔符切分字串 (包含空格與標點)
        const tokens = val.split(/[\n\r/+、,，&\s]|和|與/).map(t => t.trim()).filter(Boolean);
        for (const token of tokens) {
          if (isRoomToken(token, dbRooms)) {
            const room = findBestMatchingRoom(token, dbRooms, adminBranch);
            if (room && !seenIds.has(room.id)) {
              seenIds.add(room.id);
              matched.push(room);
            }
          }
        }
      }
      
      return matched;
    }

    function mapRoomNameToDbNames(rawName, dbRooms, adminBranch) {
      if (!rawName) return [];
      
      const parts = rawName.split(/[+、,，&\s/]|和|與/).map(p => p.trim()).filter(Boolean);
      const matchedNames = [];

      for (const part of parts) {
        const matchedRoom = findBestMatchingRoom(part, dbRooms, adminBranch);
        if (matchedRoom) {
          matchedNames.push({ name: matchedRoom.name, branch: matchedRoom.branch });
        }
      }

      return matchedNames;
    }

    // 輔支時間解析函式
    function parseTimeRange(str) {
      const cleaned = str.replace(/[\u4e00-\u9fa5]+/g, '').trim();
      let match = cleaned.match(/^(\d{1,2}):?(\d{2})\s*-\s*(\d{1,2}):?(\d{2})$/);
      if (match) {
        const startH = match[1].padStart(2, '0');
        const startM = match[2];
        const endH = match[3].padStart(2, '0');
        const endM = match[4];
        return { start: `${startH}:${startM}`, end: `${endH}:${endM}` };
      }
      match = cleaned.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
      if (match) {
        const startH = match[1].padStart(2, '0');
        const endH = match[2].padStart(2, '0');
        return { start: `${startH}:00`, end: `${endH}:00` };
      }
      return null;
    }

    // 解析試算表左側欄位時間插槽 (包含週末如「上午8-12」、「下12-15」、「晚上18-22」等)
    function parseTimeSlotHeader(timeSlot) {
      if (!timeSlot) return null;
      const cleaned = timeSlot.replace(/[\s\r\n]+/g, '');
      const match = cleaned.match(/(\d{1,2}(?:\.\d+)?)\s*-\s*(\d{1,2}(?:\.\d+)?)/);
      if (match) {
        let startVal = parseFloat(match[1]);
        let endVal = parseFloat(match[2]);
        const isPM = cleaned.includes('下') || cleaned.includes('晚');
        if (isPM) {
          if (startVal < 8) startVal += 12;
          if (endVal < 8) endVal += 12;
          if (endVal < startVal) endVal += 12;
        }
        const formatTime = (val) => {
          const h = Math.floor(val);
          const m = Math.round((val - h) * 60);
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        };
        return {
          start: formatTime(startVal),
          end: formatTime(endVal)
        };
      }
      
      if (cleaned.includes('晨')) return { start: '06:30', end: '08:00' };
      if (cleaned.includes('上')) return { start: '09:00', end: '12:00' };
      if (cleaned.includes('下')) return { start: '13:00', end: '17:00' };
      if (cleaned.includes('晚')) return { start: '18:30', end: '22:00' };
      return null;
    }

    // 跨天日期調整 (例如週六的婚禮，其他需求欄位標註週日/...)
    function adjustDate(baseDateStr, text) {
      if (!text.includes('週日') && !text.includes('週六')) return baseDateStr;
      
      const baseDate = new Date(baseDateStr);
      const day = baseDate.getDay(); // 0 is Sunday, 6 is Saturday
      
      if (text.includes('週日') && day === 6) {
        baseDate.setDate(baseDate.getDate() + 1);
        return baseDate.toISOString().split('T')[0];
      }
      if (text.includes('週六') && day === 0) {
        baseDate.setDate(baseDate.getDate() - 1);
        return baseDate.toISOString().split('T')[0];
      }
      return baseDateStr;
    }

    // 解析單行預約資料 (例如: "1500-1730/婚禮愛宴/150 B2走廊")
    function parseBookingLine(line, defaultRoom, baseDateStr, basePurpose) {
      if (!line.trim()) return null;

      const parts = line.split('/').map(p => p.trim());
      let timeRange = null;
      let room = defaultRoom || '';
      let subPurpose = '';
      let attendance = 10;
      let dateStr = baseDateStr;

      for (const part of parts) {
        if (part.includes('週日') || part.includes('週六')) {
          dateStr = adjustDate(baseDateStr, part);
          continue;
        }
        
        const parsedTime = parseTimeRange(part);
        if (parsedTime) {
          timeRange = parsedTime;
          continue;
        }

        const cleanedPart = part.replace(/[、，,。.]/g, '').trim();
        const hasRoomIndicator = isRoomToken(cleanedPart, dbRooms);
        
        const numberRoomMatch = cleanedPart.match(/^(\d+)\s*(.+)$/);
        if (numberRoomMatch && isRoomToken(numberRoomMatch[2], dbRooms)) {
          attendance = parseInt(numberRoomMatch[1]);
          room = numberRoomMatch[2];
          continue;
        }

        if (hasRoomIndicator) {
          room = cleanedPart;
          continue;
        }

        if (cleanedPart.match(/^\d+$/)) {
          attendance = parseInt(cleanedPart);
          continue;
        }

        if (cleanedPart && cleanedPart !== '婚禮' && cleanedPart !== '常規' && cleanedPart !== '重要') {
          subPurpose = cleanedPart;
        }
      }

      if (!timeRange) return null;

      return {
        date: dateStr,
        startTime: timeRange.start,
        endTime: timeRange.end,
        roomName: room || defaultRoom || 'B1-會堂',
        purpose: subPurpose ? `${basePurpose} (${subPurpose})` : basePurpose,
        attendance
      };
    }

    const columns = [];
    const parsedBookings = [];

    if (isSecondFormat) {
      // ── 第二種格式 (婚禮與特殊活動) ──
      for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
        const dateVal = getCellValue(r, 0); // Column A
        const contentVal = getCellValue(r, 2); // Column C
        const timeVal = getCellValue(r, 3); // Column D
        const otherVal = getCellValue(r, 4); // Column E

        if (!dateVal) continue;

        const baseDateStr = parseCleanDate(dateVal);
        if (!baseDateStr) continue;

        const basePurpose = contentVal || '特殊活動';
        const bookingType = basePurpose.includes('婚禮') ? '婚禮' : '重要';

        // 1. 尋找這一列中所有提到的場地
        const rowMatchedRooms = extractMatchedRoomsFromRow(r, range, dbRooms, adminBranch);

        // 2. 確定主要場地 (以第一個匹配到的為準，若無則兜底使用教會分配)
        const primaryRoom = rowMatchedRooms.length > 0 ? rowMatchedRooms[0].name : '💒 由教會分配';

        const otherLines = otherVal ? otherVal.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean) : [];
        let otherHasTime = false;
        for (const line of otherLines) {
          const parts = line.split('/').map(p => p.trim());
          for (const part of parts) {
            if (parseTimeRange(part)) {
              otherHasTime = true;
              break;
            }
          }
          if (otherHasTime) break;
        }

        if (timeVal && otherVal && !otherHasTime) {
          // 欄位 D 是時間，欄位 E 是場地 (單一預約)
          const matchedRoomsForLine = mapRoomNameToDbNames(otherVal, dbRooms, adminBranch);
          
          if (matchedRoomsForLine.length > 0) {
            for (const mr of matchedRoomsForLine) {
              const mainBooking = parseBookingLine(timeVal, mr.name, baseDateStr, basePurpose);
              if (mainBooking) {
                parsedBookings.push({
                  ...mainBooking,
                  roomName: mr.name,
                  branch: mr.branch,
                  bookingType
                });
              }
            }
          } else {
            // 如果沒解析到場地，使用 primaryRoom
            const mainBooking = parseBookingLine(timeVal, primaryRoom, baseDateStr, basePurpose);
            if (mainBooking) {
              const matchedPrimary = dbRooms.find(r => r.name === primaryRoom && r.branch === adminBranch) || dbRooms.find(r => r.name === primaryRoom) || dbRooms[0];
              parsedBookings.push({
                ...mainBooking,
                roomName: matchedPrimary.name,
                branch: matchedPrimary.branch,
                bookingType
              });
            }
          }
        } else {
          // 欄位 D 是主預約，欄位 E 是其他場地需求 (多筆)
          if (timeVal) {
            const mainBooking = parseBookingLine(timeVal, primaryRoom, baseDateStr, basePurpose);
            if (mainBooking) {
              const matchedPrimary = dbRooms.find(r => r.name === primaryRoom && r.branch === adminBranch) || dbRooms.find(r => r.name === primaryRoom) || dbRooms[0];
              parsedBookings.push({
                ...mainBooking,
                roomName: matchedPrimary.name,
                branch: matchedPrimary.branch,
                bookingType
              });
            }
          }
          if (otherVal) {
            for (const line of otherLines) {
              const extraBooking = parseBookingLine(line, primaryRoom, baseDateStr, basePurpose);
              if (extraBooking) {
                const matchedRoom = findBestMatchingRoom(extraBooking.roomName, dbRooms, adminBranch);
                parsedBookings.push({
                  ...extraBooking,
                  roomName: matchedRoom.name,
                  branch: matchedRoom.branch,
                  bookingType
                });
              }
            }
          }
        }
      }

      // 重構 columns 以配合回傳格式
      columns.length = 0;
      const uniqueRooms = [];
      for (const b of parsedBookings) {
        if (!uniqueRooms.some(r => r.name === b.roomName && r.branch === b.branch)) {
          uniqueRooms.push({
            name: b.roomName,
            branch: b.branch,
            capacity: b.attendance || 20
          });
        }
      }
      uniqueRooms.forEach((ur, idx) => {
        columns.push({
          colIndex: 9999 + idx,
          rawRoomName: ur.name,
          cleanRoomName: ur.name,
          branch: ur.branch,
          capacity: ur.capacity
        });
      });

    } else {
      // ── 第一種格式 (原有的橫向場地，縱向時間插槽) ──
      for (let c = 2; c <= range.e.c; c++) {
        const parentName = getCellValue(1, c);
        const childName = getCellValue(2, c);
        const capacityText = getCellValue(3, c);

        if (!parentName && !childName) continue;

        let roomName = '';
        let branch = '仁愛堂';

        if (parentName.includes('士林堂') || childName.includes('士林堂')) {
          branch = '士林堂';
        }

        if (parentName && childName) {
          if (parentName === childName || childName.includes(parentName)) {
            roomName = childName;
          } else {
            roomName = `${parentName}-${childName}`;
          }
        } else {
          roomName = parentName || childName;
        }

        const cleanRoomNameVal = roomName.replace(/\s*\d+人?\s*$/, '').trim();

        let capacity = 20;
        const capMatch = (capacityText + ' ' + roomName).match(/(\d+)人?/);
        if (capMatch) {
          capacity = parseInt(capMatch[1]);
        }

        // 自動匹配資料庫既有場地，絕不自動新增
        const matchedRoom = findBestMatchingRoom(cleanRoomNameVal, dbRooms, branch);

        columns.push({
          colIndex: c,
          rawRoomName: roomName,
          cleanRoomName: matchedRoom ? matchedRoom.name : cleanRoomNameVal,
          branch: matchedRoom ? matchedRoom.branch : branch,
          capacity: matchedRoom ? matchedRoom.capacity : capacity
        });
      }

      if (columns.length === 0) {
        return res.status(400).json({ error: '無法解析場地表頭，請確認試算表格式是否符合規範' });
      }

      let currentDate = null;
      for (let r = 4; r <= range.e.r; r++) {
        const dateVal = getCellValue(r, 0);
        const timeSlot = getCellValue(r, 1);

        if (!timeSlot) continue;

        if (dateVal) {
          const parsedDate = parseCleanDate(dateVal);
          if (parsedDate) {
            currentDate = parsedDate;
          } else {
            currentDate = null;
          }
        }

        if (!currentDate) continue;

        for (const col of columns) {
          const cellText = getCellValue(r, col.colIndex);
          if (!cellText || ['X', 'x', '—', '-', 'x'].includes(cellText.toUpperCase())) {
            continue;
          }

          let startTime = null;
          let endTime = null;
          let purpose = cellText;

          const timeMatch1 = cellText.match(/^(\d{2}):?(\d{2})\s*-\s*(\d{2}):?(\d{2})\s*(.*)$/);
          if (timeMatch1) {
            startTime = `${timeMatch1[1].padStart(2, '0')}:${timeMatch1[2]}`;
            endTime = `${timeMatch1[3].padStart(2, '0')}:${timeMatch1[4]}`;
            purpose = timeMatch1[5].trim();
          } else {
            const timeMatch2 = cellText.match(/^(\d{4})\s*-\s*(\d{4})\s*(.*)$/);
            if (timeMatch2) {
              startTime = `${timeMatch2[1].substring(0, 2)}:${timeMatch2[1].substring(2)}`;
              endTime = `${timeMatch2[2].substring(0, 2)}:${timeMatch2[2].substring(2)}`;
              purpose = timeMatch2[3].trim();
            }
          }

          if (!startTime || !endTime) {
            const parsedSlot = parseTimeSlotHeader(timeSlot);
            if (parsedSlot) {
              startTime = parsedSlot.start;
              endTime = parsedSlot.end;
            } else {
              startTime = '09:00';
              endTime = '18:00';
            }
          }

          parsedBookings.push({
            date: currentDate,
            startTime,
            endTime,
            roomName: col.cleanRoomName,
            branch: col.branch,
            purpose,
            bookingType: '常規',
            attendance: col.capacity
          });
        }
      }
    }

    // 統一校正年分：若同一次匯入的預約中出現不同的年份，自動將少數年份校正為多數年份（修復 A 欄包含跨年分打錯的 typo，例如 Monday 誤植為 2025）
    if (parsedBookings.length > 0) {
      const yearCounts = {};
      for (const b of parsedBookings) {
        if (b.date) {
          const y = b.date.substring(0, 4);
          yearCounts[y] = (yearCounts[y] || 0) + 1;
        }
      }
      const years = Object.keys(yearCounts);
      if (years.length > 1) {
        let majorityYear = years[0];
        let maxCount = yearCounts[majorityYear];
        for (const y of years) {
          if (yearCounts[y] > maxCount) {
            majorityYear = y;
            maxCount = yearCounts[y];
          }
        }
        for (const b of parsedBookings) {
          if (b.date) {
            const currentYear = b.date.substring(0, 4);
            if (currentYear !== majorityYear) {
              b.date = majorityYear + b.date.substring(4);
            }
          }
        }
      }
    }

    // 去除重複解析出的預約
    const uniqueBookings = [];
    const seen = new Set();
    for (const b of parsedBookings) {
      const key = `${b.date}_${b.startTime}_${b.roomName}_${b.purpose}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueBookings.push(b);
      }
    }

    // 7. 與資料庫場地比對建立對照表 (智慧匹配，絕不自行建立空間)
    const roomNameToIdMap = {};
    for (const r of dbRooms) {
      roomNameToIdMap[`${r.name}_${r.branch}`] = r.id;
    }

    // 8. 寫入預約
    if (uniqueBookings.length > 0) {
      // 獲取所有受影響的場地 ID 與日期範圍，執行覆蓋
      const affectedRoomIds = [];
      const affectedDates = [];
      
      const bookingsToInsert = [];

      for (const b of uniqueBookings) {
        const roomId = roomNameToIdMap[`${b.roomName}_${b.branch}`];
        if (!roomId) continue;

        if (!affectedRoomIds.includes(roomId)) affectedRoomIds.push(roomId);
        if (!affectedDates.includes(b.date)) affectedDates.push(b.date);

        // 嘗試從 purpose 中解析牧區與聯絡人
        let pastoralZone = '未知牧區';
        let fullName = '系統匯入';
        
        // 解析例如 "新生命二區 聯合小組"
        const zoneMatch = b.purpose.match(/([^\s]+區)/);
        if (zoneMatch) {
          pastoralZone = zoneMatch[1];
        }

        // 判斷是否為過去的預約
        let isPast = false;
        try {
          let endTimeStr = b.endTime || '';
          if (endTimeStr.split(':').length === 2) {
            endTimeStr = `${endTimeStr}:00`;
          }
          const endDt = new Date(`${b.date}T${endTimeStr}+08:00`);
          isPast = new Date() > endDt;
        } catch (e) {
          console.error('[Import parse isPast error]', e);
        }

        bookingsToInsert.push({
          room_id: roomId,
          user_email: req.user.email,
          booking_date: b.date,
          start_time: b.startTime,
          end_time: b.endTime,
          full_name: fullName,
          phone: '',
          pastoral_zone: pastoralZone,
          purpose: b.purpose,
          booking_type: b.bookingType || '常規',
          attendance_count: b.attendance || 10,
          status: 'approved', // 匯入預設核准
          is_returned: isPast // 若為過去預約，預設為已歸還（不用打掃也不算違規）
        });
      }

      // 清理原有的預約 (執行覆蓋)
      if (affectedRoomIds.length > 0 && affectedDates.length > 0) {
        const { error: deleteErr } = await supabase
          .from('bookings')
          .delete()
          .in('room_id', affectedRoomIds)
          .in('booking_date', affectedDates);
          
        if (deleteErr) console.warn('Warning deleting existing bookings:', deleteErr.message);
      }

      // 1. Fetch remaining bookings in the database for the affected dates (e.g. parent/child room bookings)
      let existingDbBookings = [];
      if (affectedDates.length > 0) {
        const { data: remainingBookings, error: fetchErr } = await supabase
          .from('bookings')
          .select('id, room_id, booking_date, start_time, end_time, status')
          .in('booking_date', affectedDates)
          .neq('status', 'rejected');
        if (!fetchErr && remainingBookings) {
          existingDbBookings = remainingBookings;
        }
      }

      // 2. Define conflict checkers
      const checkRoomsConflict = (id1, id2) => {
        if (id1 === id2) return true;
        const r1 = dbRooms.find(r => r.id === id1);
        const r2 = dbRooms.find(r => r.id === id2);
        if (r1 && r1.parent_room_id === id2) return true;
        if (r2 && r2.parent_room_id === id1) return true;
        return false;
      };

      const isTimeOverlap = (b1, b2) => {
        const d1 = b1.booking_date;
        const d2 = b2.booking_date;
        if (d1 !== d2) return false;

        const start1 = (b1.start_time || '').substring(0, 5);
        const end1 = (b1.end_time || '').substring(0, 5);
        const start2 = (b2.start_time || '').substring(0, 5);
        const end2 = (b2.end_time || '').substring(0, 5);

        return start1 < end2 && end1 > start2;
      };

      const checkIsPast = (date, endTime) => {
        try {
          let endTimeStr = endTime || '';
          if (endTimeStr.split(':').length === 2) {
            endTimeStr = `${endTimeStr}:00`;
          }
          const endDt = new Date(`${date}T${endTimeStr}+08:00`);
          return new Date() > endDt;
        } catch {
          return false;
        }
      };

      const conflictedIndexes = new Set();

      // 3. Compare each booking in bookingsToInsert
      for (let i = 0; i < bookingsToInsert.length; i++) {
        const b1 = bookingsToInsert[i];
        if (b1.is_returned) continue; // Skip past bookings

        // Check against other bookings in the same batch
        for (let j = 0; j < bookingsToInsert.length; j++) {
          if (i === j) continue;
          const b2 = bookingsToInsert[j];
          if (b2.is_returned) continue; // Skip past bookings
          if (checkRoomsConflict(b1.room_id, b2.room_id) && isTimeOverlap(b1, b2)) {
            conflictedIndexes.add(i);
            conflictedIndexes.add(j);
          }
        }

        // Check against remaining bookings in the database
        for (const bDb of existingDbBookings) {
          if (checkIsPast(bDb.booking_date, bDb.end_time)) continue; // Skip past DB bookings
          if (checkRoomsConflict(b1.room_id, bDb.room_id) && isTimeOverlap(b1, bDb)) {
            conflictedIndexes.add(i);
          }
        }
      }

      // 4. Update status for conflicted bookings
      for (let i = 0; i < bookingsToInsert.length; i++) {
        if (conflictedIndexes.has(i)) {
          bookingsToInsert[i].status = 'pending';
        }
      }

      // 批次插入
      if (bookingsToInsert.length > 0) {
        const { error: insertErr } = await supabase
          .from('bookings')
          .insert(bookingsToInsert);
          
        if (insertErr) throw insertErr;
      }
    }

    res.json({
      message: 'Google 試算表匯入成功！',
      sheetName: targetSheetName,
      roomsParsed: columns.length,
      bookingsParsed: uniqueBookings.length
    });

  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: `匯入失敗：${err.message || '伺服器錯誤'}` });
  }
});

module.exports = router;
