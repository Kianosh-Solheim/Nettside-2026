import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { useContext, useState, useEffect } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';

export default function Availability() {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const calendarUrl = `https://calendar.google.com/calendar/embed?height=600&wkst=1&ctz=Europe%2FBerlin&showPrint=0&showTitle=0&mode=${isMobile ? 'AGENDA' : 'MONTH'}&hl=en_GB&src=a2lhbm9zaHNvbGhlaW1AZ21haWwuY29t&src=ZW4tZ2Iubm9yd2VnaWFuI2hvbGlkYXlAZ3JvdXAudi5jYWxlbmRhci5nb29nbGUuY29t&color=%23f4511e&color=%230b8043`;

  return (
    <div className="min-h-screen pt-16 sm:pt-24 pb-6 sm:pb-12 px-0 sm:px-6 lg:px-8 bg-paper">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-5xl mx-auto"
      >
        <div className="mb-8 sm:mb-12 text-center px-4">
          <motion.p
            initial={{ opacity: 0, letterSpacing: "0.1em" }}
            animate={{ opacity: 1, letterSpacing: "0.3em" }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="text-[10px] sm:text-xs uppercase text-accent font-black mb-2 sm:mb-4"
          >
            Schedule & Availability
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-3xl sm:text-5xl font-serif font-medium text-ink mb-4"
          >
            Availability
          </motion.h1>
          <div className="w-12 h-1 bg-accent mx-auto rounded-full" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="bg-surface rounded-none sm:rounded-[48px] border-y sm:border border-ink/5 p-0 sm:p-8 shadow-xl shadow-ink/5 overflow-hidden ring-1 ring-ink/5"
        >
          <div className="h-[75vh] sm:h-auto sm:aspect-video w-full rounded-none sm:rounded-[32px] overflow-hidden bg-ink/[0.02] relative">
            <div className="absolute inset-0 flex items-center justify-center -z-10">
              <div className="flex flex-col items-center gap-4 text-ink/20">
                <Calendar size={48} className="animate-pulse" />
                <p className="text-[10px] uppercase tracking-[0.2em] font-black">Loading Calendar...</p>
              </div>
            </div>
            <iframe 
              src={calendarUrl}
              style={{ border: 0 }} 
              width="100%" 
              height="100%" 
              frameBorder="0" 
              scrolling="no"
              className={`w-full h-full grayscale-[0.2] hover:grayscale-0 transition-all duration-700 ${isDark ? 'invert brightness-90 hue-rotate-180' : ''}`}
            />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
