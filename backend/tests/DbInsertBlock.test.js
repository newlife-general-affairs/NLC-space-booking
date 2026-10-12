const DbInsertBlock = require('../blocks/DbInsertBlock');
const BookingError = require('../blocks/BookingError');
const { supabase } = require('../database');

let mockInsertQuery = jest.fn();

jest.mock('../database', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      then: (onFulfilled) => Promise.resolve(mockInsertQuery()).then(onFulfilled)
    }))
  }
}));

describe('DbInsertBlock', () => {
  let block;

  beforeEach(() => {
    block = new DbInsertBlock();
    jest.clearAllMocks();
  });

  it('should set early-stop and return 200 status when bookingsToInsert is empty', async () => {
    const context = {
      bookingsToInsert: [],
      skippedDuplicatesCount: 2
    };

    await block.execute(context);

    expect(context.responseStatus).toBe(200);
    expect(context.responseData.bookingCount).toBe(0);
    expect(context.stop).toBe(true);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('should successfully insert bookings and return 201 status', async () => {
    mockInsertQuery.mockResolvedValue({
      data: [{ id: 101 }, { id: 102 }],
      error: null
    });

    const context = {
      bookingsToInsert: [
        { room_id: 1, booking_date: '2026-08-01' },
        { room_id: 1, booking_date: '2026-08-02' }
      ],
      skippedDuplicatesCount: 0
    };

    await block.execute(context);

    expect(context.responseStatus).toBe(201);
    expect(context.insertedBookings).toEqual([{ id: 101 }, { id: 102 }]);
    expect(context.responseData.bookingCount).toBe(2);
    expect(context.stop).toBeUndefined();
    expect(supabase.from).toHaveBeenCalledWith('bookings');
  });

  it('should throw BookingError (500) if Supabase returns an error', async () => {
    mockInsertQuery.mockResolvedValue({
      data: null,
      error: { message: 'Database constraint failed' }
    });

    const context = {
      bookingsToInsert: [{ room_id: 1, booking_date: '2026-08-01' }],
      skippedDuplicatesCount: 0
    };

    await expect(block.execute(context)).rejects.toThrow(
      /建立預約失敗，可能是時段衝突或資料不完整/
    );
  });
});
