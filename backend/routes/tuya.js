const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getAccessToken, getDeviceList, sendDeviceCommands } = require('../tuyaClient');
const { authMiddleware, requireRole } = require('../authMiddleware');
const { supabase } = require('../database');

// Device In-Memory Cache: deviceId -> { online, name, status, timestamp }
const deviceCache = new Map();
const CACHE_TTL = 5000; // Cache TTL: 5 seconds

// SSE client active response streams
let sseClients = [];

// Helper to broadcast state changes to all listening SSE clients
function broadcastDeviceUpdate(deviceId, statusUpdate) {
  console.log(`[SSE] Broadcasting status update for device ${deviceId}:`, statusUpdate);
  const dataString = JSON.stringify({ deviceId, status: statusUpdate });
  sseClients.forEach(client => {
    client.write(`data: ${dataString}\n\n`);
  });
}

// Tuya Webhook event endpoint (public endpoint for Tuya developer platform notifications)
router.post('/webhook', express.json(), async (req, res) => {
  const { data: encryptedData } = req.body;
  if (!encryptedData) {
    return res.status(200).send('No data to process');
  }

  try {
    const key = process.env.TUYA_CLIENT_SECRET.substring(8, 24);
    const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    const payload = JSON.parse(decrypted);
    console.log('[Tuya Webhook] Decrypted payload:', payload);

    const deviceId = payload.devId;
    const statusArray = payload.status;

    if (deviceId && Array.isArray(statusArray)) {
      const flatStatus = {};
      statusArray.forEach(item => {
        flatStatus[item.code] = item.value;
      });

      // Update the device cache
      const cached = deviceCache.get(deviceId);
      if (cached) {
        cached.status = { ...cached.status, ...flatStatus };
        cached.timestamp = Date.now();
      } else {
        deviceCache.set(deviceId, {
          online: true,
          name: '智慧設備',
          status: flatStatus,
          timestamp: Date.now()
        });
      }

      // Broadcast update to all connected web clients
      broadcastDeviceUpdate(deviceId, flatStatus);
    }

    res.status(200).send('success');
  } catch (err) {
    console.error('[Tuya Webhook] Decryption error:', err.message);
    res.status(200).send('success'); // Always reply 200 OK to avoid clogging retries
  }
});

// SSE connection stream for admin dashboard live updates
router.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // initial ping to keep the stream alive
  res.write(':ok\n\n');

  sseClients.push(res);
  console.log(`[SSE] Client connected. Active clients: ${sseClients.length}`);

  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
    console.log(`[SSE] Client disconnected. Active clients: ${sseClients.length}`);
  });
});

