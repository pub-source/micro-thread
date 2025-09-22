-- RPC functions to safely archive and delete threads from the Admin UI
-- These run with SECURITY DEFINER to avoid client-side RLS issues

CREATE OR REPLACE FUNCTION public.archive_thread(p_thread_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.threads
  SET status = 'archived'::thread_status,
      updated_at = now()
  WHERE id = p_thread_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_thread(p_thread_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.threads
  SET status = 'deleted'::thread_status,
      updated_at = now()
  WHERE id = p_thread_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;