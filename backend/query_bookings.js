const { supabase } = require('./database');

async function main() {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (error) throw error;
    
    if (data.length > 0) {
      console.log('Columns in bookings table:', Object.keys(data[0]));
      console.log('\nRecent 5 Bookings:', JSON.stringify(data, null, 2));
    } else {
      console.log('No bookings found.');
    }
  } catch (err) {
    console.error('Error querying bookings:', err);
  }
}

main();
