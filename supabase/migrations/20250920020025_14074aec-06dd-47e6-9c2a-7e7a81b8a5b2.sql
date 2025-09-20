-- Check current policies on thread_likes table and fix them
-- First, let's drop all existing policies to start fresh
DROP POLICY IF EXISTS "Public can delete their own likes" ON public.thread_likes;
DROP POLICY IF EXISTS "Public can insert their own likes" ON public.thread_likes;
DROP POLICY IF EXISTS "Public can update their own likes" ON public.thread_likes;
DROP POLICY IF EXISTS "Public can view thread likes" ON public.thread_likes;
DROP POLICY IF EXISTS "Users can only insert their own likes" ON public.thread_likes;

-- Create secure policies for thread_likes

-- Allow viewing all thread likes (needed for displaying vote counts)
CREATE POLICY "Allow viewing thread likes" 
ON public.thread_likes 
FOR SELECT 
USING (true);

-- Restrict INSERT: Basic validation for anonymous_id format
CREATE POLICY "Restrict like insertions" 
ON public.thread_likes 
FOR INSERT 
WITH CHECK (
  anonymous_id IS NOT NULL 
  AND length(anonymous_id) >= 8 
  AND length(anonymous_id) <= 100
  AND anonymous_id ~ '^[a-zA-Z0-9_-]+$'
);

-- Disable direct updates and deletes - use the toggle function instead
CREATE POLICY "No direct updates on likes" 
ON public.thread_likes 
FOR UPDATE 
USING (false);

CREATE POLICY "No direct deletes on likes" 
ON public.thread_likes 
FOR DELETE 
USING (false);

-- Add unique constraint to prevent duplicate likes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_user_thread_like' 
    AND table_name = 'thread_likes'
  ) THEN
    ALTER TABLE public.thread_likes 
    ADD CONSTRAINT unique_user_thread_like 
    UNIQUE (anonymous_id, thread_id);
  END IF;
END $$;

-- Create a secure function to toggle likes
CREATE OR REPLACE FUNCTION public.toggle_thread_like(
  p_anonymous_id text,
  p_thread_id uuid,
  p_like_type text DEFAULT 'like'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_like_id uuid;
  existing_like_type text;
BEGIN
  -- Validate inputs
  IF p_anonymous_id IS NULL OR length(p_anonymous_id) < 8 OR length(p_anonymous_id) > 100 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid anonymous_id');
  END IF;
  
  IF p_like_type NOT IN ('like', 'dislike') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid like_type');
  END IF;
  
  -- Check if thread exists
  IF NOT EXISTS (SELECT 1 FROM public.threads WHERE id = p_thread_id) THEN
    RETURN json_build_object('success', false, 'error', 'Thread not found');
  END IF;
  
  -- Check if like already exists
  SELECT id, like_type INTO existing_like_id, existing_like_type
  FROM public.thread_likes
  WHERE anonymous_id = p_anonymous_id AND thread_id = p_thread_id;
  
  IF existing_like_id IS NOT NULL THEN
    IF existing_like_type = p_like_type THEN
      -- Remove existing like of same type (toggle off)
      DELETE FROM public.thread_likes WHERE id = existing_like_id;
      RETURN json_build_object('success', true, 'action', 'removed', 'like_type', p_like_type);
    ELSE
      -- Update to different like type
      UPDATE public.thread_likes 
      SET like_type = p_like_type, created_at = now()
      WHERE id = existing_like_id;
      RETURN json_build_object('success', true, 'action', 'updated', 'like_type', p_like_type);
    END IF;
  ELSE
    -- Add new like
    INSERT INTO public.thread_likes (anonymous_id, thread_id, like_type)
    VALUES (p_anonymous_id, p_thread_id, p_like_type)
    RETURNING id INTO existing_like_id;
    
    RETURN json_build_object('success', true, 'action', 'added', 'like_type', p_like_type, 'like_id', existing_like_id);
  END IF;
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'Duplicate like detected');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error occurred');
END;
$$;