/**
 * 場地借用 Google 表單 → App 自動匯入
 * ────────────────────────────────────────────────────────────
 * 安裝步驟：
 *  1. 打開「表單回應」的 Google 試算表 → 擴充功能 → Apps Script。
 *  2. 把本檔內容整段貼上，存檔。
 *  3. 專案設定 → 指令碼屬性 → 新增：
 *        INTAKE_SECRET = <與後端 env FORM_INTAKE_SECRET 相同的長隨機字串>
 *  4. 修改下方 ENDPOINT 為你的正式網域（Vercel 專案網域）。
 *  5. 觸發器（左側鬧鐘圖示）→ 新增觸發器：
 *        函式 onFormSubmit / 事件來源「來自試算表」/ 事件類型「表單提交時」。
 *        （一定要用這個「安裝式」觸發器，簡易觸發器不能用 UrlFetchApp / MailApp）
 *  6. 第一次會跳授權，同意即可。
 *
 * 之後表單每被送出一次，就會 POST 一包 JSON 到 App；
 * 有需人工確認 / 無法解析的項目，或 App 回非 2xx，會寄信到 NOTIFY_EMAIL。
 *
 * ⚠️ 若表單「題目文字」有改，請同步更新 buildPayload() 裡的對應字串。
 */

const ENDPOINT = 'https://<你的-vercel-網域>/api/intake/form';
const NOTIFY_EMAIL = 'a0970927705@gmail.com';
const SECRET = PropertiesService.getScriptProperties().getProperty('INTAKE_SECRET');

function onFormSubmit(e) {
  var payload = buildPayload(e);
  try {
    var res = UrlFetchApp.fetch(ENDPOINT, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'X-Intake-Secret': SECRET },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    var code = res.getResponseCode();
    var body = res.getContentText();

    if (code < 200 || code >= 300) {
      notify('匯入失敗 HTTP ' + code, body + '\n\n' + JSON.stringify(payload, null, 2));
      return;
    }
    var data = JSON.parse(body);
    var hasIssue =
      (data.needsReview && data.needsReview.length) || (data.skipped && data.skipped.length);
    if (hasIssue) {
      notify(
        '匯入完成，但有項目需人工確認',
        JSON.stringify(
          {
            borrower: payload.borrower,
            created: data.created,
            needsReview: data.needsReview,
            skipped: data.skipped,
          },
          null,
          2
        )
      );
    }
  } catch (err) {
    notify('匯入例外：' + err, JSON.stringify(payload, null, 2));
  }
}

/**
 * 把這次提交的答案整理成 App 的 payload。
 * 只做「題目 → 欄位」對應，不解析內容（解析在後端）。
 */
function buildPayload(e) {
  var byTitle = {};
  var weeks = [];
  e.response.getItemResponses().forEach(function (ir) {
    var title = ir.getItem().getTitle().trim();
    var value = ir.getResponse();
    byTitle[title] = value;
    // 週欄位：標題像「八-1(8/3-8/9) …」「九-3(9/14-9/20) …」
    if (/^[八九][-－—]\s*\d/.test(title)) {
      weeks.push({ label: title, text: value || '' });
    }
  });

  function t(title) {
    return (byTitle[title] == null ? '' : String(byTitle[title]));
  }
  // 婚禮時段欄位的完整標題很長，用「開頭比對」取值
  function tStartsWith(prefix) {
    for (var k in byTitle) {
      if (k.indexOf(prefix) === 0) return String(byTitle[k] || '');
    }
    return '';
  }

  return {
    formResponseId: e.response.getId(),
    submittedAt: e.response.getTimestamp().toISOString(),
    borrower: {
      pastoralZone: t('牧區'),
      name: t('姓名'),
      phone: t('連絡電話'),
    },
    type: t('場地借用類型'),
    general: {
      month: t('一般場地借用(借士林堂請在位置寫士林)'),
      weeks: weeks,
    },
    wedding: {
      eventName: t('婚禮＆活動名稱'),
      content: t('借用內容'),
      date: normalizeDate(t('借用日期')),
      slotsText: tStartsWith('婚禮時間＆其他場地/時間'),
    },
    changeReq: {
      mode: t('取消or更新'),
      cancelRoom: t('場地取消'),
      cancelReason: t('取消原因'),
      updateInfo: t('更新資料(人數.日期.時間)'),
      updateReason: t('更新原因'),
    },
  };
}

/** Google 表單日期題常見回傳 'yyyy-mm-dd'；保險起見再正規化一次 */
function normalizeDate(v) {
  if (!v) return '';
  var s = String(v).trim();
  var m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!m) return s;
  return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
}

function notify(subject, body) {
  try {
    MailApp.sendEmail(NOTIFY_EMAIL, '[場地表單匯入] ' + subject, body);
  } catch (err) {
    Logger.log('notify failed: ' + err);
  }
}
