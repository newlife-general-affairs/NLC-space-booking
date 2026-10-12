const { supabase } = require('./database');

async function main() {
  try {
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('id, name, branch, tuya_device_id, tuya_light_id, tuya_ac_id');
      
    if (error) throw error;
    
    console.log('Rooms config:');
    rooms.forEach(r => {
      console.log(`Room #${r.id} (${r.name}, ${r.branch}):`);
      console.log(`  tuya_device_id: "${r.tuya_device_id}"`);
      console.log(`  tuya_light_id:  "${r.tuya_light_id}"`);
      console.log(`  tuya_ac_id:     "${r.tuya_ac_id}"`);
    });
  } catch (err) {
    console.error('Error querying rooms:', err);
  }
}

main();
