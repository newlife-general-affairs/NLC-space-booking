const TimingPolicyBlock = require('../blocks/TimingPolicyBlock');
const BookingError = require('../blocks/BookingError');
const { supabase } = require('../database');

jest.mock('../database', () => {
  const mockSingle = jest.fn();
  const mockInsert = jest.fn();
  const mockSelect = jest.fn();
  const mockIn = jest.fn();
  const mockEq = jest.fn();
  const mockNeq = jest.fn();

  const chain = {
    select: mockSelect,
    in: mockIn,
    eq: mockEq,
    neq: mockNeq,
    single: mockSingle,
    insert: mockInsert,
  };

  mockSelect.mockReturnValue(chain);
  mockIn.mockReturnValue(chain);
  mockEq.mockReturnValue(chain);
  mockNeq.mockReturnValue(chain);
  mockSingle.mockReturnValue(chain);
  mockInsert.mockReturnValue(chain);

  return {
    supabase: {
      from: jest.fn(() => chain),
    },
  };
});

describe('TimingPolicyBlock', () => {
  let block;

  beforeEach(() => {
    block = new TimingPolicyBlock();
    jest.clearAllMocks();
  });

  const getFutureDate = (daysAhead) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
  };

  it('should throw an error if slot times are not in 15-minute increments', async () => {
    const context = {
      slots: [{ date: getFutureDate(10), startTime: '10:05', endTime: '11:00' }],
      user: { role: 'user' },
      cleanFields: { bookingType: '一般借用' },
      roomsToBook: [{ roomId: 1 }]
    };

    await expect(block.execute(context)).rejects.toThrow(/必須以 15 分鐘為單位/);
  });

  it('should throw an error if the room does not exist in DB', async () => {
    // Mock empty response
    supabase.from().select().in.mockResolvedValue({ data: [], error: null });

    const context = {
      slots: [{ date: getFutureDate(10), startTime: '10:00', endTime: '11:00' }],
      user: { role: 'user' },
      cleanFields: { bookingType: '一般借用' },
      roomsToBook: [{ roomId: 999 }]
    };

    await expect(block.execute(context)).rejects.toThrow('找不到指定的場地');
  });

  it('should throw an error if booking is in the past', async () => {
    supabase.from().select().in.mockResolvedValue({
      data: [{ id: 1, name: 'Room A', branch: '仁愛堂' }],
      error: null
    });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });

    const context = {
      slots: [{ date: yesterdayStr, startTime: '10:00', endTime: '11:00' }],
      user: { role: 'admin' },
      cleanFields: { bookingType: '一般借用' },
      roomsToBook: [{ roomId: 1 }]
    };

    await expect(block.execute(context)).rejects.toThrow(/無法預約過去的日期/);
  });

  it('should enforce 7-day advance booking rule for regular users', async () => {
    supabase.from().select().in.mockResolvedValue({
      data: [{ id: 1, name: 'Room A', branch: '仁愛堂' }],
      error: null
    });

    const context = {
      // 3 days ahead (less than 7 days)
      slots: [{ date: getFutureDate(3), startTime: '10:00', endTime: '11:00' }],
      user: { role: 'user' },
      cleanFields: { bookingType: '一般借用' },
      roomsToBook: [{ roomId: 1 }]
    };

    await expect(block.execute(context)).rejects.toThrow(/需在一週（7天）前申請/);
  });

  it('should allow booking within 7 days for admin users', async () => {
    supabase.from().select().in.mockResolvedValue({
      data: [{ id: 1, name: 'Room A', branch: '仁愛堂' }],
      error: null
    });

    const context = {
      slots: [{ date: getFutureDate(3), startTime: '10:00', endTime: '11:00' }],
      user: { role: 'admin' },
      cleanFields: { bookingType: '一般借用' },
      roomsToBook: [{ roomId: 1 }]
    };

    await expect(block.execute(context)).resolves.not.toThrow();
  });

  it('should throw an error if booking duration is less than 1 hour', async () => {
    supabase.from().select().in.mockResolvedValue({
      data: [{ id: 1, name: 'Room A', branch: '仁愛堂' }],
      error: null
    });

    const context = {
      slots: [{ date: getFutureDate(10), startTime: '10:00', endTime: '10:45' }],
      user: { role: 'user' },
      cleanFields: { bookingType: '一般借用' },
      roomsToBook: [{ roomId: 1 }]
    };

    await expect(block.execute(context)).rejects.toThrow(/借用時間最少必須為 1 小時以上/);
  });

  it('should enforce Sulin branch opening hour limits', async () => {
    supabase.from().select().in.mockResolvedValue({
      data: [{ id: 1, name: 'Sulin Room', branch: '士林堂' }],
      error: null
    });

    // Let's find a Wednesday date
    let wednesday = new Date();
    while (wednesday.getDay() !== 3) {
      wednesday.setDate(wednesday.getDate() + 1);
    }
    // Make it in the next week/future to satisfy 7-day rule if user is role 'user'
    wednesday.setDate(wednesday.getDate() + 7);
    const wednesdayStr = wednesday.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });

    const context = {
      // Sulin Wednesday allowed: 19:00-21:30. Let's try 15:00-17:00 (invalid)
      slots: [{ date: wednesdayStr, startTime: '15:00', endTime: '17:00' }],
      user: { role: 'user' },
      cleanFields: { bookingType: '一般借用' },
      roomsToBook: [{ roomId: 1 }]
    };

    await expect(block.execute(context)).rejects.toThrow(/士林會堂常規借用僅限/);
  });
});
