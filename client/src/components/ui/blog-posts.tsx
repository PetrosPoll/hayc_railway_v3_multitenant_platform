
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { ArrowRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";

interface BlogPost {
  id: number;
  title: string;
  excerpt: string;
  content: string;
  publishedAt: string;
  slug: string;
  imageUrl: string;
}

export function BlogPosts() {
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  
  const posts = {
    posts: [
      {
        id: 1,
        title: "The Future of Web Development",
        excerpt: "Exploring the latest trends and technologies shaping modern web development",
        content: "Web development is constantly evolving, with new frameworks, tools, and best practices emerging regularly. This article explores the most significant trends that are shaping the future of web development, including AI-powered development tools, WebAssembly, and edge computing.",
        publishedAt: "2024-03-01",
        slug: "future-web-development",
        imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085"
      },
      {
        id: 2,
        title: "Getting Started with React",
        excerpt: "A comprehensive guide for beginners learning React",
        content: "React has become one of the most popular JavaScript libraries for building user interfaces. This guide covers the fundamental concepts of React, including components, state management, and hooks, providing a solid foundation for beginners.",
        publishedAt: "2024-02-28",
        slug: "react-beginners-guide",
        imageUrl: "https://images.unsplash.com/photo-1633356122544-f134324a6cee"
      },
      {
        id: 3,
        title: "Optimizing Website Performance",
        excerpt: "Essential tips for improving your website's speed and efficiency",
        content: "Website performance is crucial for user experience and SEO. Learn about key optimization techniques including image optimization, code splitting, lazy loading, and caching strategies to make your website faster and more efficient.",
        publishedAt: "2024-02-25",
        slug: "website-optimization",
        imageUrl: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6"
      }
    ]
  };

  if (!posts.posts.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Τελευταία άρθρα</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Δεν υπάρχουν διαθέσιμα άρθρα.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Τελευταία άρθρα</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {posts.posts.map((post) => (
              <div 
                key={post.id} 
                className="flex gap-4 border rounded-lg p-4 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedPost(post)}
              >
                <div className="flex-shrink-0">
                  <img 
                    src={post.imageUrl} 
                    alt={post.title}
                    className="w-32 h-32 object-cover rounded-lg"
                  />
                </div>
                <div className="flex flex-col flex-grow">
                  <h3 className="font-semibold text-lg mb-2">{post.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2 flex-grow">{post.excerpt}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {new Date(post.publishedAt).toLocaleDateString('el')}
                    </span>
                    <Button variant="link" className="px-0 text-dark">
                      Διαβάστε περισσότερα <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedPost && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedPost.title}</DialogTitle>
              </DialogHeader>
              <img 
                src={selectedPost.imageUrl} 
                alt={selectedPost.title}
                className="w-full h-64 object-cover rounded-lg mb-4"
              />
              <div className="prose prose-sm max-w-none">
                {selectedPost.content}
              </div>
              <div className="text-sm text-muted-foreground mt-4">
                Published on {new Date(selectedPost.publishedAt).toLocaleDateString('el')}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
