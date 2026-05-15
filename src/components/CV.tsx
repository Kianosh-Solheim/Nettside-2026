import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Printer, Mail, MapPin, Globe, ExternalLink, Briefcase, GraduationCap, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
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

interface Profile {
  name: string;
  role: string;
  email: string;
  location: string;
  website: string;
  phone?: string;
  linkedin?: string;
}

export default function CV() {
  const [sections, setSections] = useState<CVSection[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'cv'), orderBy('order', 'asc'));
    
    const unsubscribeSections = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CVSection[];
      setSections(data);
      if (profile) setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cv');
    });

    const unsubscribeProfile = onSnapshot(collection(db, 'profile'), (snapshot) => {
      if (!snapshot.empty) {
        setProfile(snapshot.docs[0].data() as Profile);
      }
      if (sections.length > 0) setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'profile');
    });

    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);

    return () => {
      unsubscribeSections();
      unsubscribeProfile();
      clearTimeout(timer);
      // Ensure logo color is reset if unmounting during hover
      window.dispatchEvent(new CustomEvent('section-hover', { detail: false }));
    };
  }, []);

  const getSectionIcon = (title: string) => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('work') || lowerTitle.includes('experience')) return <Briefcase size={14} />;
    if (lowerTitle.includes('education') || lowerTitle.includes('academic')) return <GraduationCap size={14} />;
    if (lowerTitle.includes('volunteering') || lowerTitle.includes('heart')) return <Heart size={14} />;
    return null;
  };

  if (loading) {
    return (
      <div key="cv-loader" className="min-h-screen flex flex-col items-center justify-center bg-paper relative overflow-hidden">
        {/* Ambient Background Elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-80 h-80 bg-accent/5 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-accent/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <motion.div
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="relative flex flex-col items-center z-10"
        >
          <div className="w-20 h-28 border-2 border-ink/5 rounded-xl relative overflow-hidden bg-surface shadow-2xl mb-8 flex flex-col p-4 gap-2">
            {/* Header skeleton */}
            <div className="w-12 h-2 bg-accent/20 rounded-full" />
            <div className="w-8 h-1 bg-ink/10 rounded-full" />
            
            {/* Lines skeleton */}
            <div className="mt-4 space-y-2">
              <div className="w-full h-1 bg-ink/5 rounded-full" />
              <div className="w-full h-1 bg-ink/5 rounded-full" />
              <div className="w-2/3 h-1 bg-ink/5 rounded-full" />
            </div>
            
            <div className="mt-4 space-y-2">
              <div className="w-full h-1 bg-ink/5 rounded-full" />
              <div className="w-4/5 h-1 bg-ink/5 rounded-full" />
            </div>

            {/* Scanning Line */}
            <motion.div 
              animate={{ top: ['-10%', '110%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute left-0 right-0 h-[2px] bg-accent/50 shadow-[0_0_15px_rgba(227,28,40,0.4)] z-10"
            />

            {/* Subtle paper texture overlay */}
            <div className="absolute inset-0 bg-paper/5 opacity-50 pointer-events-none mix-blend-multiply" />
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.6em] text-accent font-black animate-pulse">
              Compiling CV
            </span>
            <span className="text-ink/30 text-[9px] uppercase tracking-[0.2em] font-bold">
              Accessing Digital Archive
            </span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-ink selection:bg-accent/30 overflow-x-hidden transition-colors duration-300 dark:text-ink">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-12 sm:py-20 lg:py-32">
        
        {/* Header Section */}
        <header className="text-center mb-20 md:mb-32 space-y-8 h-[290px]">
          <motion.p
            initial={{ opacity: 0, letterSpacing: "0.1em" }}
            animate={{ opacity: 1, letterSpacing: "0.3em" }}
            transition={{ duration: 1 }}
            className="text-[10px] sm:text-xs uppercase text-accent font-black"
          >
            Curriculum Vitae
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif leading-tight tracking-tight">
              {profile?.name || 'Kianosh F. Solheim'}
            </h1>
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-ink/40 font-black max-w-lg mx-auto">
              {profile?.role || 'COMPARATIVE POLITICS STUDENT, UNIVERSITY OF BERGEN'}
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap justify-center gap-6 md:gap-10 pt-4"
          >
            <div className="flex items-center space-x-2 group cursor-default">
              <Mail size={14} className="text-accent opacity-60 group-hover:opacity-100 transition-opacity" />
              <span className="text-[11px] uppercase tracking-widest text-ink/60 font-medium group-hover:text-ink transition-colors">
                {profile?.email || 'kianosh@solheim.online'}
              </span>
            </div>
            <div className="flex items-center space-x-2 group cursor-default">
              <MapPin size={14} className="text-accent opacity-60 group-hover:opacity-100 transition-opacity" />
              <span className="text-[11px] uppercase tracking-widest text-ink/60 font-medium group-hover:text-ink transition-colors">
                {profile?.location || 'Bergen, Norway'}
              </span>
            </div>
            <div className="flex items-center space-x-2 group cursor-default">
              <Globe size={14} className="text-accent opacity-60 group-hover:opacity-100 transition-opacity" />
              <span className="text-[11px] uppercase tracking-widest text-ink/60 font-medium group-hover:text-ink transition-colors">
                {profile?.website || 'www.solheim.online'}
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="pt-8"
          >
            <Button
              to="/cv/print"
              variant="outline"
              size="md"
              icon={Printer}
              magnetic={true}
              className="min-w-[200px]"
            >
              Printable CV
            </Button>
          </motion.div>
        </header>

        {/* Main Content */}
        <main className="space-y-20 md:space-y-32">
          {sections.map((section, sIdx) => (
            <motion.section 
              key={section.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="group/section"
              onMouseEnter={() => window.dispatchEvent(new CustomEvent('section-hover', { detail: true }))}
              onMouseLeave={() => window.dispatchEvent(new CustomEvent('section-hover', { detail: false }))}
            >
              <div className="flex items-center justify-center mb-12 md:mb-16">
                <div className="h-px flex-grow bg-ink/5" />
                <div className="px-6 flex items-center space-x-3 text-accent">
                  {getSectionIcon(section.title)}
                  <h2 className="text-[10px] sm:text-[11px] uppercase tracking-[0.4em] font-black whitespace-nowrap">
                    {section.title}
                  </h2>
                </div>
                <div className="h-px flex-grow bg-ink/5" />
              </div>

              <div className="space-y-16 md:space-y-24">
                {section.items.map((item, iIdx) => (
                  <motion.div 
                    key={iIdx} 
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: iIdx * 0.1 }}
                    className="group relative"
                  >
                    <div className="flex gap-6 md:gap-8">
                      {/* Logo Column */}
                      {item.logoUrl && (
                        <div className="flex-shrink-0 pt-1">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-ink/[0.03] border border-ink/5 flex items-center justify-center overflow-hidden group-hover:border-accent/30 group-hover:bg-ink/[0.05] group-hover/section:border-accent/10 transition-all duration-500 p-2">
                            <img 
                              src={item.logoUrl || null} 
                              alt={item.subtitle} 
                              className="w-full h-full object-contain opacity-40 grayscale group-hover:opacity-90 group-hover:grayscale-0 group-hover/section:opacity-70 group-hover/section:grayscale-0 transition-all duration-500"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        </div>
                      )}

                      {/* Content Column */}
                      <div className="flex-grow space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="space-y-1">
                            <h3 className="text-xl sm:text-2xl lg:text-3xl font-serif text-ink/90 group-hover:text-accent transition-colors duration-500 leading-tight">
                              {item.title}
                            </h3>
                            <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-black">
                              {item.subtitle}
                            </p>
                          </div>
                          <div className="flex-shrink-0 pt-1 sm:text-right">
                            <span className="text-[9px] uppercase tracking-[0.2em] text-ink/30 font-black">
                              {item.date}
                            </span>
                          </div>
                        </div>

                        {item.description && (
                          <div className="text-[14px] lg:text-[15px] text-ink/50 leading-relaxed max-w-2xl font-medium markdown-cv">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                                ul: ({ children }) => <ul className="list-disc pl-4 mb-4 space-y-2">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-4 mb-4 space-y-2">{children}</ol>,
                                li: ({ children }) => <li className="pl-1">{children}</li>,
                                strong: ({ children }) => <strong className="text-ink/70 font-bold">{children}</strong>,
                                em: ({ children }) => <em className="italic opacity-80">{children}</em>,
                                a: ({ href, children }) => (
                                  <a href={href} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">
                                    {children}
                                  </a>
                                ),
                              }}
                            >
                              {item.description}
                            </ReactMarkdown>
                          </div>
                        )}

                        {item.link && (
                          <a 
                            href={item.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-2 text-[10px] uppercase tracking-[0.2em] text-accent hover:text-ink transition-all duration-300 font-black group/link"
                          >
                            <span>View Details</span>
                            <ExternalLink size={12} className="group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform" />
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          ))}

          {sections.length === 0 && (
            <div className="text-center py-40 border border-dashed border-ink/10 rounded-[48px] bg-ink/[0.02]">
              <p className="text-[11px] uppercase tracking-[0.4em] text-ink/20 font-black">No records found in database.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
