/**
 * PUT /api/bookings/:id（使用者編輯自己的預約）與取消的整合測試（mock 掉 Supabase、門鎖、違規紀錄）。
 */

jest.mock('../database', () => {
  const mockState = {
    booking: null,
    rooms: [],
    conflicts: [],
    updated: null,
  };

  function makeQuery(table) {
    const q = {
      _op: 'select',
      _payload: undefined,
      _inIds: null,
      select() { return q; },
      eq() { return q; },
      neq() { return q; },
      in(column, values) {
        if (column === 'id') q._inIds = values.map(Number);
        return q;
      },
      lt() { return q; },
      gt() { return q; },
      update(payload) {
        q._op = 'update';
        q._payload = payload;
        return q;
      },
      single() {
        return Promise.resolve({ data: mockState.booking, error: mockState.booking ? null : { message: 'not found' } });
      },
      then(resolve, reject) {
        let result;
        if (table === 'rooms') {
          const rooms = q._inIds ? mockState.rooms.filter(r => q._inIds.includes(r.id)) : mockState.rooms;
          result = { data: rooms, error: null };
        } else if (table === 'bookings' && q._op === 'update') {
          mockState.updated = q._payload;
          result = { data: [{ ...mockState.booking, ...q._payload }], error: null };
        } else if (table === 'bookings') {
          result = { data: mockState.conflicts, error: null };
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

const DEFAULT_USER = { id: 'u1', email: 'me@test', role: 'user', branch: null };
let mockCurrentUser = DEFAULT_USER;

jest.mock('../authMiddleware', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { ...mockCurrentUser };
    next();
  },
  optionalAuthMiddleware: (req, res, next) => next(),
  requireRole: () => (req, res, next) => next(),
}));

jest.mock('../tuyaClient', () => ({
  syncLockPasscode: jest.fn(),
  deleteLockPasscode: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../mailService', () => ({
  sendBookingConfirmation: jest.fn(),
  sendRoomPassword: jest.fn(),
}));

jest.mock('../violationsStore', () => ({
  logChangeViolation: jest.fn().mockResolvedValue(undefined),
  logCancellationViolation: jest.fn().mockResolvedValue(undefined),
  isPastoralZoneSuspended: jest.fn().mockResolvedValue(false),
}));

const express = require('express');
const request = require('supertest');
const { __state: state } = require('../database');
const { deleteLockPasscode } = require('../tuyaClient');
const { logChangeViolation, isPastoralZoneSuspended } = require('../violationsStore');
const bookingsRouter = require('../routes/bookings');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/bookings', bookingsRouter);
  return app;
}

const APPROVED_BOOKING = {
  id: 5,
  room_id: 1,
  user_email: 'me@test',
  full_name: '王小明',
  phone: '0912345678',
  pastoral_zone: '大安6區',
  purpose: '小組聚會',
  booking_type: '一般借用',
  attendance_count: 10,
  booking_date: '2026-11-04',
  start_time: '19:00:00',
  end_time: '21:00:00',
  is_returned: false,
  status: 'approved',
  access_code: '1234',
  tuya_password_id: 'pw-1',
  rooms: { name: 'B2-第五教室', branch: '仁愛堂', tuya_device_id: 'dev-1' },
};

const put = (body) => request(makeApp()).put('/api/bookings/5').send(body);

beforeAll(() => {
  // 只固定 Date（2026-10-16，週五），計時器維持真實以免影響 supertest
  jest.useFakeTimers({
    now: new Date(2026, 9, 16, 10, 0, 0),
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout',
      'setInterval', 'clearInterval', 'queueMicrotask', 'hrtime', 'performance'],
  });
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentUser = DEFAULT_USER;
  state.booking = { ...APPROVED_BOOKING, rooms: { ...APPROVED_BOOKING.rooms } };
  state.rooms = [
    { id: 1, name: 'B2-第五教室', branch: '仁愛堂', parent_room_id: null },
    { id: 2, name: 'B2-第六教室', branch: '仁愛堂', parent_room_id: null },
  ];
  state.conflicts = [];
  state.updated = null;
});

describe('PUT /api/bookings/:id', () => {
  test('已核准的預約改日期 → 退回待審核、清門鎖密碼、記變更違規', async () => {
    const res = await put({ date: '2026-11-05' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('預約已修改，將重新送交審核');
    expect(state.updated).toMatchObject({
      booking_date: '2026-11-05',
      start_time: '19:00',
      end_time: '21:00',
      status: 'pending',
      access_code: null,
      tuya_password_id: null,
    });
    expect(logChangeViolation).toHaveBeenCalledTimes(1);
    expect(deleteLockPasscode).toHaveBeenCalledWith('dev-1', 'pw-1');
  });

  test('已核准的預約只改用途與人數 → 維持已核准、不記點', async () => {
    const res = await put({ purpose: '禱告會', attendanceCount: 12 });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('預約已修改');
    expect(state.updated).toMatchObject({ purpose: '禱告會', attendance_count: 12 });
    expect(state.updated).not.toHaveProperty('status');
    expect(logChangeViolation).not.toHaveBeenCalled();
    expect(deleteLockPasscode).not.toHaveBeenCalled();
  });

  test('待審核的預約改場地 → 維持待審核、不記點', async () => {
    state.booking.status = 'pending';
    state.booking.access_code = null;
    state.booking.tuya_password_id = null;

    const res = await put({ roomId: 2 });

    expect(res.status).toBe(200);
    expect(state.updated).toMatchObject({ room_id: 2 });
    expect(state.updated).not.toHaveProperty('status');
    expect(logChangeViolation).not.toHaveBeenCalled();
  });

  test('同月份內調整不檢查停權，換到別的月份才檢查', async () => {
    await put({ date: '2026-11-05' });
    expect(isPastoralZoneSuspended).not.toHaveBeenCalled();

    state.booking.booking_date = '2026-10-28';
    await put({ date: '2026-11-05' });
    expect(isPastoralZoneSuspended).toHaveBeenCalledWith('大安6區', '2026-11-05');
  });

  test('借用日 7 天內 → 400，不寫入', async () => {
    state.booking.booking_date = '2026-10-20';

    const res = await put({ purpose: '改用途' });

    expect(res.status).toBe(400);
    expect(state.updated).toBeNull();
  });

  test('改到 7 天內的日期 → 400', async () => {
    const res = await put({ date: '2026-10-21' });

    expect(res.status).toBe(400);
    expect(state.updated).toBeNull();
  });

  test('與其他預約衝突 → 409', async () => {
    state.conflicts = [{
      id: 7, room_id: 1, booking_date: '2026-11-05', start_time: '18:00:00', end_time: '20:00:00',
      full_name: '別人', rooms: { name: 'B2-第五教室' },
    }];

    const res = await put({ date: '2026-11-05' });

    expect(res.status).toBe(409);
    expect(state.updated).toBeNull();
  });

  test('換到其他據點的場地 → 400', async () => {
    state.rooms.push({ id: 3, name: '士林會堂', branch: '士林堂', parent_room_id: null });

    const res = await put({ roomId: 3, date: '2026-11-07', startTime: '10:00', endTime: '12:00' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('只能更換為同一據點的場地');
    expect(state.updated).toBeNull();
  });

  test('已取消的預約 → 400', async () => {
    state.booking.status = 'rejected';

    const res = await put({ purpose: '改用途' });

    expect(res.status).toBe(400);
    expect(state.updated).toBeNull();
  });

  test('表單匯入的「取消或異動」申請 → 400', async () => {
    state.booking.booking_type = '取消或異動';

    const res = await put({ purpose: '改用途' });

    expect(res.status).toBe(400);
    expect(state.updated).toBeNull();
  });

  test('不是自己的預約 → 404', async () => {
    state.booking = null;

    const res = await put({ purpose: '改用途' });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/bookings/:id/cancel', () => {
  test('使用者取消自己的預約 → 標記為自行取消', async () => {
    const res = await request(makeApp()).post('/api/bookings/5/cancel');

    expect(res.status).toBe(200);
    expect(state.updated).toMatchObject({
      status: 'rejected',
      access_code: null,
      tuya_password_id: null,
      rejection_reason: '使用者自行取消',
    });
  });

  const cancelAs = (user) => {
    mockCurrentUser = { id: 'u2', email: 'staff@test', ...user };
    return request(makeApp()).post('/api/bookings/5/cancel');
  };

  test('查察員取消他人的預約 → 404，不寫入', async () => {
    const res = await cancelAs({ role: 'inspector', branch: '仁愛堂' });

    expect(res.status).toBe(404);
    expect(state.updated).toBeNull();
  });

  test('其他據點的管理員取消 → 404，不寫入', async () => {
    const res = await cancelAs({ role: 'admin', branch: '士林堂' });

    expect(res.status).toBe(404);
    expect(state.updated).toBeNull();
  });

  test('同據點的管理員取消 → 記為管理員取消', async () => {
    const res = await cancelAs({ role: 'admin', branch: '仁愛堂' });

    expect(res.status).toBe(200);
    expect(state.updated).toMatchObject({ status: 'rejected', rejection_reason: '管理員取消' });
  });

  test('全據點的管理員取消 → 可以', async () => {
    const res = await cancelAs({ role: 'admin', branch: '全' });

    expect(res.status).toBe(200);
  });

  test('系統管理員取消 → 可以', async () => {
    const res = await cancelAs({ role: 'system_admin', branch: null });

    expect(res.status).toBe(200);
  });

  test('一般使用者取消他人的預約 → 404', async () => {
    const res = await cancelAs({ role: 'user', branch: null });

    expect(res.status).toBe(404);
    expect(state.updated).toBeNull();
  });

  test('查察員取消自己的預約 → 可以', async () => {
    state.booking.user_email = 'staff@test';

    const res = await cancelAs({ role: 'inspector', branch: '仁愛堂' });

    expect(res.status).toBe(200);
    expect(state.updated).toMatchObject({ rejection_reason: '使用者自行取消' });
  });
});
