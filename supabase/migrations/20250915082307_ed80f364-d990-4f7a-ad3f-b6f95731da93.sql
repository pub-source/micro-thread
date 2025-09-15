-- Create enum types
CREATE TYPE thread_status AS ENUM ('active', 'archived', 'deleted');
CREATE TYPE user_warning_level AS ENUM ('low', 'medium', 'high');

-- Create threads table (main feedback posts)
CREATE TABLE public.threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL CHECK (length(content) <= 60),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  anonymous_id TEXT NOT NULL, -- for anonymous users
  ip_address INET,
  status thread_status DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create replies table
CREATE TABLE public.replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID REFERENCES public.threads(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) <= 200),
  anonymous_id TEXT,
  admin_id UUID, -- for admin replies
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT check_either_anonymous_or_admin CHECK (
    (anonymous_id IS NOT NULL AND admin_id IS NULL) OR 
    (anonymous_id IS NULL AND admin_id IS NOT NULL)
  )
);

-- Create admin users table
CREATE TABLE public.admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Create user warnings table for moderation
CREATE TABLE public.user_warnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  anonymous_id TEXT NOT NULL,
  thread_id UUID REFERENCES public.threads(id),
  reply_id UUID REFERENCES public.replies(id),
  admin_id UUID REFERENCES public.admin_users(id),
  warning_level user_warning_level DEFAULT 'low',
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT check_warning_target CHECK (
    (thread_id IS NOT NULL AND reply_id IS NULL) OR 
    (thread_id IS NULL AND reply_id IS NOT NULL)
  )
);

-- Create news/announcements table (hovering news above)
CREATE TABLE public.news (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

-- RLS Policies for public access to threads and replies
CREATE POLICY "Anyone can view active threads" ON public.threads
  FOR SELECT USING (status = 'active');

CREATE POLICY "Anyone can insert threads" ON public.threads
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view replies" ON public.replies
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert replies" ON public.replies
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view active news" ON public.news
  FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Admin policies (will be updated when auth is implemented)
CREATE POLICY "Only admins can access admin_users" ON public.admin_users
  FOR ALL USING (false); -- Will update when auth is ready

CREATE POLICY "Only admins can access warnings" ON public.user_warnings
  FOR ALL USING (false); -- Will update when auth is ready

-- Create indexes for performance
CREATE INDEX idx_threads_status ON public.threads(status);
CREATE INDEX idx_threads_created_at ON public.threads(created_at DESC);
CREATE INDEX idx_replies_thread_id ON public.replies(thread_id);
CREATE INDEX idx_replies_created_at ON public.replies(created_at DESC);
CREATE INDEX idx_news_active ON public.news(is_active, display_order);

-- Create function to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_threads_updated_at
  BEFORE UPDATE ON public.threads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_replies_updated_at
  BEFORE UPDATE ON public.replies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample news item
INSERT INTO public.news (title, content, display_order) 
VALUES ('Welcome to Feedback Hub', 'Share your thoughts and connect with others! Rate and provide feedback up to 60 words.', 1);