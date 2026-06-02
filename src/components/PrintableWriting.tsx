import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, collection, query, where, onSnapshot, handleFirestoreError, OperationType } from '../firebase';
import { ArrowLeft, Printer } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Button from './ui/Button';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  author: string;
  imageUrl: string;
  imageAlt?: string;
  imageCredit?: string;
  publishedAt: any;
}

export default function PrintableWriting() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const cvRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    
    const q = query(
      collection(db, 'blog_posts'),
      where('slug', '==', slug),
      where('status', '==', 'published')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BlogPost[];
      
      if (postsData.length > 0) {
        setPost(postsData[0]);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'blog_posts');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-12 bg-white text-black min-h-screen flex items-center justify-center">
        <p className="text-xs uppercase tracking-widest text-gray-400 animate-pulse">Preparing document for print...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-4xl mx-auto p-12 bg-white text-black min-h-screen flex items-center justify-center">
        <p className="text-xs uppercase tracking-widest text-gray-400">Document not found.</p>
        <Button onClick={() => navigate('/writings')} variant="outline" className="mt-4">Back to Writings</Button>
      </div>
    );
  }

  return (
    <div className="max-w-[210mm] mx-auto p-8 sm:p-12 bg-white text-black min-h-screen relative print:p-0 print:m-0 print:max-w-none">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            background: white;
            -webkit-print-color-adjust: exact;
          }
          .print-container {
            width: 100%;
            height: 100%;
          }
          .print-content img {
            max-height: 400px;
            object-fit: contain;
            width: 100%;
          }
        }
      `}} />

      {/* Action Buttons - Hidden during print */}
      <div className="fixed top-8 left-8 flex flex-col sm:flex-row gap-4 print:hidden z-50">
        <Button
          onClick={() => navigate(`/writings/${slug}`)}
          variant="outline"
          size="sm"
          icon={ArrowLeft}
          magnetic={true}
          className="bg-white/80 backdrop-blur-sm border-gray-200 text-gray-600 hover:text-black hover:border-black"
        >
          Back to Article
        </Button>
        <Button
          onClick={() => window.print()}
          variant="outline"
          size="sm"
          icon={Printer}
          magnetic={true}
          className="bg-white/80 backdrop-blur-sm border-gray-200 text-gray-600 hover:text-black hover:border-black"
        >
          Print Page
        </Button>
      </div>

      <div className="print-container" ref={cvRef}>
        <div className="border-b-2 border-black pb-6 mb-10">
          <h1 className="text-3xl md:text-5xl font-serif mb-4 leading-tight">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium uppercase tracking-widest text-gray-600">
            <span>{post.author}</span>
            <span>&bull;</span>
            <span>
              {post.publishedAt?.toDate().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
          </div>
        </div>

        {post.imageUrl && (
          <figure className="mb-10">
            <img 
              src={post.imageUrl} 
              alt={post.imageAlt || post.title} 
              className="w-full h-auto object-contain bg-gray-50 border border-gray-100"
            />
            {post.imageCredit && (
              <figcaption 
                className="text-[10px] text-center text-gray-400 mt-3 [&_a]:text-gray-500"
                dangerouslySetInnerHTML={{ __html: post.imageCredit }}
              />
            )}
          </figure>
        )}

        <div className="print-content text-sm leading-relaxed prose prose-sm prose-black max-w-none prose-headings:font-serif prose-headings:font-normal prose-a:text-black hover:prose-a:underline">
          {post.content.trim().startsWith('<') ? (
            <div dangerouslySetInnerHTML={{ __html: post.content }} />
          ) : (
            <ReactMarkdown>{post.content}</ReactMarkdown>
          )}
        </div>
        
        <div className="mt-16 pt-6 border-t border-gray-200 text-center text-[10px] text-gray-400 uppercase tracking-widest">
          {post.author} &bull; solheim.online &bull; {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
