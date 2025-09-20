-- Fix user_warnings RLS so admins can read warnings (to show warning colors in Admin UI)
-- 1) Drop overly restrictive policy that blocked all access
DROP POLICY IF EXISTS "Only admins can access warnings" ON public.user_warnings;

-- 2) Allow admins (per is_admin()) to SELECT warnings
CREATE POLICY "Admins can view warnings"
ON public.user_warnings
FOR SELECT
USING (is_admin());

-- Keep existing insert policy for public; no changes needed
-- Note: UPDATE/DELETE remain restricted (no policy) which is desired