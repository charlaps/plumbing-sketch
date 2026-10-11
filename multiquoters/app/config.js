// Public settings for the static site. The anon key is meant to be public.
// Never paste the service_role key, a PayFast passphrase, or a database password here.
window.MQ_CONFIG = {
  SUPABASE_URL: 'https://uihcqmwcngpdyczzkjen.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpaGNxbXdjbmdwZHljenpramVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MzA4OTcsImV4cCI6MjEwNzMwNjg5N30.AyR7McKif8ge0BmK1PPsbE7HH1C6akLlPMUUWa4KUV0',
  // How long the owner asks contractors to wait after an EFT.
  EFT_CREDIT_HOURS: 24,
  // Real bank details are not available yet. These placeholders stay until they are.
  // The app hides them and says "Bank details coming soon".
  EFT_ACCOUNT_NAME: 'Your business name',
  EFT_BANK: 'Your bank',
  EFT_ACCOUNT_NO: '0000000000',
  EFT_BRANCH: '000000'
};
