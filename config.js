// Isi tiga nilai ini dari dashboard Supabase. JANGAN pakai secret key / service_role di sini.
const SUPABASE_URL = 'https://bathalqkmmhyjjbvvkwg.supabase.co';   // Project URL
const SUPABASE_KEY = 'sb_publishable_jC_wzD7EW4NO-dMJy6m-mg_bKE_qVE5';        // Publishable key
const OWNER_EMAIL  = 'chandrasur3679@gmail.com';       // email akun yang dibuat di Authentication > Users
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
