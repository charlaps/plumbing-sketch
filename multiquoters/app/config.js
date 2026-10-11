// Public settings for the static site. The anon key is meant to be public.
// Never paste the service_role key, a PayFast passphrase, or a database password here.
window.MQ_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  // How long the owner asks contractors to wait after an EFT.
  EFT_CREDIT_HOURS: 24,
  EFT_ACCOUNT_NAME: 'Your business name',
  EFT_BANK: 'Your bank',
  EFT_ACCOUNT_NO: '0000000000',
  EFT_BRANCH: '000000'
};
