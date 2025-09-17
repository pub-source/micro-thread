-- Add admin user
INSERT INTO public.admin_users (email, username, password_hash) 
VALUES (
  'elmerpobs@gmail.com', 
  'elmer4321', 
  crypt('elmer4321', gen_salt('bf'))
);

-- Create table for thread likes/dislikes
CREATE TABLE public.thread_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL,
  anonymous_id TEXT NOT NULL,
  like_type TEXT NOT NULL CHECK (like_type IN ('like', 'dislike')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(thread_id, anonymous_id)
);

-- Enable RLS on thread_likes
ALTER TABLE public.thread_likes ENABLE ROW LEVEL SECURITY;

-- Policy for public to view likes
CREATE POLICY "Public can view thread likes" 
ON public.thread_likes 
FOR SELECT 
USING (true);

-- Policy for public to insert their own likes
CREATE POLICY "Public can insert their own likes" 
ON public.thread_likes 
FOR INSERT 
WITH CHECK (true);

-- Policy for public to update their own likes
CREATE POLICY "Public can update their own likes" 
ON public.thread_likes 
FOR UPDATE 
USING (true);

-- Policy for public to delete their own likes
CREATE POLICY "Public can delete their own likes" 
ON public.thread_likes 
FOR DELETE 
USING (true);

-- Add some sample news items for cycling
INSERT INTO public.news (title, content, display_order, is_active) VALUES
  ('Welcome to our platform!', 'We are excited to have you here. Share your feedback and help us improve.', 1, true),
  ('New features coming soon', 'Stay tuned for exciting updates including enhanced user experience.', 2, true),
  ('Community guidelines', 'Please be respectful in your feedback and follow our community standards.', 3, true),
  ('System maintenance', 'Scheduled maintenance this weekend. Service may be briefly interrupted.', 4, true);