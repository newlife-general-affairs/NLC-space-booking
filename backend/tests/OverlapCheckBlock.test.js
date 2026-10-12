const OverlapCheckBlock = require('../blocks/OverlapCheckBlock');
const BookingError = require('../blocks/BookingError');
const { supabase } = require('../database');

let mockBookingsQuery = jest.fn();
let mockRoomsQuery = jest.fn();

jest.mock('../database', () => ({
  supabase: {
    from: jest.fn((table) => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        then: (onFulfilled) => {
          if (table === 'bookings') {
            return Promise.resolve(mockBookingsQuery()).then(onFulfilled);
          } else if (table === 'rooms') {
            return Promise.resolve(mockRoomsQuery()).then(onFulfilled);
          }
        }
      };
      return chain;
    })
  }
}));

describe('OverlapCheckBlock', () => {
  let block;

  beforeEach(() => {
    block = new OverlapCheckBlock();
    jest.clearAllMocks();
  });

  it('should successfully complete overlap check if no duplicates and no overlap', async () => {
    // Duplicate check returns empty
    mockBookingsQuery.mockResolvedValueOnce({ data: [], error: null });
    // Parent-child rooms check returns some rooms
    mockRoomsQuery.mockResolvedValue({ data: [{ id: 1, parent_room_id: null }], error: null });
    // Overlap check returns empty
    mockBookingsQuery.mockResolvedValueOnce({ data: [], error: null });

    const context = {
      slots: [{ date: '2026-08-01', startTime: '10:00', endTime: '12:00' }],
      user: { email: 'test@example.com' },
      cleanFields: {
        bookingType: '一般借用',
        fullName: 'John',
        phone: '0912',
        pastoralZone: 'Zone',
        attendanceCount: 10
      },
      roomsToBook: [{ roomId: 1, cleanPurpose: 'Meeting' }],
      targetRooms: [{ id: 1, name: 'Room 1', branch: '仁愛堂' }]
    };

    await block.execute(context);

    expect(context.bookingsToInsert.length).toBe(1);
    expect(context.skippedDuplicatesCount).toBe(0);
  });

  it('should detect duplicate slots and filter them out', async () => {
    // Duplicate check returns 1 identical booking
    mockBookingsQuery.mockResolvedValueOnce({
      data: [{
        room_id: 1,
        booking_date: '2026-08-01',
        start_time: '10:00:00',
        end_time: '12:00:00',
        user_email: 'test@example.com',
        full_name: 'John',
        phone: '0912',
        pastoral_zone: 'Zone',
        purpose: 'Meeting',
        booking_type: '一般借用',
        attendance_count: 10
      }],
      error: null
    });

    const context = {
      slots: [{ date: '2026-08-01', startTime: '10:00', endTime: '12:00' }],
      user: { email: 'test@example.com' },
      cleanFields: {
        bookingType: '一般借用',
        fullName: 'John',
        phone: '0912',
        pastoralZone: 'Zone',
        attendanceCount: 10
      },
      roomsToBook: [{ roomId: 1, cleanPurpose: 'Meeting' }],
      targetRooms: [{ id: 1, name: 'Room 1', branch: '仁愛堂' }]
    };

    await block.execute(context);

    expect(context.bookingsToInsert.length).toBe(0);
    expect(context.skippedDuplicatesCount).toBe(1);
  });

  it('should throw Conflict BookingError (409) if overlap is found in database', async () => {
    // Duplicate check returns empty
    mockBookingsQuery.mockResolvedValueOnce({ data: [], error: null });
    // Parent-child rooms check returns hierarchy
    mockRoomsQuery.mockResolvedValue({ data: [{ id: 1, parent_room_id: null }], error: null });
    // Overlap check returns overlapping booking
    mockBookingsQuery.mockResolvedValueOnce({
      data: [{ id: 99, room_id: 1, rooms: { name: 'Room 1' } }],
      error: null
    });

    const context = {
      slots: [{ date: '2026-08-01', startTime: '10:00', endTime: '12:00' }],
      user: { email: 'test@example.com' },
      cleanFields: {
        bookingType: '一般借用',
        fullName: 'John',
        phone: '0912',
        pastoralZone: 'Zone',
        attendanceCount: 10
      },
      roomsToBook: [{ roomId: 1, cleanPurpose: 'Meeting' }],
      targetRooms: [{ id: 1, name: 'Room 1', branch: '仁愛堂' }]
    };

    await expect(block.execute(context)).rejects.toThrow(
      /此時段已與「Room 1」的預約衝突/
    );
  });
});
