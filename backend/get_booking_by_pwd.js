const { supabase } = require('./database');

async function run() {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, access_code, tuya_password_id, status, rooms(name, tuya_device_id)')
    .eq('access_code', '396218');
    
  if (error) {
    console.error(error);
    return;
  }
  console.log(JSON.stringify(bookings, null, 2));
}

run();
