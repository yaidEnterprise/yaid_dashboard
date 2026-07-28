SET check_function_bodies = false;
DROP EXTENSION IF EXISTS pg_net;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;
CREATE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO anon;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO authenticated;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;
CREATE TABLE public.company (id uuid DEFAULT gen_random_uuid() NOT NULL, name character varying NOT NULL, document_number character varying NOT NULL, email character varying NOT NULL, status character varying DEFAULT 'active'::character varying NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.company ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company ADD CONSTRAINT company_document_number_key UNIQUE (document_number);
ALTER TABLE public.company ADD CONSTRAINT company_email_key UNIQUE (email);
ALTER TABLE public.company ADD CONSTRAINT company_pkey PRIMARY KEY (id);
GRANT ALL ON public.company TO anon;
GRANT ALL ON public.company TO authenticated;
GRANT ALL ON public.company TO service_role;
CREATE TABLE public.company_apps (id uuid DEFAULT gen_random_uuid() NOT NULL, company_id uuid DEFAULT gen_random_uuid(), name text, api_key_hash text, webhook_url text, environment text, status text, created_at timestamp with time zone);
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_apps;
ALTER TABLE public.company_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_apps ADD CONSTRAINT company_apps_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(id);
ALTER TABLE public.company_apps ADD CONSTRAINT company_apps_pkey PRIMARY KEY (id);
GRANT ALL ON public.company_apps TO anon;
GRANT ALL ON public.company_apps TO authenticated;
GRANT ALL ON public.company_apps TO service_role;
CREATE TABLE public.proof_request (id uuid DEFAULT gen_random_uuid() NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, proof_type character varying NOT NULL, status character varying NOT NULL, result boolean, external_ref text, validated_at timestamp without time zone, app_id uuid DEFAULT gen_random_uuid());
ALTER TABLE public.proof_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proof_request ADD CONSTRAINT proof_request_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.company_apps(id);
ALTER TABLE public.proof_request ADD CONSTRAINT proof_request_pkey PRIMARY KEY (id);
GRANT ALL ON public.proof_request TO anon;
GRANT ALL ON public.proof_request TO authenticated;
GRANT ALL ON public.proof_request TO service_role;
CREATE TABLE public.proof_sessions (id uuid DEFAULT gen_random_uuid() NOT NULL, proof_request_id uuid DEFAULT gen_random_uuid() NOT NULL, session_token_hash text, status text, opened_at timestamp with time zone, approved_at timestamp with time zone, created_at timestamp with time zone, challenge_nonce_hash text, challenge_created_at timestamp with time zone);
ALTER TABLE public.proof_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proof_sessions ADD CONSTRAINT proof_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.proof_sessions ADD CONSTRAINT proof_sessions_proof_request_id_fkey FOREIGN KEY (proof_request_id) REFERENCES public.proof_request(id);
GRANT ALL ON public.proof_sessions TO anon;
GRANT ALL ON public.proof_sessions TO authenticated;
GRANT ALL ON public.proof_sessions TO service_role;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') EXECUTE FUNCTION public.rls_auto_enable();
