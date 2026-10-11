-- Apply the security migration as the hosted-postgres stand-in.
-- The caller is a superuser. Do not run this file on Supabase.

\i 02_hosted_postgres.sql
SET ROLE mq_postgres;
\i ../migrations/20261011190000_security_fixes.sql
RESET ROLE;
