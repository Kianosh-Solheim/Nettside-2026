import { motion } from 'framer-motion';
import { ArrowRight, Linkedin, Twitter, Github, Mail, Instagram, Facebook, Youtube, Share2 } from 'lucide-react';
import { useProfile, useSocials } from '../App';
import Button from './ui/Button';

export default function Home() {
  const profile = useProfile();
  const socials = useSocials();

  const getSocialIcon = (iconName: string, size = 24) => {
    switch (iconName) {
      case 'linkedin': return <Linkedin size={size} strokeWidth={1.5} />;
      case 'twitter': return <Twitter size={size} strokeWidth={1.5} />;
      case 'github': return <Github size={size} strokeWidth={1.5} />;
      case 'mail': return <Mail size={size} strokeWidth={1.5} />;
      case 'instagram': return <Instagram size={size} strokeWidth={1.5} />;
      case 'facebook': return <Facebook size={size} strokeWidth={1.5} />;
      case 'youtube': return <Youtube size={size} strokeWidth={1.5} />;
      case 'bluesky': return <Share2 size={size} strokeWidth={1.5} />;
      default: return <Mail size={size} strokeWidth={1.5} />;
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-20 text-center relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-5xl z-10"
      >
        <motion.p
          initial={{ opacity: 0, letterSpacing: "0.1em" }}
          animate={{ opacity: 1, letterSpacing: "0.3em" }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="text-[10px] sm:text-xs uppercase text-accent font-black mb-8"
        >
          Comparative Politics Student, University of Bergen
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-serif font-medium mb-16 leading-[1.1] text-ink tracking-tight"
        >
          {profile.name}
        </motion.h1>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-8"
        >
          <Button 
            to="/cv"
            variant="primary"
            size="lg"
            icon={ArrowRight}
            magnetic={true}
            className="w-full sm:w-auto min-w-[220px] shadow-[0_20px_40px_-15px_rgba(var(--accent-rgb),0.3)]"
          >
            View CV
          </Button>
          <Button 
            to="/recommendations"
            variant="outline"
            size="lg"
            magnetic={true}
            className="w-full sm:w-auto min-w-[220px]"
          >
            Recommendations
          </Button>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center space-x-4"
      >
        {socials.length > 0 ? (
          socials.map((social) => (
            <motion.a 
              key={social.id}
              href={social.href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-ink/20 hover:text-accent transition-all duration-500 block p-4"
              whileHover={{ scale: 1.2, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              aria-label={social.label}
            >
              {getSocialIcon(social.icon)}
            </motion.a>
          ))
        ) : (
          <motion.a 
            href="https://linkedin.com/in/kianoshsolheim" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-ink/20 hover:text-accent transition-all duration-500 block p-4"
            whileHover={{ scale: 1.2, rotate: 5 }}
            whileTap={{ scale: 0.9 }}
            aria-label="LinkedIn"
          >
            <Linkedin size={24} strokeWidth={1.5} />
          </motion.a>
        )}
      </motion.div>
    </div>
  );
}
