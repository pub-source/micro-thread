-- Allow public to insert warnings (no auth yet)
CREATE POLICY IF NOT EXISTS "Public can insert warnings" 
ON public.user_warnings 
FOR INSERT 
WITH CHECK (true);