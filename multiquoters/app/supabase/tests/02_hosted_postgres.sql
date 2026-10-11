-- Stand-in for the role that runs SQL on hosted Supabase.
-- That role owns the app, is not a superuser, and is not a member of
-- supabase_admin. Do not run this file on Supabase.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mq_postgres') THEN
    CREATE ROLE mq_postgres NOLOGIN NOSUPERUSER BYPASSRLS NOINHERIT;
  END IF;
END $$;

ALTER ROLE mq_postgres WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOLOGIN BYPASSRLS NOINHERIT;

DO $$
DECLARE
  granted name;
BEGIN
  FOR granted IN
    SELECT g.rolname
    FROM pg_auth_members m
    JOIN pg_roles g ON g.oid = m.roleid
    JOIN pg_roles member ON member.oid = m.member
    WHERE member.rolname = 'mq_postgres'
      AND g.rolname IN ('postgres', 'supabase_admin')
  LOOP
    EXECUTE format('REVOKE %I FROM mq_postgres', granted);
  END LOOP;
END $$;

DO $$
BEGIN
  EXECUTE format('GRANT CREATE ON DATABASE %I TO mq_postgres', current_database());
END $$;

GRANT USAGE, CREATE ON SCHEMA public TO mq_postgres;
ALTER SCHEMA public OWNER TO mq_postgres;

-- Hosted postgres can read auth.uid() and auth.users. Guard views and
-- admin_snapshot use them.
GRANT USAGE ON SCHEMA auth TO mq_postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO mq_postgres;
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO mq_postgres;

-- The security script has to own the objects it alters, as hosted postgres does.
DO $own$
DECLARE
  r record;
  new_owner oid := (SELECT oid FROM pg_roles WHERE rolname = 'mq_postgres');
BEGIN
  -- Table ownership also moves a sequence that belongs to a column.
  -- Those sequences cannot be altered on their own.
  FOR r IN
    SELECT n.nspname, c.relname,
      CASE c.relkind
        WHEN 'r' THEN 'TABLE'
        WHEN 'p' THEN 'TABLE'
        WHEN 'v' THEN 'VIEW'
        WHEN 'm' THEN 'MATERIALIZED VIEW'
        WHEN 'f' THEN 'FOREIGN TABLE'
      END AS kind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'mq_guard')
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND c.relowner <> new_owner
  LOOP
    EXECUTE format('ALTER %s %I.%I OWNER TO mq_postgres', r.kind, r.nspname, r.relname);
  END LOOP;

  FOR r IN
    SELECT n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'mq_guard')
      AND c.relkind = 'S'
      AND c.relowner <> new_owner
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass
          AND d.objid = c.oid
          AND d.deptype = 'a'
      )
  LOOP
    EXECUTE format('ALTER SEQUENCE %I.%I OWNER TO mq_postgres', r.nspname, r.relname);
  END LOOP;

  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'mq_guard')
      AND p.proowner <> new_owner
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) OWNER TO mq_postgres',
      r.nspname, r.proname, r.args
    );
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'mq_guard') THEN
    EXECUTE 'ALTER SCHEMA mq_guard OWNER TO mq_postgres';
  END IF;
END
$own$;
