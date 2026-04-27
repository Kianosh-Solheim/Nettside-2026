import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../App';
import { Mail, MapPin, Globe, Phone, ArrowLeft, Printer } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { db, collection, onSnapshot, query, orderBy, handleFirestoreError, OperationType } from '../firebase';
import Button from './ui/Button';

interface CVItem {
  title: string;
  subtitle: string;
  date: string;
  description?: string;
  link?: string;
  logoUrl?: string;
}

interface CVSection {
  id: string;
  title: string;
  order: number;
  items: CVItem[];
}

export default function PrintableCV() {
  const profile = useProfile();
  const navigate = useNavigate();
  const [sections, setSections] = useState<CVSection[]>([]);
  const [loading, setLoading] = useState(true);
  const cvRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'cv'), orderBy('order', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CVSection[];
      setSections(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cv');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-12 bg-white text-black min-h-screen flex items-center justify-center">
        <p className="text-xs uppercase tracking-widest text-gray-400 animate-pulse">Preparing CV for print...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[210mm] mx-auto p-8 sm:p-12 bg-white text-black min-h-screen relative print:p-0 print:m-0 print:max-w-none">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            background: white;
            -webkit-print-color-adjust: exact;
          }
          .print-container {
            width: 100%;
            height: 100%;
            overflow: hidden;
          }
        }
      `}} />

      {/* Action Buttons - Hidden during print */}
      <div className="fixed top-8 left-8 flex flex-col sm:flex-row gap-4 print:hidden z-50">
        <Button
          onClick={() => navigate('/cv')}
          variant="outline"
          size="sm"
          icon={ArrowLeft}
          magnetic={true}
          className="bg-white/80 backdrop-blur-sm border-gray-200 text-gray-600 hover:text-black hover:border-black"
        >
          Back to CV
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
        <div className="flex flex-col items-center text-center border-b-2 border-black pb-4 mb-8">
          <h1 className="text-4xl font-serif mb-1">{profile.name}</h1>
          <p className="text-lg uppercase tracking-widest text-gray-600 mb-4">{profile.role}</p>
          
          <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-600">
            <div className="flex items-center space-x-1.5">
              <Mail size={12} className="text-black" />
              <span>{profile.email}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <MapPin size={12} className="text-black" />
              <span>{profile.location}</span>
            </div>
            {profile.website && (
              <div className="flex items-center space-x-1.5">
                <Globe size={12} className="text-black" />
                <span>{profile.website}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2 space-y-8">
            {sections.filter(s => s.title.toLowerCase().includes('experience') || s.title.toLowerCase().includes('education')).map((section) => (
              <section key={section.id}>
                <h2 className="text-xl font-serif border-b border-gray-200 pb-1 mb-4 uppercase tracking-widest">{section.title}</h2>
                <div className="space-y-6">
                  {section.items.map((item, idx) => (
                    <div key={idx} className="flex gap-3 group">
                      <div className="flex-grow">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h3 className="text-md font-bold">{item.title}</h3>
                          <span className="text-[10px] text-gray-500">{item.date}</span>
                        </div>
                        <p className="text-xs font-medium mb-1.5">{item.subtitle}</p>
                        {item.description && (
                          <div className="text-[11px] text-gray-600 leading-snug markdown-cv-print">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                                ul: ({ children }) => <ul className="list-disc pl-3 mb-1 space-y-0.5">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-3 mb-1 space-y-0.5">{children}</ol>,
                                li: ({ children }) => <li className="pl-0.5">{children}</li>,
                                strong: ({ children }) => <strong className="text-black font-bold">{children}</strong>,
                                em: ({ children }) => <em className="italic">{children}</em>,
                                a: ({ href, children }) => (
                                  <a href={href} className="text-gray-900 underline" target="_blank" rel="noopener noreferrer">
                                    {children}
                                  </a>
                                ),
                              }}
                            >
                              {item.description}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="col-span-1 space-y-8">
            {sections.filter(s => !s.title.toLowerCase().includes('experience') && !s.title.toLowerCase().includes('education')).map((section) => (
              <section key={section.id}>
                <h2 className="text-lg font-serif border-b border-gray-200 pb-1 mb-4 uppercase tracking-widest">{section.title}</h2>
                <ul className="space-y-1.5 text-xs text-gray-600">
                  {section.items.map((item, idx) => (
                    <li key={idx} className="flex flex-col">
                      <span className="font-bold">{item.title}</span>
                      {item.subtitle && <span className="text-[10px]">{item.subtitle}</span>}
                      {item.date && <span className="text-[9px] text-gray-400">{item.date}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
        
        <div className="mt-12 pt-4 border-t border-gray-100 text-center text-[8px] text-gray-400 uppercase tracking-widest">
          Generated via solheim.online &bull; {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
