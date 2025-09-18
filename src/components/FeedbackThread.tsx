import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MessageCircle, Star, Send, ThumbsUp, ThumbsDown, AlertTriangle, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Reply {
  id: string;
  content: string;
  anonymous_id?: string;
  admin_id?: string;
  created_at: string;
}

interface UserWarning {
  anonymous_id: string;
  warning_level: 'low' | 'medium' | 'high';
  reason: string;
  created_at: string;
}

interface Thread {
  id: string;
  content: string;
  rating: number;
  anonymous_id: string;
  created_at: string;
  image_url?: string;
  replies?: Reply[];
}

interface ThreadLike {
  id: string;
  thread_id: string;
  anonymous_id: string;
  like_type: 'like' | 'dislike';
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
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [userLike, setUserLike] = useState<'like' | 'dislike' | null>(null);
  const [userWarnings, setUserWarnings] = useState<Map<string, UserWarning>>(new Map());
  const { toast } = useToast();

  useEffect(() => {
    if (showReplies) {
      fetchReplies();
    }
    fetchLikes();
    fetchUserWarnings();
  }, [showReplies, thread.id]);

  const fetchReplies = async () => {
    const { data, error } = await supabase
      .from("replies")
      .select("id, thread_id, content, anonymous_id, admin_id, created_at")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setReplies(data);
      // Fetch warnings for new reply authors
      fetchUserWarnings();
    }
  };

  const fetchUserWarnings = async () => {
    // Collect all anonymous_ids from thread and replies
    const anonymousIds = [thread.anonymous_id];
    replies.forEach(reply => {
      if (reply.anonymous_id && !reply.admin_id) {
        anonymousIds.push(reply.anonymous_id);
      }
    });

    if (anonymousIds.length === 0) return;

    // Fetch latest warning for each user
    const { data } = await supabase
      .from("user_warnings")
      .select("anonymous_id, warning_level, reason, created_at")
      .in("anonymous_id", anonymousIds)
      .order("created_at", { ascending: false });

    if (data) {
      const warningsMap = new Map<string, UserWarning>();
      data.forEach(warning => {
        if (!warningsMap.has(warning.anonymous_id)) {
          warningsMap.set(warning.anonymous_id, warning);
        }
      });
      setUserWarnings(warningsMap);
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

  const fetchLikes = async () => {
    const { data } = await supabase
      .from("thread_likes")
      .select("*")
      .eq("thread_id", thread.id);

    if (data) {
      const likesCount = data.filter(like => like.like_type === 'like').length;
      const dislikesCount = data.filter(like => like.like_type === 'dislike').length;
      setLikes(likesCount);
      setDislikes(dislikesCount);

      // Check if current user has liked/disliked - for now, we'll use a simple localStorage approach
      const storedUserInteraction = localStorage.getItem(`thread_${thread.id}_interaction`);
      setUserLike(storedUserInteraction as 'like' | 'dislike' || null);
    }
  };

  const handleLike = async (type: 'like' | 'dislike') => {
    // Generate a unique identifier for this session
    const sessionId = localStorage.getItem('user_session') || 
                     `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (!localStorage.getItem('user_session')) {
      localStorage.setItem('user_session', sessionId);
    }
    
    // If user is changing their vote or removing it
    if (userLike === type) {
      // Remove the like/dislike
      const { error } = await supabase
        .from("thread_likes")
        .delete()
        .eq("thread_id", thread.id)
        .eq("anonymous_id", sessionId);

      if (!error) {
        setUserLike(null);
        localStorage.removeItem(`thread_${thread.id}_interaction`);
        fetchLikes();
      }
    } else {
      // Add new like/dislike or update existing
      const { error } = await supabase
        .from("thread_likes")
        .upsert({
          thread_id: thread.id,
          anonymous_id: sessionId,
          like_type: type,
        });

      if (!error) {
        setUserLike(type);
        localStorage.setItem(`thread_${thread.id}_interaction`, type);
        fetchLikes();
        toast({
          title: "Success",
          description: `Thread ${type}d!`,
        });
      } else {
        toast({
          title: "Error",
          description: `Failed to ${type} thread`,
          variant: "destructive",
        });
      }
    }
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

  const getWarningBadge = (anonymousId: string) => {
    const warning = userWarnings.get(anonymousId);
    if (!warning) return null;

    const getWarningColor = (level: string) => {
      switch (level) {
        case 'low': return 'bg-yellow-500 hover:bg-yellow-600';
        case 'medium': return 'bg-orange-500 hover:bg-orange-600';
        case 'high': return 'bg-red-500 hover:bg-red-600';
        default: return 'bg-gray-500 hover:bg-gray-600';
      }
    };

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`text-white ${getWarningColor(warning.warning_level)} ml-2 h-6 px-2 text-xs`}
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            {warning.warning_level}
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 p-3 bg-background border border-border shadow-lg z-50">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={`text-white ${getWarningColor(warning.warning_level)}`}>
                {warning.warning_level} warning
              </Badge>
            </div>
            <p className="text-sm text-foreground">{warning.reason}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(warning.created_at))} ago
            </p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const getStatusIndicator = (anonymousId: string) => {
    const warning = userWarnings.get(anonymousId);
    if (!warning) return <div className="w-1 h-full bg-green-500 rounded-full" />;

    const getColor = (level: string) => {
      switch (level) {
        case 'low': return 'bg-yellow-500';
        case 'medium': return 'bg-orange-500';
        case 'high': return 'bg-red-500';
        default: return 'bg-green-500';
      }
    };

    return <div className={`w-1 h-full ${getColor(warning.warning_level)} rounded-full`} />;
  };

  return (
    <Card className="w-full flex">
      {/* Status Indicator */}
      <div className="flex flex-col justify-center p-1">
        {getStatusIndicator(thread.anonymous_id)}
      </div>
      
      <CardContent className="p-4 flex-1">
        {/* Main Thread */}
        <div className="space-y-3">
          <div className="flex items-center justify-between min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center">
                <Badge variant="secondary" className="max-w-[50vw] truncate">
                  {thread.anonymous_id}
                </Badge>
                {getWarningBadge(thread.anonymous_id)}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {renderStars(thread.rating)}
              </div>
            </div>
            <span className="text-sm text-muted-foreground flex-shrink-0">
              {formatDistanceToNow(new Date(thread.created_at))} ago
            </span>
          </div>
          
          <p className="text-foreground">{thread.content}</p>

          {/* Display image if available */}
          {thread.image_url && (
            <div className="mt-3">
              <img
                src={thread.image_url}
                alt="Feedback attachment"
                className="max-w-full max-h-64 object-cover rounded-lg border"
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2">
              <Button
                variant={userLike === 'like' ? "default" : "ghost"}
                size="sm"
                onClick={() => handleLike('like')}
                className="flex items-center gap-1"
              >
                <ThumbsUp className="h-4 w-4" />
                {likes}
              </Button>
              <Button
                variant={userLike === 'dislike' ? "default" : "ghost"}
                size="sm"
                onClick={() => handleLike('dislike')}
                className="flex items-center gap-1"
              >
                <ThumbsDown className="h-4 w-4" />
                {dislikes}
              </Button>
            </div>
          </div>
        </div>

        {/* Replies Section */}
        {showReplies && (
          <div className="mt-4 space-y-3 border-t pt-4">
            {/* Existing Replies */}
            {replies.map((reply) => (
              <div key={reply.id} className="ml-4 p-3 bg-muted rounded-md">
                <div className="flex items-center justify-between mb-2 min-w-0">
                  <div className="flex items-center">
                    <Badge variant={reply.admin_id ? "default" : "outline"} className="max-w-[60vw] truncate">
                      {reply.admin_id ? "Admin" : reply.anonymous_id}
                    </Badge>
                    {!reply.admin_id && reply.anonymous_id && getWarningBadge(reply.anonymous_id)}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
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
