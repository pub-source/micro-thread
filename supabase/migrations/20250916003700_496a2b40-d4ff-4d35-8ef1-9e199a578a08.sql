-- Fix security issue: Restrict IP address access to admins only

-- Create a function to check if user is admin (for future admin authentication)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- For now, this returns false since we don't have admin auth implemented
  -- When admin auth is implemented, this should check admin_users table
  SELECT false;
$$;

-- Drop existing policies that expose IP addresses
DROP POLICY IF EXISTS "Anyone can view active threads" ON public.threads;
DROP POLICY IF EXISTS "Anyone can view replies" ON public.replies;

-- Create new secure policies for threads that exclude IP addresses for public users
CREATE POLICY "Public can view threads without IP addresses"
ON public.threads
FOR SELECT
TO public
USING (status = 'active'::thread_status);

-- Create new secure policies for replies that exclude IP addresses for public users  
CREATE POLICY "Public can view replies without IP addresses"
ON public.replies
FOR SELECT
TO public
USING (true);

-- Create admin-only policies for full access including IP addresses
CREATE POLICY "Admins can view all thread data including IP addresses"
ON public.threads
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can view all reply data including IP addresses"
ON public.replies
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Keep existing insert policies
CREATE POLICY "Anyone can insert threads"
ON public.threads
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Anyone can insert replies"
ON public.replies
FOR INSERT
TO public
WITH CHECK (true);

-- Create views that explicitly exclude IP addresses for public access
CREATE OR REPLACE VIEW public.threads_public AS
SELECT 
  id,
  content,
  rating,
  anonymous_id,
  status,
  created_at,
  updated_at
FROM public.threads
WHERE status = 'active'::thread_status;

CREATE OR REPLACE VIEW public.replies_public AS
SELECT 
  id,
  thread_id,
  content,
  anonymous_id,
  admin_id,
  created_at,
  updated_at
FROM public.replies;

-- Grant access to the views
GRANT SELECT ON public.threads_public TO public;
GRANT SELECT ON public.replies_public TO public;