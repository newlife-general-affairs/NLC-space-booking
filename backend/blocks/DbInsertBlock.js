const BaseBlock = require('./BaseBlock');
const BookingError = require('./BookingError');
const { supabase } = require('../database');

/**
 * DbInsertBlock
 * 
 * Performs insertion of new bookings into the database.
 * If bookingsToInsert is empty, it finishes early, sets the response, and sets context.stop = true.
 */
class DbInsertBlock extends BaseBlock {
  async execute(context) {
    const { bookingsToInsert, skippedDuplicatesCount } = context;

    if (!bookingsToInsert || bookingsToInsert.length === 0) {
      context.responseStatus = 200;
      context.responseData = {
        message: '您的預約已存在，系統已自動忽略重複送出的資料。',
        bookingCount: 0
      };
      context.stop = true; // Stop pipeline (e.g. bypass sending emails)
      return;
    }

    const { data: insertedBookings, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingsToInsert)
      .select('id');

    if (bookingError) {
      console.error('Batch booking insert error:', bookingError);
      throw new BookingError('建立預約失敗，可能是時段衝突或資料不完整，請重新整理頁面再試', 500);
    }

    context.insertedBookings = insertedBookings;
    context.responseStatus = 201;
    context.responseData = {
      message: skippedDuplicatesCount > 0 
        ? `預約成功！其中部分重複時段已自動忽略。` 
        : '預約成功！已寄發確認信。', 
      bookingCount: insertedBookings.length 
    };
  }
}

module.exports = DbInsertBlock;
