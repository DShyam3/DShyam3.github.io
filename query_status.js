import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.from('tv_shows').select('status');
  const counts = {};
  data.forEach(d => {
    counts[d.status] = (counts[d.status] || 0) + 1;
  });
  console.log(counts);
}
run();