// Tuya 智慧鎖連線測試診斷 API
router.get('/test-connection', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({ success: true, message: '成功連接 Tuya 雲端 API！', tokenPreview: `${token.substring(0, 10)}...` });
  } catch (err) {
    console.error('Tuya connection test failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 獲取據點內所有場地的設備運行狀況 (支援快取機制)
router.get('/devices-status', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { branch } = req.query;
  if (!branch) {
    return res.status(400).json({ success: false, error: '缺少據點名稱 (branch)' });
  }

  try {
    // 1. 取得該據點的所有場地與公共空間
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*')
      .eq('branch', branch)
      .order('id', { ascending: true });

    if (roomsError) throw roomsError;

    const { data: publicSpaces, error: publicSpacesError } = await supabase
      .from('public_spaces')
      .select('*')
      .eq('branch', branch)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });

    if (publicSpacesError) {
      console.error('Failed to fetch public spaces in tuya devices-status:', publicSpacesError.message);
    }

    // 2. 收集所有不為空的 Tuya 設備 ID (支援以逗號分隔多個 ID)
    const deviceIds = [];
    rooms.forEach(r => {
      if (r.tuya_device_id) {
        r.tuya_device_id.split(',').forEach(id => {
          const trimmed = id.trim();
          if (trimmed) deviceIds.push(trimmed);
        });
      }
      // ⚠️ 註解掉電燈與冷氣，避免佔用塗鴉配額與 Token (只管理門禁)
      /*
      if (r.tuya_light_id) {
        r.tuya_light_id.split(',').forEach(id => {
          const trimmed = id.trim();
          if (trimmed) deviceIds.push(trimmed);
        });
      }
      if (r.tuya_ac_id) {
        r.tuya_ac_id.split(',').forEach(id => {
          const trimmed = id.trim();
          if (trimmed) deviceIds.push(trimmed);
        });
      }
      */
    });

    // ⚠️ 註解掉公共空間電燈，避免佔用塗鴉配額與 Token (只管理門禁)
    /*
    if (publicSpaces) {
      publicSpaces.forEach(ps => {
        if (ps.tuya_light_id) {
          ps.tuya_light_id.split(',').forEach(id => {
            const trimmed = id.trim();
            if (trimmed) deviceIds.push(trimmed);
          });
        }
      });
    }
    */

    const uniqueDeviceIds = [...new Set(deviceIds)];
    const devicesMap = {};

    // 3. 篩選需要向 Tuya 雲端查詢的設備 ID (快取過期或未快取的)
    const now = Date.now();
    const idsToFetch = [];

    uniqueDeviceIds.forEach(id => {
      const cached = deviceCache.get(id);
      if (!cached || (now - cached.timestamp > CACHE_TTL)) {
        idsToFetch.push(id);
      }
    });

    // 4. 從快取中組裝完整的 devicesMap，對於即將向 Tuya 查詢的設備，標記為 updating: true
    uniqueDeviceIds.forEach(id => {
      let cached = deviceCache.get(id);
      if (!cached) {
        cached = {
          online: false,
          name: '智慧設備',
          status: {},
          timestamp: 0
        };
        deviceCache.set(id, cached);
      }
      
      const willFetch = idsToFetch.includes(id);
      devicesMap[id] = {
        online: cached.online,
        name: cached.name,
        status: { 
          ...cached.status,
          updating: willFetch
        }
      };
    });

    // 5. 立即將結果回傳給前端，讓載入秒開，完全不阻礙 HTTP 請求
    res.json({
      success: true,
      rooms,
      publicSpaces: publicSpaces || [],
      devices: devicesMap
    });

    // 6. 在背景非同步查詢過期的設備並透過 SSE 推播更新
    if (idsToFetch.length > 0) {
      (async () => {
        try {
          const deviceList = await getDeviceList(idsToFetch);
          const fetchTime = Date.now();
          
          const fetchedIds = new Set();
          deviceList.forEach(dev => {
            fetchedIds.add(dev.id);
            const flatStatus = {};
            if (Array.isArray(dev.status)) {
              dev.status.forEach(s => {
                flatStatus[s.code] = s.value;
              });
            }
            
            // 更新快取
            deviceCache.set(dev.id, {
              online: dev.online ?? false,
              name: dev.name || '智慧設備',
              status: flatStatus,
              timestamp: fetchTime
            });

            // 廣播給前端：解除 updating 並更新狀態
            broadcastDeviceUpdate(dev.id, {
              ...flatStatus,
              updating: false
            });
          });

          // 處理部分在 API 中未返回的設備
          idsToFetch.forEach(id => {
            if (!fetchedIds.has(id)) {
              deviceCache.set(id, {
                online: false,
                name: '未連線/未知設備',
                status: {},
                timestamp: fetchTime
              });

              broadcastDeviceUpdate(id, {
                updating: false
              });
            }
          });
        } catch (tuyaErr) {
          console.error('[Tuya API Background Fetch] Failed to batch fetch devices:', tuyaErr.message);
          // 發生錯誤時也廣播解除 updating，防止 UI 鎖死
          idsToFetch.forEach(id => {
            broadcastDeviceUpdate(id, {
              updating: false
            });
          });
        }
      })();
    }
  } catch (err) {
    console.error('Failed to get devices status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 下發控制指令到特定設備
router.post('/control', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { deviceId, commands } = req.body;
  if (!deviceId || !commands || !Array.isArray(commands)) {
    return res.status(400).json({ success: false, error: '缺少 deviceId 或 commands 陣列' });
  }

  try {
    // 檢查是否為門鎖開鎖指令
    const unlockCmd = commands.find(c => c.code === 'unlock');
    let result;
    if (unlockCmd) {
      const { remoteUnlockDevice } = require('../tuyaClient');
      result = await remoteUnlockDevice(deviceId);
    } else {
      result = await sendDeviceCommands(deviceId, commands);
    }

    // 成功下發指令後，立即更新本地快取
    const cached = deviceCache.get(deviceId);
    const flatStatus = {};
    commands.forEach(cmd => {
      flatStatus[cmd.code] = cmd.value;
    });

    if (cached) {
      cached.status = { ...cached.status, ...flatStatus };
      cached.timestamp = Date.now(); // 刷新快取時間
    } else {
      deviceCache.set(deviceId, {
        online: true,
        name: '智慧設備',
        status: flatStatus,
        timestamp: Date.now()
      });
    }

    // 立即向所有 SSE 客戶端廣播本次狀態變更
    broadcastDeviceUpdate(deviceId, flatStatus);

    res.json({ success: true, message: '指令下發成功', result });
  } catch (err) {
    console.error(`Failed to control device ${deviceId}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

