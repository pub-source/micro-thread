import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface News {
  id: string;
  title: string;
  content: string;
  display_order: number;
}

export const NewsBar = () => {
  const [news, setNews] = useState<News[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    fetchNews();
  }, []);

  useEffect(() => {
    if (news.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % news.length);
      }, 5000); // Change news every 5 seconds

      return () => clearInterval(interval);
    }
  }, [news.length]);

  const fetchNews = async () => {
    const { data, error } = await supabase
      .from("news")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (!error && data) {
      setNews(data);
    }
  };

  if (!isVisible || news.length === 0) return null;

  const currentNews = news[currentIndex];

  return (
    <div className="bg-primary text-primary-foreground p-4 sticky top-0 z-50 shadow-md">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-sm">{currentNews?.title}</h3>
          <p className="text-xs mt-1 opacity-90">{currentNews?.content}</p>
        </div>
        <div className="flex items-center gap-2">
          {news.length > 1 && (
            <div className="flex gap-1">
              {news.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full ${
                    index === currentIndex ? "bg-primary-foreground" : "bg-primary-foreground/40"
                  }`}
                />
              ))}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="text-primary-foreground hover:text-primary-foreground/80 h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};