/**
 * routes/intake.js 的整合測試（mock 掉 Supabase）。
 */

jest.mock('../database', () => {
  const mockState = {
    existingLog: null,
    rooms: [
      { id: 1, name: 'B2-第五教室', branch: '仁愛堂' },
      { id: 2, name: 'B1-互動區第4區塊', branch: '仁愛堂' },
      { id: 9, name: '💒 由教會分配', branch: '仁愛堂' },
    ],
    insertedBookings: [],
    insertedLogs: [],
    nextBookingId: 100,
    logInsertError: null,
  };

  function makeQuery(table) {
    const q = {
      _table: table,
      _op: undefined,
      _payload: undefined,
      select() {
        return q;
      },
      eq() {
        return q;
      },
      insert(payload) {
        q._payload = payload;
        q._op = 'insert';
        return q;
      },
      maybeSingle() {
        if (table === 'form_intake_log') {
          return Promise.resolve({ data: mockState.existingLog, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      single() {
        if (table === 'bookings' && q._op === 'insert') {
          const id = mockState.nextBookingId++;
          mockState.insertedBookings.push({ id, ...q._payload });
          return Promise.resolve({ data: { id }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then(resolve, reject) {
        let result;
        if (table === 'rooms') {
          result = { data: mockState.rooms, error: null };
        } else if (table === 'form_intake_log' && q._op === 'insert') {
          mockState.insertedLogs.push(q._payload);
          result = { data: null, error: mockState.logInsertError };
        } else {
          result = { data: null, error: null };
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return q;
  }

  return {
    supabase: { from: (table) => makeQuery(table) },
    initDb: jest.fn(),
    __state: mockState,
  };
});

process.env.FORM_INTAKE_SECRET = 'test-secret-value';
process.env.FORM_INTAKE_EMAIL = 'form-intake@test';

const express = require('express');
const request = require('supertest');
const { __state: state } = require('../database');
const intakeRouter = require('../routes/intake');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/intake', intakeRouter);
  return app;
}

beforeEach(() => {
  state.existingLog = null;
  state.insertedBookings.length = 0;
  state.insertedLogs.length = 0;
  state.nextBookingId = 100;
  state.logInsertError = null;
});

const BASE_PAYLOAD = {
  formResponseId: 'resp-1',
  type: '一般借用',
  borrower: { pastoralZone: '大安6區', name: '王小明', phone: '0912345678' },
  general: {
    month: '九月份',
    weeks: [
      {
        label: '九-3(9/14-9/20) -借士林堂請在位置寫士林',
        text: '週日/1500-1730/小組聚會/30/B1-4\n週三 1930-2130 禱告會 12 五教',
      },
    ],
  },
};

const withSecret = (r) => r.set('X-Intake-Secret', 'test-secret-value');

describe('POST /api/intake/form', () => {
  test('缺密鑰 → 401', async () => {
    const res = await request(makeApp()).post('/api/intake/form').send(BASE_PAYLOAD);
    expect(res.status).toBe(401);
    expect(state.insertedBookings).toHaveLength(0);
  });

  test('密鑰錯 → 401', async () => {
    const res = await withSecret(request(makeApp()).post('/api/intake/form'))
      .set('X-Intake-Secret', 'wrong')
      .send(BASE_PAYLOAD);
    expect(res.status).toBe(401);
  });

  test('缺 formResponseId → 400', async () => {
    const res = await withSecret(request(makeApp()).post('/api/intake/form')).send({
      ...BASE_PAYLOAD,
      formResponseId: undefined,
    });
    expect(res.status).toBe(400);
  });

  test('正常提交 → 寫入 pending bookings + 稽核紀錄', async () => {
    const res = await withSecret(request(makeApp()).post('/api/intake/form')).send(BASE_PAYLOAD);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.duplicate).toBe(false);
    expect(res.body.created).toHaveLength(2);

    expect(state.insertedBookings).toHaveLength(2);
    for (const b of state.insertedBookings) {
      expect(b.status).toBe('pending');
      expect(b.user_email).toBe('form-intake@test');
      expect(b.full_name).toBe('王小明');
      expect(b.pastoral_zone).toBe('大安6區');
    }
    expect(state.insertedLogs).toHaveLength(1);
    expect(state.insertedLogs[0].form_response_id).toBe('resp-1');
    expect(state.insertedLogs[0].created_booking_ids).toHaveLength(2);
  });

  test('對不到場地 → 落虛擬場地 + needsReview 回報', async () => {
    const payload = {
      ...BASE_PAYLOAD,
      formResponseId: 'resp-2',
      general: {
        month: '九月份',
        weeks: [{ label: '九-3(9/14-9/20)', text: '週日/1500-1730/長輩小組/8/不存在的場地X' }],
      },
    };
    const res = await withSecret(request(makeApp()).post('/api/intake/form')).send(payload);

    expect(res.status).toBe(200);
    expect(res.body.created).toHaveLength(1);
    expect(res.body.needsReview).toHaveLength(1);
    expect(state.insertedBookings[0].room_id).toBe(9);
  });

  test('重送（form_intake_log 已存在）→ duplicate:true，不再寫 booking', async () => {
    state.existingLog = {
      form_response_id: 'resp-1',
      created_booking_ids: [55, 56],
      needs_review: [],
      skipped: [],
    };
    const res = await withSecret(request(makeApp()).post('/api/intake/form')).send(BASE_PAYLOAD);

    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
    expect(res.body.created).toEqual([55, 56]);
    expect(state.insertedBookings).toHaveLength(0);
  });
});
