import { useState, useEffect } from 'react';
import { db, collection, query, where, orderBy, onSnapshot, handleFirestoreError, OperationType } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, User, Tag, ArrowLeft, ChevronRight, Loader2, BookOpen, Share2, Printer } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Button from './ui/Button';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  author: string;
  imageUrl: string;
  imageAlt?: string;
  imageCredit?: string;
  tags: string[];
  status: 'draft' | 'published';
  publishedAt: any;
  createdAt: any;
  updatedAt: any;
}

export default function Writings() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPost, setCurrentPost] = useState<BlogPost | null>(null);

  const handleShare = async () => {
    if (!currentPost) return;
    
    // Web Share API (Mobile native share sheet, desktop support in Safari/Edge)
    if (navigator.share) {
      try {
        await navigator.share({
          title: currentPost.title,
          text: currentPost.excerpt || `Read "${currentPost.title}" by ${currentPost.author}`,
          url: window.location.href,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: Copy Link
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  useEffect(() => {
    const q = query(
      collection(db, 'blog_posts'),
      where('status', '==', 'published'),
      orderBy('publishedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BlogPost[];
      setPosts(postsData);
      setLoading(false);

      if (slug) {
        const post = postsData.find(p => p.slug === slug);
        if (post) {
          setCurrentPost(post);
        } else {
          // If not found in the initial fetch, maybe it's not published or doesn't exist
          // We'll handle this by navigating back if we can't find it
          // Wait a bit to ensure it's not just a slow fetch
          setTimeout(() => {
             if (!postsData.find(p => p.slug === slug)) {
                // Check if we already have it from a direct fetch if needed, 
                // but usually the subscription is enough.
             }
          }, 1000);
        }
      } else {
        setCurrentPost(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'blog_posts'));

    return () => unsubscribe();
  }, [slug]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        if (currentPost) {
          e.preventDefault();
          navigate(`/writings/${currentPost.slug}/print`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPost, navigate]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={40} />
      </div>
    );
  }

  if (slug && !currentPost) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl font-serif mb-6">Writing Not Found</h1>
        <p className="text-ink/60 mb-10">The piece you're looking for might have been moved or archived.</p>
        <Button onClick={() => navigate('/writings')} variant="primary" magnetic={true} icon={ArrowLeft}>
          Back to Writings
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-24 print:p-0 print:m-0 print:max-w-none">
      {currentPost && (
        <Helmet>
          <title>{currentPost.title} - Writings</title>
          <meta name="description" content={currentPost.excerpt} />
          <meta property="og:title" content={currentPost.title} />
          <meta property="og:description" content={currentPost.excerpt} />
          {currentPost.imageUrl && <meta property="og:image" content={currentPost.imageUrl} />}
          <meta property="og:type" content="article" />
          <meta property="og:url" content={window.location.href} />
          <meta name="twitter:card" content={currentPost.imageUrl ? 'summary_large_image' : 'summary'} />
          <meta name="twitter:title" content={currentPost.title} />
          <meta name="twitter:description" content={currentPost.excerpt} />
          {currentPost.imageUrl && <meta name="twitter:image" content={currentPost.imageUrl} />}
        </Helmet>
      )}
      <AnimatePresence mode="wait">
        {currentPost ? (
          <motion.article
            key="post"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-4xl mx-auto"
          >
            <div className="flex items-center justify-between mb-12 print:hidden">
              <Link 
                to="/writings" 
                className="inline-flex items-center space-x-2 text-[10px] uppercase tracking-widest text-ink/40 hover:text-accent transition-colors group"
              >
                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                <span>Back to writings</span>
              </Link>
              <button
                onClick={() => navigate(`/writings/${currentPost.slug}/print`)}
                className="inline-flex items-center space-x-2 text-[10px] uppercase tracking-widest text-ink/40 hover:text-accent transition-colors"
                title="Print or Save as PDF"
              >
                <Printer size={14} />
                <span>Save as PDF</span>
              </button>
            </div>

            <header className="mb-16">
              <div className="flex flex-wrap gap-3 mb-8">
                {currentPost.tags?.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-accent/10 text-accent text-[8px] uppercase tracking-widest font-black rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
              <h1 className="text-4xl md:text-6xl font-serif tracking-tight leading-tight mb-8">
                {currentPost.title}
              </h1>
              <div className="flex flex-wrap items-center gap-6 text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">
                <div className="flex items-center space-x-2">
                  <User size={14} className="text-accent" />
                  <span>{currentPost.author}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar size={14} className="text-accent" />
                  <span>
                    {currentPost.publishedAt?.toDate().toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            </header>

            {currentPost.imageUrl && (
              <figure className="mb-16">
                <div className="rounded-[40px] overflow-hidden shadow-2xl border border-ink/5 bg-ink/5">
                  <img 
                    src={currentPost.imageUrl} 
                    alt={currentPost.imageAlt || currentPost.title} 
                    className="w-full h-auto object-contain max-h-[70vh]"
                  />
                </div>
                {currentPost.imageCredit && (
                  <figcaption 
                    className="text-sm text-center text-ink/50 italic mt-4 [&_a]:underline [&_a]:hover:text-ink transition-colors"
                    dangerouslySetInnerHTML={{ __html: currentPost.imageCredit }}
                  />
                )}
              </figure>
            )}

            <div className="prose prose-lg prose-p:text-ink prose-headings:text-ink prose-li:text-ink prose-strong:text-ink dark:prose-invert max-w-none prose-headings:font-serif prose-headings:tracking-tight prose-a:text-accent hover:prose-a:opacity-80 transition-all">
              {currentPost.content.trim().startsWith('<') ? (
                <div dangerouslySetInnerHTML={{ __html: currentPost.content }} />
              ) : (
                <ReactMarkdown>{currentPost.content}</ReactMarkdown>
              )}
            </div>

            <footer className="mt-20 pt-10 border-t border-ink/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white font-serif text-xl italic font-black">
                    {currentPost.author[0]}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-ink/40">Written by</p>
                    <p className="text-sm font-serif">{currentPost.author}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                   <Button variant="ghost" size="sm" icon={Share2} magnetic={true} onClick={handleShare}>Share</Button>
                </div>
              </div>
            </footer>
          </motion.article>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-center mb-24">
              <h1 className="text-5xl md:text-7xl font-serif tracking-tight mb-6">Collected Writings</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {posts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="group"
                >
                  <Link to={`/writings/${post.slug}`} className="block space-y-6">
                    <div className="aspect-[4/3] rounded-[32px] overflow-hidden bg-ink/5 border border-ink/5 relative">
                      {post.imageUrl ? (
                        <img 
                          src={post.imageUrl} 
                          alt={post.title} 
                          className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-ink/10">
                          <BookOpen size={64} />
                        </div>
                      )}
                      <div className="absolute top-6 left-6">
                        <div className="px-3 py-1 bg-surface/90 backdrop-blur-md rounded-full text-[8px] uppercase tracking-widest font-black text-ink shadow-sm">
                          {post.tags?.[0] || 'Writing'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-[8px] uppercase tracking-widest text-ink/40 font-black">
                        <span>{post.publishedAt?.toDate().toLocaleDateString()}</span>
                        <div className="w-8 h-px bg-accent/20" />
                        <span>{Math.ceil(post.content.split(' ').length / 200)} min read</span>
                      </div>
                      <h3 className="text-2xl font-serif tracking-tight group-hover:text-accent transition-colors leading-tight">
                        {post.title}
                      </h3>
                      <p className="text-[11px] text-ink/50 leading-relaxed line-clamp-3 uppercase tracking-tight">
                        {post.excerpt}
                      </p>
                      <div className="pt-2 flex items-center space-x-2 text-[9px] uppercase tracking-widest font-black text-accent group-hover:translate-x-2 transition-transform">
                        <span>Read Full Piece</span>
                        <ChevronRight size={14} />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {posts.length === 0 && (
              <div className="text-center py-40 bg-ink/[0.02] rounded-[40px] border border-dashed border-ink/10">
                <BookOpen size={48} className="mx-auto text-ink/10 mb-6" />
                <p className="text-[10px] uppercase tracking-widest text-ink/40 font-black">No pieces published yet</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
