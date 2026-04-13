import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Newspaper, Plus, Pin, PinOff, Trash2, Image, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { NewsPost } from "@/lib/types";
import { saveToStorage, loadFromStorage } from "@/lib/storage";
import { saveImage, loadImage, deleteImage } from "@/lib/storage";

const STORAGE_KEY = "news_posts";

const NewsFeed = () => {
  const [posts, setPosts] = useState<NewsPost[]>(() => loadFromStorage<NewsPost[]>(STORAGE_KEY, []));
  const [showNew, setShowNew] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newImage, setNewImage] = useState<string | null>(null);
  const [imageCache, setImageCache] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { saveToStorage(STORAGE_KEY, posts); }, [posts]);

  // Load images for posts
  useEffect(() => {
    const loadImages = async () => {
      const cache: Record<string, string> = {};
      for (const post of posts) {
        if (post.imageId && !imageCache[post.imageId]) {
          const img = await loadImage(post.imageId);
          if (img) cache[post.imageId] = img;
        }
      }
      if (Object.keys(cache).length > 0) {
        setImageCache(prev => ({ ...prev, ...cache }));
      }
    };
    loadImages();
  }, [posts]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Maksymalny rozmiar: 5MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setNewImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePost = async () => {
    if (!newContent.trim() && !newImage) return;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    let imageId: string | undefined;
    if (newImage) {
      imageId = "img_" + id;
      await saveImage(imageId, newImage);
      setImageCache(prev => ({ ...prev, [imageId!]: newImage! }));
    }
    const post: NewsPost = {
      id,
      content: newContent.trim(),
      imageId,
      date: new Date().toISOString(),
    };
    setPosts(prev => [post, ...prev]);
    setNewContent("");
    setNewImage(null);
    setShowNew(false);
  };

  const handleDelete = async (post: NewsPost) => {
    if (post.imageId) await deleteImage(post.imageId);
    setPosts(prev => prev.filter(p => p.id !== post.id));
  };

  const togglePin = (id: string) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, pinned: !p.pinned } : p));
  };

  const sorted = [...posts].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <section className="py-6">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Newspaper className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-heading font-bold text-foreground">Aktualności</h2>
          </div>
          <Button size="sm" onClick={() => setShowNew(!showNew)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Nowy post
          </Button>
        </div>

        {/* New post form */}
        <AnimatePresence>
          {showNew && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                <Textarea
                  placeholder="Co nowego w świecie CS:GO..."
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  className="bg-secondary/50 border-border min-h-[100px] resize-none"
                />
                {newImage && (
                  <div className="relative inline-block">
                    <img src={newImage} alt="Preview" className="max-h-48 rounded-md" />
                    <button
                      onClick={() => setNewImage(null)}
                      className="absolute top-1 right-1 bg-background/80 rounded-full p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={handleImageSelect} />
                    <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                      <Image className="w-4 h-4 mr-1" /> Zdjęcie
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setShowNew(false); setNewContent(""); setNewImage(null); }}>
                      Anuluj
                    </Button>
                    <Button size="sm" onClick={handlePost} disabled={!newContent.trim() && !newImage}>
                      Opublikuj
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Posts */}
        <div className="space-y-4">
          {sorted.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-mono text-sm">Brak postów. Dodaj pierwszy!</p>
            </div>
          )}
          {sorted.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.3) }}
              className={cn(
                "bg-card border rounded-lg p-4",
                post.pinned ? "border-primary/40 bg-primary/5" : "border-border"
              )}
            >
              {post.pinned && (
                <div className="flex items-center gap-1 text-primary text-xs font-mono mb-2">
                  <Pin className="w-3 h-3" /> Przypięty
                </div>
              )}
              {post.content && (
                <p className="text-foreground text-sm whitespace-pre-wrap mb-3">{post.content}</p>
              )}
              {post.imageId && imageCache[post.imageId] && (
                <img
                  src={imageCache[post.imageId]}
                  alt="Post"
                  className="rounded-md max-w-full mb-3"
                />
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-mono">
                  <Clock className="w-3 h-3" />
                  {formatDate(post.date)}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => togglePin(post.id)}
                    title={post.pinned ? "Odepnij" : "Przypnij"}
                  >
                    {post.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(post)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NewsFeed;
