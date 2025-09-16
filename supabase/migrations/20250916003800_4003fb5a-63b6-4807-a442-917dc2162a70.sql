-- Remove security definer views that bypass RLS
DROP VIEW IF EXISTS public.threads_public;
DROP VIEW IF EXISTS public.replies_public;

-- The RLS policies are already in place to control access
-- Client code will be updated to select only non-sensitive columns