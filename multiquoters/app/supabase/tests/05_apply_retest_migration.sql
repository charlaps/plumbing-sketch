-- Apply the retest migration as the hosted-postgres stand-in.
-- The caller is a superuser. Do not run this file on Supabase.

SET ROLE mq_postgres;
\i ../migrations/20261012210000_retest_fixes.sql
RESET ROLE;
