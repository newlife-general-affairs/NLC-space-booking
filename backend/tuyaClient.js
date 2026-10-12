const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

// ============================================================
// TUYA_ENABLED=false → 跳過所有 Tuya 連線，回傳 stub 資料
// ============================================================
const TUYA_ENABLED = process.env.TUYA_ENABLED !== 'false';

const CLIENT_ID = process.env.TUYA_CLIENT_ID;
const CLIENT_SECRET = process.env.TUYA_CLIENT_SECRET;
const BASE_URL = process.env.TUYA_BASE_URL || 'https://openapi.tuyacn.com';

// Cache for access token in memory
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Generates signature for Tuya Open API
 */
function generateSignature(clientId, secret, t, nonce, stringToSign, accessToken = '') {
  const signStr = accessToken 
    ? `${clientId}${accessToken}${t}${nonce}${stringToSign}`
    : `${clientId}${t}${nonce}${stringToSign}`;

  return crypto
    .createHmac('sha256', secret)
    .update(signStr)
    .digest('hex')
    .toUpperCase();
}

/**
 * Fetches Access Token from Tuya Cloud API
 */
async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing TUYA_CLIENT_ID or CLIENT_SECRET in environment variables');
  }

  const t = now.toString();
  const method = 'GET';
  const url = '/v1.0/token?grant_type=1';
  const nonce = '';
  
  // SHA256 of empty body
  const bodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const stringToSign = `${method}\n${bodyHash}\n\n${url}`;
  const sign = generateSignature(CLIENT_ID, CLIENT_SECRET, t, nonce, stringToSign);

  console.log(`[Tuya] Fetching access token from ${BASE_URL}...`);
  const response = await fetch(`${BASE_URL}${url}`, {
    method: 'GET',
    headers: {
      'client_id': CLIENT_ID,
      'sign': sign,
      't': t,
      'sign_method': 'HMAC-SHA256',
      'nonce': nonce
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch access token: ${response.status} ${errText}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(`Tuya authentication failed: ${data.msg} (code: ${data.code})`);
  }

  cachedToken = data.result.access_token;
  tokenExpiresAt = now + (data.result.expire_time * 1000);
  console.log(`[Tuya] Access token fetched successfully. Expires in ${data.result.expire_time}s`);
  return cachedToken;
}

/**
 * Dispatches a signed API request to Tuya Cloud
 */
async function makeRequest(method, urlPath, body = null) {
  const accessToken = await getAccessToken();
  const t = Date.now().toString();
  const nonce = '';

  const bodyStr = body ? JSON.stringify(body) : '';
  const bodyHash = crypto.createHash('sha256').update(bodyStr).digest('hex');

  const stringToSign = `${method.toUpperCase()}\n${bodyHash}\n\n${urlPath}`;
  const sign = generateSignature(CLIENT_ID, CLIENT_SECRET, t, nonce, stringToSign, accessToken);

  const headers = {
    'client_id': CLIENT_ID,
    'access_token': accessToken,
    'sign': sign,
    't': t,
    'sign_method': 'HMAC-SHA256',
    'nonce': nonce,
    'Content-Type': 'application/json'
  };

  const options = {
    method: method.toUpperCase(),
    headers
  };
  if (body) {
    options.body = bodyStr;
  }

  console.log(`[Tuya API] Sending ${method} request to ${urlPath}`);
  const response = await fetch(`${BASE_URL}${urlPath}`, options);
  
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Tuya API request failed: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Decrypts the ticket_key received from Tuya using the Client Secret (32 bytes for AES-256-ECB)
 */
function decryptTicketKey(ticketKeyHex) {
  const key = Buffer.from(CLIENT_SECRET, 'utf8');
  
  const decipher = crypto.createDecipheriv('aes-256-ecb', key, null);
  decipher.setAutoPadding(true);
  
  const ciphertext = Buffer.from(ticketKeyHex, 'hex');
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);
  
  return decrypted; // raw Buffer
}

/**
 * Encrypts the raw passcode using the decrypted ticket key Buffer
 */
function encryptPassword(rawPassword, decryptedKeyBuffer) {
  const cipher = crypto.createCipheriv('aes-128-ecb', decryptedKeyBuffer, null);
  cipher.setAutoPadding(true);
  
  let encrypted = cipher.update(rawPassword, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return encrypted.toUpperCase();
}

/**
 * Creates a temporary password on the smart lock
 * @param {string} deviceId - Tuya device ID of the lock
 * @param {string} name - Display name for the passcode (e.g. Booking #12)
 * @param {string} pinCode - 6-digit numeric passcode
 * @param {number} startTimeUnix - Start time Unix timestamp (seconds)
 * @param {number} endTimeUnix - End time Unix timestamp (seconds)
 * @returns {Promise<string>} Created password ID
 */
async function syncLockPasscode(deviceId, name, pinCode, startTimeUnix, endTimeUnix) {
  console.log(`[Tuya Lock] Syncing passcode '${name}' to device ${deviceId}...`);
  
  // 1. Get password ticket
  const ticketRes = await makeRequest('POST', `/v1.0/devices/${deviceId}/door-lock/password-ticket`);
  if (!ticketRes.success) {
    throw new Error(`Get password ticket failed: ${ticketRes.msg} (code: ${ticketRes.code})`);
  }
  
  const { ticket_id, ticket_key } = ticketRes.result || {};
  if (!ticket_id || !ticket_key) {
    throw new Error('未取得有效的 ticket_id 或 ticket_key。請確認該門鎖目前在線（非離線），且已在 Smart Life / 塗鴉 App 設定中開啟「遠端開鎖」與「密碼管理」功能。');
  }

  // 2. Decrypt ticket key using CLIENT_SECRET
  const decryptedKeyBuffer = decryptTicketKey(ticket_key);

  // 3. Encrypt PIN code
  const encryptedPin = encryptPassword(pinCode, decryptedKeyBuffer);

  // 4. Create temporary password
  const createRes = await makeRequest('POST', `/v1.0/devices/${deviceId}/door-lock/temp-password`, {
    name: name,
    password: encryptedPin,
    effective_time: startTimeUnix,
    invalid_time: endTimeUnix,
    password_type: 'ticket',
    ticket_id: ticket_id,
    type: 0 // Multi-use within the time range
  });

  if (!createRes.success) {
    throw new Error(`Create temporary password failed: ${createRes.msg} (code: ${createRes.code})`);
  }

  const pwdId = createRes.result.pwd_id || createRes.result.id;
  console.log(`[Tuya Lock] Passcode synced successfully. Lock Passcode ID: ${pwdId}`);
  return pwdId;
}

/**
 * Deletes a temporary password from the smart lock
 * @param {string} deviceId - Tuya device ID of the lock
 * @param {string} passwordId - The password ID (pwd_id) to delete
 */
async function deleteLockPasscode(deviceId, passwordId) {
  console.log(`[Tuya Lock] Deleting passcode ID ${passwordId} from device ${deviceId}...`);
  const res = await makeRequest('DELETE', `/v1.0/devices/${deviceId}/door-lock/temp-passwords/${passwordId}`);
  if (!res.success) {
    throw new Error(`Delete temporary password failed: ${res.msg} (code: ${res.code})`);
  }
  console.log(`[Tuya Lock] Passcode ID ${passwordId} deleted successfully.`);
  return true;
}

/**
 * Sends commands to control any Tuya device
 * @param {string} deviceId - Tuya device ID
 * @param {Array<{code: string, value: any}>} commands - Tuya device command array
 */
async function sendDeviceCommands(deviceId, commands) {
  console.log(`[Tuya Device] Sending commands to device ${deviceId}...`, commands);
  const res = await makeRequest('POST', `/v1.0/devices/${deviceId}/commands`, { commands });
  if (!res.success) {
    throw new Error(`Failed to send Tuya command: ${res.msg} (code: ${res.code})`);
  }
  return res.result;
}

/**
 * Fetches batch device details including online status and status code list
 * @param {Array<string>} deviceIds - Array of Tuya device IDs
 * @returns {Promise<Array<object>>} List of device details
 */
async function getDeviceList(deviceIds) {
  if (!deviceIds || deviceIds.length === 0) return [];
  const idsStr = deviceIds.join(',');
  console.log(`[Tuya Device] Batch fetching details for: ${idsStr}`);
  const res = await makeRequest('GET', `/v1.0/devices?device_ids=${idsStr}`);
  if (!res.success) {
    throw new Error(`Failed to batch fetch devices: ${res.msg} (code: ${res.code})`);
  }
  // Tuya API result may contain the list directly, or under devices/list property
  return res.result?.devices || res.result?.list || (Array.isArray(res.result) ? res.result : []);
}

/**
 * Remotely unlocks a smart lock using the password-free ticket flow
 * @param {string} deviceId - Tuya device ID of the lock
 * @returns {Promise<boolean>}
 */
async function remoteUnlockDevice(deviceId) {
  console.log(`[Tuya Lock] Requesting password ticket for remote unlock on device ${deviceId}...`);
  const ticketRes = await makeRequest('POST', `/v1.0/devices/${deviceId}/door-lock/password-ticket`);
  if (!ticketRes.success) {
    throw new Error(`Get password ticket failed: ${ticketRes.msg} (code: ${ticketRes.code})`);
  }
  
  const { ticket_id } = ticketRes.result || {};
  if (!ticket_id) {
    throw new Error('未取得有效的 ticket_id。請確認該門鎖目前在線（非離線），且已在 Smart Life / 塗鴉 App 設定中開啟「遠端開鎖」功能。');
  }

  console.log(`[Tuya Lock] Triggering password-free remote unlock on device ${deviceId}...`);
  const unlockRes = await makeRequest('POST', `/v1.0/devices/${deviceId}/door-lock/password-free/open-door`, { ticket_id });
  if (!unlockRes.success) {
    throw new Error(`Remote unlock failed: ${unlockRes.msg} (code: ${unlockRes.code})`);
  }
  return unlockRes.result;
}

// ============================================================
// Stub wrappers：TUYA_ENABLED=false 時直接回傳，不呼叫真實 API
// ============================================================
module.exports = {
  getAccessToken: TUYA_ENABLED
    ? getAccessToken
    : async () => { console.warn('[Tuya] TUYA_ENABLED=false，跳過 getAccessToken'); return 'STUB_TOKEN'; },

  syncLockPasscode: TUYA_ENABLED
    ? syncLockPasscode
    : async (deviceId, name) => { console.warn(`[Tuya] TUYA_ENABLED=false，跳過 syncLockPasscode (${name})`); return null; },

  deleteLockPasscode: TUYA_ENABLED
    ? deleteLockPasscode
    : async (deviceId, passwordId) => { console.warn(`[Tuya] TUYA_ENABLED=false，跳過 deleteLockPasscode (${passwordId})`); return true; },

  sendDeviceCommands: TUYA_ENABLED
    ? sendDeviceCommands
    : async (deviceId, commands) => { console.warn(`[Tuya] TUYA_ENABLED=false，跳過 sendDeviceCommands`); return true; },

  getDeviceList: TUYA_ENABLED
    ? getDeviceList
    : async () => { console.warn('[Tuya] TUYA_ENABLED=false，跳過 getDeviceList'); return []; },

  remoteUnlockDevice: TUYA_ENABLED
    ? remoteUnlockDevice
    : async (deviceId) => { console.warn(`[Tuya] TUYA_ENABLED=false，跳過 remoteUnlockDevice (${deviceId})`); return true; },
};

