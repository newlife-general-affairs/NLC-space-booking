const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseKey = serviceRoleKey || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in backend/.env');
}

if (!serviceRoleKey) {
  console.error('[configuration] SUPABASE_SERVICE_ROLE_KEY is missing. Protected profile and role queries may be blocked by RLS.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function initDb() {
  // Verify connection by fetching rooms
  const { error } = await supabase
    .from('rooms')
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.warn(`Warning: Could not connect to Supabase rooms table: ${error.message}`);
  }
}

module.exports = { supabase, initDb };