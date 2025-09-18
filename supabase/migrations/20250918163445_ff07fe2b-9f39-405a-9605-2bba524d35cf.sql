-- Create storage bucket for feedback images
INSERT INTO storage.buckets (id, name, public) VALUES ('feedback-images', 'feedback-images', true);

-- Create RLS policies for feedback images
CREATE POLICY "Anyone can view feedback images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'feedback-images');

CREATE POLICY "Anyone can upload feedback images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'feedback-images' AND (storage.foldername(name))[1] = 'public');

-- Add image_url column to threads table
ALTER TABLE public.threads ADD COLUMN image_url TEXT;