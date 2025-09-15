import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface Thread {
  id: string;
  content: string;
  rating: number;
  anonymous_id: string;
  status: string;
  created_at: string;
  replies?: Reply[];
}

interface Reply {
  id: string;
  content: string;
  anonymous_id?: string;
  admin_id?: string;
  created_at: string;
}

export const AdminDashboard = () => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [replyContent, setReplyContent] = useState("");
  const [warningReason, setWarningReason] = useState("");
  const [warningLevel, setWarningLevel] = useState("low");
  const { toast } = useToast();

  useEffect(() => {
    fetchThreads();
  }, []);

  const fetchThreads = async () => {
    const { data: threadsData, error } = await supabase
      .from("threads")
      .select(`
        *,
        replies (*)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch threads",
        variant: "destructive",
      });
      return;
    }

    setThreads(threadsData || []);
  };

  const archiveThread = async (threadId: string) => {
    const { error } = await supabase
      .from("threads")
      .update({ status: "archived" })
      .eq("id", threadId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to archive thread",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Thread archived",
    });
    fetchThreads();
  };

  const deleteThread = async (threadId: string) => {
    const { error } = await supabase
      .from("threads")
      .update({ status: "deleted" })
      .eq("id", threadId);

    if (error) {
      toast({
        title: "Error", 
        description: "Failed to delete thread",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Thread deleted",
    });
    fetchThreads();
  };

  const addReply = async (threadId: string) => {
    if (!replyContent.trim()) return;

    const { error } = await supabase
      .from("replies")
      .insert({
        thread_id: threadId,
        content: replyContent.trim(),
        admin_id: "admin-123", // Mock admin ID
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add reply",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Reply added",
    });
    setReplyContent("");
    fetchThreads();
  };

  const warnUser = async (anonymousId: string, threadId: string) => {
    if (!warningReason.trim()) return;

    const { error } = await supabase
      .from("user_warnings")
      .insert({
        anonymous_id: anonymousId,
        thread_id: threadId,
        admin_id: "admin-123", // Mock admin ID
        warning_level: warningLevel as "low" | "medium" | "high",
        reason: warningReason.trim(),
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to warn user",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "User warning issued",
    });
    setWarningReason("");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "archived":
        return "bg-yellow-500";
      case "deleted":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
        
        <Tabs defaultValue="threads" className="space-y-4">
          <TabsList>
            <TabsTrigger value="threads">Manage Threads</TabsTrigger>
            <TabsTrigger value="warnings">User Warnings</TabsTrigger>
          </TabsList>

          <TabsContent value="threads" className="space-y-4">
            {threads.map((thread) => (
              <Card key={thread.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Thread by {thread.anonymous_id}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(thread.status)}>
                        {thread.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(thread.created_at))} ago
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Rating: {thread.rating}/5</p>
                    <p className="mt-2">{thread.content}</p>
                  </div>

                  {thread.status === "active" && (
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => archiveThread(thread.id)}
                      >
                        Archive
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => deleteThread(thread.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}

                  {/* Replies */}
                  {thread.replies && thread.replies.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-2">Replies ({thread.replies.length})</h4>
                      {thread.replies.map((reply) => (
                        <div key={reply.id} className="bg-muted p-3 rounded mb-2">
                          <p className="text-sm">
                            <strong>
                              {reply.admin_id ? "Admin" : reply.anonymous_id}:
                            </strong>{" "}
                            {reply.content}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(reply.created_at))} ago
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Reply */}
                  <div className="border-t pt-4">
                    <Textarea
                      placeholder="Add admin reply..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      className="mb-2"
                    />
                    <Button 
                      size="sm"
                      onClick={() => addReply(thread.id)}
                      disabled={!replyContent.trim()}
                    >
                      Add Reply
                    </Button>
                  </div>

                  {/* Warn User */}
                  <div className="border-t pt-4">
                    <div className="flex gap-2 mb-2">
                      <Select value={warningLevel} onValueChange={setWarningLevel}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea
                      placeholder="Warning reason..."
                      value={warningReason}
                      onChange={(e) => setWarningReason(e.target.value)}
                      className="mb-2"
                    />
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => warnUser(thread.anonymous_id, thread.id)}
                      disabled={!warningReason.trim()}
                    >
                      Warn User
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="warnings">
            <Card>
              <CardHeader>
                <CardTitle>User Warnings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Warning management will be implemented here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};