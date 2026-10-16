const BaseBlock = require('./BaseBlock');
const BookingError = require('./BookingError');
const { supabase } = require('../database');

/**
 * OverlapCheckBlock
 * 
 * Performs checking of:
 * 1. Duplicate requests (same user, room, slot, purpose, etc.) - logs as skipped.
 * 2. Overlap conflicts - searches for overlapping bookings in the database for target room
 *    as well as parent/child rooms.
 * Generates context.bookingsToInsert and context.skippedDuplicatesCount.
 * When context.excludeBookingId is set (editing an existing booking), that booking
 * is ignored in both checks so it does not conflict with itself.
 */
class OverlapCheckBlock extends BaseBlock {
  async execute(context) {
    const { slots, user, cleanFields, roomsToBook, targetRooms, excludeBookingId } = context;
    const userEmail = user.email;
    const bookingType = cleanFields.bookingType;
    const cleanFullName = cleanFields.fullName;
    const cleanPhone = cleanFields.phone;
    const cleanPastoralZone = cleanFields.pastoralZone;
    const attendanceCount = cleanFields.attendanceCount;

    const slotDates = slots.map(s => s.date);
    const bookingsToInsert = [];
    let skippedDuplicatesCount = 0;

    for (const item of roomsToBook) {
      const { roomId: rId, cleanPurpose } = item;

      // 1. Fetch user's existing bookings for this room on the slot dates to filter out identical duplicate requests
      let existingQuery = supabase
        .from('bookings')
        .select('room_id, booking_date, start_time, end_time, user_email, full_name, phone, pastoral_zone, purpose, booking_type, attendance_count')
        .eq('room_id', rId)
        .eq('user_email', userEmail)
        .in('booking_date', slotDates)
        .neq('status', 'rejected');
      if (excludeBookingId) existingQuery = existingQuery.neq('id', excludeBookingId);
      const { data: existingBookings, error: fetchExistingError } = await existingQuery;

      if (fetchExistingError) {
        console.error('Fetch existing bookings error:', fetchExistingError);
        throw new BookingError('檢查重複預約失敗，請稍後再試', 500);
      }

      // Filter slots to only check overlap and insert if they are not exact duplicates
      const uniqueSlotsForRoom = [];
      for (const s of slots) {
        const isDuplicate = existingBookings && existingBookings.some(eb =>
          eb.booking_date === s.date &&
          eb.start_time.substring(0, 5) === s.startTime.substring(0, 5) &&
          eb.end_time.substring(0, 5) === s.endTime.substring(0, 5) &&
          eb.full_name === cleanFullName &&
          eb.phone === cleanPhone &&
          eb.pastoral_zone === cleanPastoralZone &&
          eb.purpose === cleanPurpose &&
          eb.booking_type === bookingType &&
          Number(eb.attendance_count) === Number(attendanceCount)
        );

        if (isDuplicate) {
          skippedDuplicatesCount++;
        } else {
          uniqueSlotsForRoom.push(s);
        }
      }

      const targetRoom = targetRooms.find(r => r.id === rId);

      // 2. Overlap validation (skip for virtual rooms like '💒 由教會分配')
      if (targetRoom && targetRoom.name !== '💒 由教會分配') {
        // Fetch all rooms to check hierarchy (parent-child relationships)
        const { data: allRooms, error: allRoomsErr } = await supabase
          .from('rooms')
          .select('id, parent_room_id');

        if (allRoomsErr) {
          console.error('Fetch all rooms for conflict check error:', allRoomsErr);
          throw new BookingError('檢查場地可用性失敗，請稍後再試', 500);
        }

        const relatedRoomIds = [rId];
        if (allRooms) {
          const currentRoom = allRooms.find(r => r.id === rId);
          if (currentRoom) {
            if (currentRoom.parent_room_id) {
              relatedRoomIds.push(currentRoom.parent_room_id);
            }
            allRooms.forEach(r => {
              if (r.parent_room_id === rId) {
                relatedRoomIds.push(r.id);
              }
            });
          }
        }

        for (let i = 0; i < uniqueSlotsForRoom.length; i++) {
          const s = uniqueSlotsForRoom[i];
          let overlapQuery = supabase
            .from('bookings')
            .select('id, room_id, rooms(name)')
            .in('room_id', relatedRoomIds)
            .eq('booking_date', s.date)
            .lt('start_time', s.endTime)
            .gt('end_time', s.startTime)
            .neq('status', 'rejected');
          if (excludeBookingId) overlapQuery = overlapQuery.neq('id', excludeBookingId);
          const { data: overlapping, error: overlapError } = await overlapQuery;

          if (overlapError) {
            console.error('Overlap check error:', overlapError);
            throw new BookingError('檢查場地可用性失敗，請稍後再試', 500);
          }

          if (overlapping.length > 0) {
            const conflictedRoomName = overlapping[0].rooms?.name || '相關場地';
            throw new BookingError(
              `場地「${targetRoom.name}」在此時段已與「${conflictedRoomName}」的預約衝突 (${s.date} ${s.startTime}-${s.endTime})`,
              409
            );
          }
        }
      }

      // Add non-duplicate slots to insertion queue
      uniqueSlotsForRoom.forEach(s => {
        bookingsToInsert.push({
          room_id: rId,
          user_email: userEmail,
          booking_date: s.date,
          start_time: s.startTime,
          end_time: s.endTime,
          full_name: cleanFullName,
          phone: cleanPhone,
          pastoral_zone: cleanPastoralZone,
          purpose: cleanPurpose,
          booking_type: bookingType,
          attendance_count: Number(attendanceCount) || 0
        });
      });
    }

    context.bookingsToInsert = bookingsToInsert;
    context.skippedDuplicatesCount = skippedDuplicatesCount;
  }
}

module.exports = OverlapCheckBlock;
