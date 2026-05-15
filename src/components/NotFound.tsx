import { motion } from 'framer-motion';
import { Home, ArrowLeft, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from './ui/Button';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-20 text-center relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none -z-10">
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.15, 0.1] 
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/20 blur-[120px] rounded-full"
        />
        <motion.div
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.1, 0.05, 0.1] 
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent/10 blur-[150px] rounded-full"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-md w-full space-y-12"
      >
        <div className="relative inline-block">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="text-[12rem] font-serif font-black leading-none text-ink/5 select-none"
          >
            404
          </motion.div>
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ rotate: -20, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 100 }}
              className="w-24 h-24 bg-accent flex items-center justify-center rounded-[2rem] shadow-2xl shadow-accent/30"
            >
              <Search className="text-white" size={40} />
            </motion.div>
          </div>
        </div>

        <div className="space-y-4">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-4xl font-serif tracking-tight"
          >
            Lost in the Archives
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-ink/60 font-serif leading-relaxed"
          >
            The page you're searching for seems to have been misplaced or never existed in this library.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link to="/">
            <Button
              variant="primary"
              icon={Home}
              className="w-full sm:w-auto px-8"
              magnetic={true}
            >
              Back to Home
            </Button>
          </Link>
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={() => window.history.back()}
            className="w-full sm:w-auto px-8"
            magnetic={true}
          >
            Go Back
          </Button>
        </motion.div>
      </motion.div>

      {/* Aesthetic corners */}
      <div className="fixed inset-0 pointer-events-none border-[30px] border-transparent opacity-10">
        <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-ink" />
        <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-ink" />
        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-ink" />
        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-ink" />
      </div>
    </div>
  );
}
