-- Fix the overly permissive RLS policies on thread_likes table
-- The current policies allow any user to manipulate any like record

-- Drop the existing overly permissive policies
DROP POLICY IF EXISTS "Public can delete their own likes" ON public.thread_likes;
DROP POLICY IF EXISTS "Public can insert their own likes" ON public.thread_likes;
DROP POLICY IF EXISTS "Public can update their own likes" ON public.thread_likes;

-- Create more restrictive policies
-- Note: Since we're dealing with anonymous users, we can't use auth.uid()
-- We'll implement client-side validation and server-side constraints

-- Allow viewing all thread likes (this is needed for displaying vote counts)
-- This policy already exists and is appropriate

-- Restrict INSERT: Users can only insert likes with their own anonymous_id
-- We'll add a check to prevent obviously fake anonymous_ids
CREATE POLICY "Users can only insert their own likes" 
ON public.thread_likes 
FOR INSERT 
WITH CHECK (
  -- Prevent obviously fake/malicious anonymous_ids
  anonymous_id IS NOT NULL 
  AND length(anonymous_id) >= 8 
  AND length(anonymous_id) <= 100
  AND anonymous_id ~ '^[a-zA-Z0-9_-]+$'
);

-- Restrict UPDATE: Users can only update likes with their own anonymous_id
-- Since we can't verify ownership perfectly, we'll disable updates entirely
-- Users should delete and recreate likes instead
CREATE POLICY "No updates allowed on thread_likes" 
ON public.thread_likes 
FOR UPDATE 
USING (false);

-- Restrict DELETE: Users can only delete likes with their own anonymous_id
-- Since we can't verify ownership perfectly in RLS, we'll disable direct deletes
-- The application will handle like toggles through proper logic
CREATE POLICY "No direct deletes allowed on thread_likes" 
ON public.thread_likes 
FOR DELETE 
USING (false);

-- Add a unique constraint to prevent duplicate likes from the same user on the same thread
ALTER TABLE public.thread_likes 
ADD CONSTRAINT unique_user_thread_like 
UNIQUE (anonymous_id, thread_id);

-- Create a function to safely toggle likes (to be used by the application)
CREATE OR REPLACE FUNCTION public.toggle_thread_like(
  p_anonymous_id text,
  p_thread_id uuid,
  p_like_type text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_like_id uuid;
  result json;
BEGIN
  -- Validate inputs
  IF p_anonymous_id IS NULL OR length(p_anonymous_id) < 8 OR length(p_anonymous_id) > 100 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid anonymous_id');
  END IF;
  
  IF p_like_type NOT IN ('like', 'dislike') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid like_type');
  END IF;
  
  -- Check if like already exists
  SELECT id INTO existing_like_id
  FROM public.thread_likes
  WHERE anonymous_id = p_anonymous_id AND thread_id = p_thread_id;
  
  IF existing_like_id IS NOT NULL THEN
    -- Remove existing like
    DELETE FROM public.thread_likes WHERE id = existing_like_id;
    RETURN json_build_object('success', true, 'action', 'removed', 'like_id', existing_like_id);
  ELSE
    -- Add new like
    INSERT INTO public.thread_likes (anonymous_id, thread_id, like_type)
    VALUES (p_anonymous_id, p_thread_id, p_like_type)
    RETURNING id INTO existing_like_id;
    
    RETURN json_build_object('success', true, 'action', 'added', 'like_id', existing_like_id);
  END IF;
END;
$$;