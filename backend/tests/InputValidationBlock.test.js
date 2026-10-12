const InputValidationBlock = require('../blocks/InputValidationBlock');
const BookingError = require('../blocks/BookingError');

describe('InputValidationBlock', () => {
  let block;

  beforeEach(() => {
    block = new InputValidationBlock();
  });

  it('should successfully validate and sanitize valid input', async () => {
    const context = {
      reqBody: {
        roomId: 1,
        fullName: '  Test User  ',
        phone: '0912345678',
        pastoralZone: 'Test Zone',
        purpose: 'Meeting',
        bookingType: '一般借用',
        attendanceCount: '5',
        slots: [
          { date: '2026-08-01', startTime: '10:00', endTime: '12:00' }
        ]
      }
    };

    await block.execute(context);

    expect(context.cleanFields.fullName).toBe('Test User');
    expect(context.cleanFields.phone).toBe('0912345678');
    expect(context.cleanFields.pastoralZone).toBe('Test Zone');
    expect(context.cleanFields.attendanceCount).toBe(5);
    expect(context.cleanFields.bookingType).toBe('一般借用');

    expect(context.roomsToBook).toEqual([
      { roomId: 1, purpose: 'Meeting', cleanPurpose: 'Meeting' }
    ]);
    expect(context.slots).toEqual([
      { date: '2026-08-01', startTime: '10:00', endTime: '12:00' }
    ]);
  });

  it('should throw an error if bookingType is disallowed', async () => {
    const context = {
      reqBody: {
        roomId: 1,
        fullName: 'Test User',
        phone: '0912345678',
        pastoralZone: 'Zone',
        purpose: 'Meeting',
        bookingType: 'InvalidType',
        attendanceCount: 10,
        slots: [{ date: '2026-08-01', startTime: '10:00', endTime: '12:00' }]
      }
    };

    await expect(block.execute(context)).rejects.toThrow(new BookingError('無效的借用類型', 400));
  });

  it('should throw an error if attendanceCount is invalid or missing', async () => {
    const context = {
      reqBody: {
        roomId: 1,
        fullName: 'Test User',
        phone: '0912345678',
        pastoralZone: 'Zone',
        purpose: 'Meeting',
        attendanceCount: 0,
        slots: [{ date: '2026-08-01', startTime: '10:00', endTime: '12:00' }]
      }
    };

    await expect(block.execute(context)).rejects.toThrow(new BookingError('預計人數必須大於 0', 400));
  });

  it('should throw an error if slot data is incomplete', async () => {
    const context = {
      reqBody: {
        roomId: 1,
        fullName: 'Test User',
        phone: '0912345678',
        pastoralZone: 'Zone',
        purpose: 'Meeting',
        attendanceCount: 5,
        slots: [
          { date: '2026-08-01', startTime: '10:00' } // Missing endTime
        ]
      }
    };

    await expect(block.execute(context)).rejects.toThrow(new BookingError('第 1 個時段資料不完整', 400));
  });
});
