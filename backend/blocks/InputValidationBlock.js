const BaseBlock = require('./BaseBlock');
const BookingError = require('./BookingError');
const { ALLOWED_BOOKING_TYPES, isAllowed, sanitizeString } = require('../validators');

/**
 * InputValidationBlock
 * 
 * Extracts, sanitizes, and validates the request structure.
 * Sets cleanFields, roomsToBook, and slots in the context.
 */
class InputValidationBlock extends BaseBlock {
  async execute(context) {
    const { reqBody } = context;
    if (!reqBody) {
      throw new BookingError('缺少請求主體', 400);
    }

    const { roomId, fullName, phone, pastoralZone, purpose, bookingType, attendanceCount, rooms: bodyRooms } = reqBody;

    if (bookingType && !isAllowed(bookingType, ALLOWED_BOOKING_TYPES)) {
      throw new BookingError('無效的借用類型', 400);
    }

    if (attendanceCount === undefined || isNaN(Number(attendanceCount)) || Number(attendanceCount) <= 0) {
      throw new BookingError('預計人數必須大於 0', 400);
    }

    const roomsToBook = bodyRooms && Array.isArray(bodyRooms) && bodyRooms.length > 0
      ? bodyRooms
      : [{ roomId, purpose }];

    const slots = reqBody.slots || [
      { date: reqBody.date, startTime: reqBody.startTime, endTime: reqBody.endTime }
    ];

    if (!roomsToBook.every(r => r.roomId) || !slots || !Array.isArray(slots) || slots.length === 0) {
      throw new BookingError('請選擇場地與至少一個借用時段', 400);
    }

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s.date || !s.startTime || !s.endTime) {
        throw new BookingError(`第 ${i + 1} 個時段資料不完整`, 400);
      }
    }

    // Save cleaned inputs in context
    context.cleanFields = {
      fullName: sanitizeString(fullName, 50),
      phone: sanitizeString(phone, 20),
      pastoralZone: sanitizeString(pastoralZone, 50),
      attendanceCount: Number(attendanceCount),
      bookingType: bookingType || '一般借用'
    };

    context.roomsToBook = roomsToBook.map(r => ({
      roomId: r.roomId,
      purpose: r.purpose,
      cleanPurpose: sanitizeString(r.purpose, 300)
    }));

    context.slots = slots;
  }
}

module.exports = InputValidationBlock;
