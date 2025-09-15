import { useState, useEffect } from "react";
import { NewsBar } from "@/components/NewsBar";
import { FeedbackForm } from "@/components/FeedbackForm";
import { FeedbackThread } from "@/components/FeedbackThread";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Thread {
  id: string;
  content: string;
  rating: number;
  anonymous_id: string;
  created_at: string;
}

const Index = () => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchThreads();
    
    // Subscribe to real-time updates for new threads
    const channel = supabase
      .channel('threads-channel')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'threads' }, 
        () => {
          fetchThreads();
        }
      )
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'threads' }, 
        () => {
          fetchThreads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchThreads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("threads")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch feedback threads",
        variant: "destructive",
      });
    } else {
      setThreads(data || []);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <NewsBar />
      
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="text-center py-8">
          <h1 className="text-4xl font-bold mb-2">Feedback Hub</h1>
          <p className="text-muted-foreground">
            Share your thoughts anonymously and connect with the community
          </p>
        </div>

        <FeedbackForm onFeedbackSubmitted={fetchThreads} />

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Recent Feedback</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading feedback...</p>
            </div>
          ) : threads.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No feedback yet. Be the first to share your thoughts!
              </p>
            </div>
          ) : (
            threads.map((thread) => (
              <FeedbackThread
                key={thread.id}
                thread={thread}
                onThreadUpdate={fetchThreads}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
