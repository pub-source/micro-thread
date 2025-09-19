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
  image_url?: string;
  replies?: Reply[];
  user_warnings?: UserWarning[];
}

interface Reply {
  id: string;
  content: string;
  anonymous_id?: string;
  admin_id?: string;
  created_at: string;
  user_warnings?: UserWarning[];
}

interface UserWarning {
  id: string;
  anonymous_id: string;
  warning_level: "low" | "medium" | "high";
  reason: string;
  created_at: string;
  admin_id?: string;
}

export const AdminDashboard = () => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [warnings, setWarnings] = useState<UserWarning[]>([]);
  const [replyContent, setReplyContent] = useState("");
  const [warningReason, setWarningReason] = useState("");
  const [warningLevel, setWarningLevel] = useState("low");
  const { toast } = useToast();

  useEffect(() => {
    fetchThreads();
    fetchWarnings();
  }, []);

  const fetchThreads = async () => {
    const { data: threadsData, error } = await supabase
      .from("threads")
      .select(`
        *,
        replies (*,
          user_warnings (*)
        ),
        user_warnings (*)
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

  const fetchWarnings = async () => {
    const { data: warningsData, error } = await supabase
      .from("user_warnings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch warnings",
        variant: "destructive",
      });
      return;
    }

    setWarnings(warningsData || []);
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

    // Try to get current admin user, but don't fail if we can't access it
    let adminId = null;
    try {
      const { data: adminData } = await supabase
        .from("admin_users")
        .select("id")
        .eq("email", "elmerpobs@gmail.com")
        .maybeSingle();
      
      adminId = adminData?.id || null;
    } catch (error) {
      console.log("Could not fetch admin data, proceeding without admin_id");
    }

    const { error } = await supabase
      .from("replies")
      .insert({
        thread_id: threadId,
        content: replyContent.trim(),
        admin_id: adminId,
        anonymous_id: adminId ? null : "admin_reply", // Use a fallback identifier
      });

    if (error) {
      console.error("Reply insert error:", error);
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

    // Try to get current admin user, but don't fail if we can't access it
    let adminId = null;
    try {
      const { data: adminData } = await supabase
        .from("admin_users")
        .select("id")
        .eq("email", "elmerpobs@gmail.com")
        .maybeSingle();
      
      adminId = adminData?.id || null;
    } catch (error) {
      console.log("Could not fetch admin data, proceeding without admin_id");
    }

    const { error } = await supabase
      .from("user_warnings")
      .insert({
        anonymous_id: anonymousId,
        thread_id: threadId,
        admin_id: adminId,
        warning_level: warningLevel as "low" | "medium" | "high",
        reason: warningReason.trim(),
      });

    if (error) {
      console.error("Warning insert error:", error);
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
    fetchThreads();
    fetchWarnings();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-500 text-emerald-50";
      case "archived":
        return "bg-amber-500 text-amber-50";
      case "deleted":
        return "bg-red-500 text-red-50";
      default:
        return "bg-slate-500 text-slate-50";
    }
  };

  const getWarningColor = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "low":
        return "bg-yellow-500 text-yellow-50";
      case "medium":
        return "bg-orange-500 text-orange-50";
      case "high":
        return "bg-red-500 text-red-50";
      default:
        return "bg-gray-500 text-gray-50";
    }
  };

  const getUserHighestWarning = (anonymousId: string): UserWarning | null => {
    const userWarnings = warnings.filter(w => w.anonymous_id === anonymousId);
    if (userWarnings.length === 0) return null;
    
    // Return highest priority warning (high > medium > low)
    const priorityOrder: { [key: string]: number } = { high: 3, medium: 2, low: 1 };
    return userWarnings.reduce((highest, current) => 
      priorityOrder[current.warning_level] > priorityOrder[highest.warning_level] ? current : highest
    );
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
            {threads.map((thread) => {
              const userWarning = getUserHighestWarning(thread.anonymous_id);
              
              return (
                <Card key={thread.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">
                          Thread by {thread.anonymous_id}
                        </CardTitle>
                        {userWarning && (
                          <Badge className={getWarningColor(userWarning.warning_level)}>
                            {userWarning.warning_level.toUpperCase()} WARNING
                          </Badge>
                        )}
                      </div>
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
                    {thread.image_url && (
                      <img src={thread.image_url} alt="Thread attachment" className="mt-2 max-w-sm rounded" />
                    )}
                    {userWarning && (
                      <div className="mt-2 p-2 bg-muted rounded">
                        <p className="text-sm font-medium">User Warning ({userWarning.warning_level}):</p>
                        <p className="text-sm text-muted-foreground">{userWarning.reason}</p>
                      </div>
                    )}
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
                      {thread.replies.map((reply) => {
                        const replyWarning = reply.anonymous_id ? getUserHighestWarning(reply.anonymous_id) : null;
                        
                        return (
                          <div key={reply.id} className="bg-muted p-3 rounded mb-2">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm">
                                <strong>
                                  {reply.admin_id ? "Admin" : reply.anonymous_id}:
                                </strong>
                              </p>
                              {replyWarning && (
                                <Badge className={`${getWarningColor(replyWarning.warning_level)} text-xs`}>
                                  {replyWarning.warning_level.toUpperCase()}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm">{reply.content}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(reply.created_at))} ago
                            </p>
                          </div>
                        );
                      })}
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
              );
            })}
          </TabsContent>

          <TabsContent value="warnings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Warnings ({warnings.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {warnings.length === 0 ? (
                  <p className="text-muted-foreground">No warnings issued yet.</p>
                ) : (
                  <div className="space-y-3">
                    {warnings.map((warning) => (
                      <div key={warning.id} className="border rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">User: {warning.anonymous_id}</span>
                            <Badge className={getWarningColor(warning.warning_level)}>
                              {warning.warning_level.toUpperCase()}
                            </Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(warning.created_at))} ago
                          </span>
                        </div>
                        <p className="text-sm">{warning.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};