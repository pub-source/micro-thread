import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Star, Send } from "lucide-react";
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
  const { toast } = useToast();

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
    
    const anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const { error } = await supabase
      .from("threads")
      .insert({
        content: content.trim(),
        rating,
        anonymous_id: anonymousId,
        ip_address: null, // Would normally get from request
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
      onFeedbackSubmitted();
    }
    setLoading(false);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Share Your Feedback</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Rating */}
          <div>
            <label className="text-sm font-medium mb-2 block">Rate your experience</label>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className={`h-6 w-6 cursor-pointer transition-colors ${
                    i < (hoverRating || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300 hover:text-yellow-200"
                  }`}
                  onClick={() => setRating(i + 1)}
                  onMouseEnter={() => setHoverRating(i + 1)}
                  onMouseLeave={() => setHoverRating(0)}
                />
              ))}
              {rating > 0 && (
                <span className="ml-2 text-sm text-muted-foreground">
                  {rating}/5
                </span>
              )}
            </div>
          </div>

          {/* Feedback Content */}
          <div>
            <label className="text-sm font-medium mb-2 block">Your feedback</label>
            <Textarea
              placeholder="Share your thoughts... (max 60 characters)"
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 60))}
              className="resize-none"
              rows={3}
            />
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-muted-foreground">
                {content.length}/60 characters
              </span>
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={loading || !content.trim() || rating === 0}
            className="w-full flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            {loading ? "Submitting..." : "Submit Feedback"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};