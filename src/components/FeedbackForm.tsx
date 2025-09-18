import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Star, Send, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FeedbackFormProps {
  onFeedbackSubmitted: () => void;
}

export const FeedbackForm = ({ onFeedbackSubmitted }: FeedbackFormProps) => {
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedImage) return null;

    const fileExt = selectedImage.name.split('.').pop();
    const fileName = `public/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

    const { error } = await supabase.storage
      .from('feedback-images')
      .upload(fileName, selectedImage);

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('feedback-images')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Please enter your feedback",
        variant: "destructive",
      });
      return;
    }

    if (rating === 0) {
      toast({
        title: "Error", 
        description: "Please select a rating",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Upload image if selected
      let imageUrl = null;
      if (selectedImage) {
        imageUrl = await uploadImage();
      }

      const { error } = await supabase
        .from("threads")
        .insert({
          content: content.trim(),
          rating,
          anonymous_id: anonymousId,
          ip_address: null, // Would normally get from request
          image_url: imageUrl,
        });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to submit feedback",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Feedback submitted successfully!",
        });
        setContent("");
        setRating(0);
        removeImage();
        onFeedbackSubmitted();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit feedback",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-xl sm:text-2xl">Share Your Feedback</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rating */}
          <div>
            <label className="text-sm font-medium mb-3 block">Rate your experience</label>
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className={`h-10 w-10 sm:h-12 sm:w-12 cursor-pointer transition-all duration-200 transform hover:scale-110 ${
                    i < (hoverRating || rating)
                      ? "fill-yellow-400 text-yellow-400 drop-shadow-lg"
                      : "text-muted-foreground hover:text-yellow-300 hover:drop-shadow-md"
                  }`}
                  onClick={() => setRating(i + 1)}
                  onMouseEnter={() => setHoverRating(i + 1)}
                  onMouseLeave={() => setHoverRating(0)}
                />
              ))}
              {rating > 0 && (
                <span className="ml-2 text-base font-medium text-muted-foreground">
                  {rating}/5
                </span>
              )}
            </div>
          </div>

          {/* Feedback Content */}
          <div>
            <label className="text-sm font-medium mb-3 block">Your feedback</label>
            <Textarea
              placeholder="Share your thoughts... (max 60 characters)"
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 60))}
              className="resize-none min-h-[100px] text-base"
              rows={4}
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-muted-foreground">
                {content.length}/60 characters
              </span>
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <label className="text-sm font-medium mb-3 block">Attach an image (optional, max 5MB)</label>
            {!imagePreview ? (
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Click to upload an image
                  </span>
                </label>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full max-h-48 object-cover rounded-lg"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={removeImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <Button
            type="submit" 
            disabled={loading || !content.trim() || rating === 0}
            className="w-full flex items-center justify-center gap-2 h-12 text-base font-medium"
          >
            <Send className="h-5 w-5" />
            {loading ? "Submitting..." : "Submit Feedback"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};