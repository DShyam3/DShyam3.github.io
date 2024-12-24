import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Supabase Initialization
const SUPABASE_URL = 'https://qtarzunpnoabyxvjrprb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0YXJ6dW5wbm9hYnl4dmpycHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4MDEwODIsImV4cCI6MjA1MDM3NzA4Mn0.lqyTrPB6nAuJeLSshans_1gujFUiUh03JmLykyjaqdo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

