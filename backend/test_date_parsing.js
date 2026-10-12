const { supabase } = require('./database');

async function main() {
  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, booking_date, start_time, end_time, rooms(name, tuya_device_id)')
      .eq('status', 'approved');
      
    if (error) throw error;
    
    console.log(`Analyzing ${bookings.length} approved bookings for date/time conversion issues:`);
    bookings.forEach(booking => {
      const startBufferMinutes = 10;
      const endBufferMinutes = 15;
      
      let startTimeStr = booking.start_time || '';
      if (startTimeStr.split(':').length === 2) {
        startTimeStr = `${startTimeStr}:00`;
      }
      let endTimeStr = booking.end_time || '';
      if (endTimeStr.split(':').length === 2) {
        endTimeStr = `${endTimeStr}:00`;
      }

      const startDt = new Date(`${booking.booking_date}T${startTimeStr}+08:00`);
      let effectiveTime = Math.floor(startDt.getTime() / 1000) - (startBufferMinutes * 60);
      
      const nowUnix = Math.floor(Date.now() / 1000);
      if (effectiveTime < nowUnix) {
        effectiveTime = nowUnix;
      }
      
      let endDt;
      if (endTimeStr.substring(0, 5) === '00:00') {
        const nextDay = new Date(startDt);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
        endDt = new Date(`${nextDayStr}T00:00:00+08:00`);
      } else {
        endDt = new Date(`${booking.booking_date}T${endTimeStr}+08:00`);
      }
      const invalidTime = Math.floor(endDt.getTime() / 1000) + (endBufferMinutes * 60);

      const hasNan = isNaN(effectiveTime) || isNaN(invalidTime);
      if (hasNan) {
        console.log(`❌ Booking #${booking.id} has parsing error!`);
        console.log(`   booking_date: "${booking.booking_date}"`);
        console.log(`   start_time: "${booking.start_time}" -> "${startTimeStr}"`);
        console.log(`   end_time: "${booking.end_time}" -> "${endTimeStr}"`);
        console.log(`   effectiveTime: ${effectiveTime}, invalidTime: ${invalidTime}`);
      }
    });
    console.log('Analysis complete.');
  } catch (err) {
    console.error('Error analyzing bookings:', err);
  }
}

main();
