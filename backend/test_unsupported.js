const { getAccessToken } = require('./tuyaClient');
const crypto = require('crypto');

async function makeRequest(method, urlPath, body = null) {
  const CLIENT_ID = process.env.TUYA_CLIENT_ID;
  const CLIENT_SECRET = process.env.TUYA_CLIENT_SECRET;
  const BASE_URL = process.env.TUYA_BASE_URL || 'https://openapi.tuyacn.com';
  
  const accessToken = await getAccessToken();
  const t = Date.now().toString();
  const nonce = '';

  const bodyStr = body ? JSON.stringify(body) : '';
  const bodyHash = crypto.createHash('sha256').update(bodyStr).digest('hex');

  const stringToSign = `${method.toUpperCase()}\n${bodyHash}\n\n${urlPath}`;
  const signStr = `${CLIENT_ID}${accessToken}${t}${nonce}${stringToSign}`;
  const sign = crypto.createHmac('sha256', CLIENT_SECRET).update(signStr).digest('hex').toUpperCase();

  const headers = {
    'client_id': CLIENT_ID,
    'access_token': accessToken,
    'sign': sign,
    't': t,
    'sign_method': 'HMAC-SHA256',
    'nonce': nonce,
    'Content-Type': 'application/json'
  };

  const response = await fetch(`${BASE_URL}${urlPath}`, {
    method: method.toUpperCase(),
    headers,
    body: body ? bodyStr : undefined
  });
  
  return await response.json();
}

async function testUnsupported() {
  const lockId = 'a3e1f66xgo76vpw6'; // B2-第三教室 lock (Online)
  try {
    console.log('--- Sending unsupported unlock command via standard API ---');
    const res = await makeRequest('POST', `/v1.0/devices/${lockId}/commands`, {
      commands: [{ code: 'unlock', value: true }]
    });
    console.log('Response:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

testUnsupported();
