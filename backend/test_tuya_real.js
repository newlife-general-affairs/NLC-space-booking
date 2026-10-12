const { getAccessToken } = require('./tuyaClient');
const crypto = require('crypto');
const CLIENT_ID = process.env.TUYA_CLIENT_ID;
const CLIENT_SECRET = process.env.TUYA_CLIENT_SECRET;
const BASE_URL = process.env.TUYA_BASE_URL || 'https://openapi.tuyacn.com';

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

async function testMakeRequest(method, urlPath, body = null) {
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

  const response = await fetch(`${BASE_URL}${urlPath}`, {
    method: method.toUpperCase(),
    headers,
    body: body ? bodyStr : undefined
  });
  
  return await response.json();
}

async function main() {
  try {
    const devId = 'a31262dozvngmy7k';
    console.log(`=== Testing password-free open-door with { ticket_id: "" } on device: ${devId} ===`);
    
    const res = await testMakeRequest('POST', `/v1.0/devices/${devId}/door-lock/password-free/open-door`, { ticket_id: "" });
    console.log('Result:', JSON.stringify(res, null, 2));

  } catch (e) {
    console.error('Error:', e);
  }
}

main();
