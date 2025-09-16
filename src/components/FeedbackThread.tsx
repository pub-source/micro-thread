import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Star, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Reply {
  id: string;
  content: string;
  anonymous_id?: string;
  admin_id?: string;
  created_at: string;
}

interface Thread {
  id: string;
  content: string;
  rating: number;
  anonymous_id: string;
  created_at: string;
  replies?: Reply[];
}

interface FeedbackThreadProps {
  thread: Thread;
  onThreadUpdate: () => void;
}

export const FeedbackThread = ({ thread, onThreadUpdate }: FeedbackThreadProps) => {
  const [showReplies, setShowReplies] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (showReplies) {
      fetchReplies();
    }
  }, [showReplies, thread.id]);

  const fetchReplies = async () => {
    const { data, error } = await supabase
      .from("replies")
      .select("id, thread_id, content, anonymous_id, admin_id, created_at")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setReplies(data);
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim()) return;

    setLoading(true);
    const anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const { error } = await supabase
      .from("replies")
      .insert({
        thread_id: thread.id,
        content: replyContent.trim(),
        anonymous_id: anonymousId,
        ip_address: null, // Would normally get from request
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to post reply",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success", 
        description: "Reply posted!",
      });
      setReplyContent("");
      fetchReplies();
      onThreadUpdate();
    }
    setLoading(false);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
        }`}
      />
    ));
  };

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        {/* Main Thread */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{thread.anonymous_id}</Badge>
              <div className="flex items-center gap-1">
                {renderStars(thread.rating)}
              </div>
            </div>
            <span className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(thread.created_at))} ago
            </span>
          </div>
          
          <p className="text-foreground">{thread.content}</p>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReplies(!showReplies)}
              className="flex items-center gap-1"
            >
              <MessageCircle className="h-4 w-4" />
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </Button>
          </div>
        </div>

        {/* Replies Section */}
        {showReplies && (
          <div className="mt-4 space-y-3 border-t pt-4">
            {/* Existing Replies */}
            {replies.map((reply) => (
              <div key={reply.id} className="ml-4 p-3 bg-muted rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={reply.admin_id ? "default" : "outline"}>
                    {reply.admin_id ? "Admin" : reply.anonymous_id}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(reply.created_at))} ago
                  </span>
                </div>
                <p className="text-sm">{reply.content}</p>
              </div>
            ))}

            {/* Reply Input */}
            <div className="ml-4 space-y-2">
              <Textarea
                placeholder="Write a reply... (max 200 characters)"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value.slice(0, 200))}
                className="resize-none"
                rows={2}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {replyContent.length}/200
                </span>
                <Button
                  size="sm"
                  onClick={handleReply}
                  disabled={!replyContent.trim() || loading}
                  className="flex items-center gap-1"
                >
                  <Send className="h-3 w-3" />
                  Reply
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
