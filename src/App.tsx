import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect, createContext, useContext, useRef, lazy, Suspense } from 'react';
import { auth, onAuthStateChanged, signOut, signInWithPopup, googleProvider, db, collection, onSnapshot, query, orderBy, where, doc, getDocFromServer, setDoc, serverTimestamp, handleFirestoreError, OperationType } from './firebase';
import { motion, AnimatePresence, useMotionValue, useSpring, useMotionTemplate, useScroll } from 'framer-motion';
import { LogIn, LogOut, Menu, X, Book, Film, Tv, FileText, Home as HomeIcon, Plus, Trash2, Edit2, Sun, Moon, ArrowUp, Linkedin, Twitter, Github, Mail, Instagram, Facebook, Youtube, Share2, Activity, User, Cloud, Calendar, LayoutDashboard, Loader2, DollarSign } from 'lucide-react';
import { BlueskyIcon } from './components/Icons';
import Magnetic from './components/Magnetic';
import ErrorBoundary from './components/ErrorBoundary';
import Button from './components/ui/Button';

import { ThemeContext } from './contexts/ThemeContext';

// Lazy loaded components
const Home = lazy(() => import('./components/Home'));
const Recommendations = lazy(() => import('./components/Recommendations'));
const CV = lazy(() => import('./components/CV'));
const Admin = lazy(() => import('./components/Admin'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const HealthTracker = lazy(() => import('./components/HealthTracker'));
const PrintableCV = lazy(() => import('./components/PrintableCV'));
const UserPage = lazy(() => import('./components/UserPage'));
const Kiaplay = lazy(() => import('./components/Kiaplay'));
const Library = lazy(() => import('./components/Library'));
const VisitingCard = lazy(() => import('./components/VisitingCard'));
const SampolDashboard = lazy(() => import('./components/SampolDashboard'));
const Availability = lazy(() => import('./components/Availability'));
const FlyBergen = lazy(() => import('./components/FlyBergen'));
const Expenses = lazy(() => import('./components/Expenses'));

interface Profile {
  name: string;
  role: string;
  email: string;
  location: string;
  website: string;
  phone?: string;
  mobile?: string;
  landline?: string;
  visitingCardKey?: string;
}

interface Social {
  id: string;
  label: string;
  href: string;
  icon: string;
  order: number;
}

const ProfileContext = createContext<Profile>({
  name: 'Kianosh F. Solheim',
  role: 'Comparative Politics Student at the University of Bergen',
  email: 'kianosh@solheim.online',
  location: 'Bergen, Norway',
  website: 'www.solheim.online',
  phone: '+47 000 00 000',
  mobile: '',
  landline: '',
  visitingCardKey: undefined
});

const SocialsContext = createContext<Social[]>([]);

export const useProfile = () => useContext(ProfileContext);
export const useSocials = () => useContext(SocialsContext);

const Navbar = ({ user, canViewAdminHealth, hasKiaplayAccess }: { user: any, canViewAdminHealth: boolean, hasKiaplayAccess: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const profile = useProfile();
  const location = useLocation();
  const { scrollYProgress } = useScroll();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const isPrintPage = location.pathname === '/cv/print';

  if (isPrintPage) return null;

  const isAdmin = user && (user.email === 'kianoshsolheim@gmail.com' || user.email === 'kianosh@solheim.online');

  const navLinks = [
    { name: 'Home', path: '/', icon: <HomeIcon size={18} /> },
    { name: 'CV', path: '/cv', icon: <FileText size={18} /> },
    ...(user ? [{ name: 'Library', path: '/library', icon: <Book size={18} /> }] : []),
    { name: 'Recommendations', path: '/recommendations', icon: <Film size={18} /> },
    { name: 'Availability', path: '/availability', icon: <Calendar size={18} /> },
  ];

  return (
    <nav className="fixed top-0 w-full bg-paper/80 backdrop-blur-md border-b border-ink/5 z-50">
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent origin-left"
        style={{ scaleX }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-serif tracking-widest uppercase text-ink">
              {(profile.name || 'Kianosh F. Solheim').split(' ').map(n => n[0]).join('. ')}
            </Link>
          </div>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center space-x-2 text-xs uppercase tracking-widest transition-colors hover:text-accent ${
                  location.pathname === link.path ? 'text-accent font-semibold' : 'text-ink/60'
                }`}
              >
                {link.icon}
                <span>{link.name}</span>
              </Link>
            ))}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              magnetic={true}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </Button>

            {user ? (
              <div className="relative" ref={dropdownRef}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center space-x-2 focus:outline-none p-0 h-auto hover:bg-transparent"
                  magnetic={true}
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Profile'}
                      className="w-8 h-8 rounded-full border border-ink/10 hover:border-accent transition-colors"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-ink/5 flex items-center justify-center border border-ink/10 hover:border-accent transition-colors">
                      <User size={18} className="text-ink/60" />
                    </div>
                  )}
                </Button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute right-0 mt-2 w-48 bg-paper border border-ink/10 rounded-xl shadow-xl overflow-hidden z-50"
                    >
                      <div className="px-4 py-3 border-b border-ink/5">
                        <p className="text-xs font-semibold text-ink truncate">{user.displayName}</p>
                        <p className="text-[10px] text-ink/40 truncate">{user.email}</p>
                      </div>
                      <div className="py-1">
                        <Link
                          to={`/user/${user.uid}`}
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center space-x-2 px-4 py-2 text-xs text-ink/60 hover:text-accent hover:bg-ink/5 transition-colors"
                        >
                          <User size={14} />
                          <span>My Page</span>
                        </Link>
                        {isAdmin && (
                          <Link
                            to="/dashboard"
                            onClick={() => setIsProfileOpen(false)}
                            className="flex items-center space-x-2 px-4 py-2 text-xs text-ink/60 hover:text-accent hover:bg-ink/5 transition-colors"
                          >
                            <LayoutDashboard size={14} />
                            <span>Dashboard</span>
                          </Link>
                        )}
                        {isAdmin && (
                          <Link
                            to="/expenses"
                            onClick={() => setIsProfileOpen(false)}
                            className="flex items-center space-x-2 px-4 py-2 text-xs text-ink/60 hover:text-accent hover:bg-ink/5 transition-colors"
                          >
                            <DollarSign size={14} />
                            <span>Expenses</span>
                          </Link>
                        )}
                        {isAdmin && (
                          <Link
                            to="/admin"
                            onClick={() => setIsProfileOpen(false)}
                            className="flex items-center space-x-2 px-4 py-2 text-xs text-ink/60 hover:text-accent hover:bg-ink/5 transition-colors"
                          >
                            <Plus size={14} />
                            <span>Admin</span>
                          </Link>
                        )}
                        {(isAdmin || canViewAdminHealth) && (
                          <Link
                            to="/health"
                            onClick={() => setIsProfileOpen(false)}
                            className="flex items-center space-x-2 px-4 py-2 text-xs text-ink/60 hover:text-accent hover:bg-ink/5 transition-colors"
                          >
                            <Activity size={14} />
                            <span>Health</span>
                          </Link>
                        )}
                        {(isAdmin || hasKiaplayAccess) && (
                          <Link
                            to="/kiaplay"
                            onClick={() => setIsProfileOpen(false)}
                            className="flex items-center space-x-2 px-4 py-2 text-xs text-ink/60 hover:text-accent hover:bg-ink/5 transition-colors"
                          >
                            <Tv size={14} />
                            <span>KIAPLAY</span>
                          </Link>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            signOut(auth);
                            setIsProfileOpen(false);
                          }}
                          icon={LogOut}
                          className="w-full justify-start text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
                          magnetic={true}
                        >
                          Logout
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signInWithPopup(auth, googleProvider)}
                icon={LogIn}
                magnetic={true}
              >
                Login
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              magnetic={true}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              magnetic={true}
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="md:hidden bg-paper border-b border-ink/5 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center space-x-3 text-xs uppercase tracking-widest ${
                    location.pathname === link.path ? 'text-accent font-semibold' : 'text-ink/60'
                  }`}
                >
                  {link.icon}
                  <span>{link.name}</span>
                </Link>
              ))}
              {user ? (
                <div className="space-y-4">
                  <Link
                    to={`/user/${user.uid}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center space-x-3 text-xs uppercase tracking-widest text-ink/60"
                  >
                    <User size={18} />
                    <span>My Page</span>
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/dashboard"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-3 text-xs uppercase tracking-widest text-ink/60"
                    >
                      <LayoutDashboard size={18} />
                      <span>Dashboard</span>
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      to="/expenses"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-3 text-xs uppercase tracking-widest text-ink/60"
                    >
                      <DollarSign size={18} />
                      <span>Expenses</span>
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-3 text-xs uppercase tracking-widest text-ink/60"
                    >
                      <Plus size={18} />
                      <span>Admin</span>
                    </Link>
                  )}
                  {(isAdmin || canViewAdminHealth) && (
                    <Link
                      to="/health"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-3 text-xs uppercase tracking-widest text-ink/60"
                    >
                      <Activity size={18} />
                      <span>Health</span>
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      signOut(auth);
                      setIsOpen(false);
                    }}
                    icon={LogOut}
                    className="w-full justify-start text-red-500"
                    magnetic={true}
                  >
                    Logout
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    signInWithPopup(auth, googleProvider);
                    setIsOpen(false);
                  }}
                  icon={LogIn}
                  magnetic={true}
                >
                  Login
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const PageWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -15, filter: "blur(8px)" }}
      transition={{ 
        duration: 0.6, 
        ease: [0.22, 1, 0.36, 1] 
      }}
    >
      {children}
    </motion.div>
  );
};

const Footer = ({ socials }: { socials: Social[] }) => {
  const location = useLocation();
  const profile = useProfile();
  if (location.pathname === '/cv/print') return null;

  const getSocialIcon = (iconName: string, size = 18) => {
    switch (iconName) {
      case 'linkedin': return <Linkedin size={size} />;
      case 'twitter': return <Twitter size={size} />;
      case 'github': return <Github size={size} />;
      case 'mail': return <Mail size={size} />;
      case 'instagram': return <Instagram size={size} />;
      case 'facebook': return <Facebook size={size} />;
      case 'youtube': return <Youtube size={size} />;
      case 'bluesky': return <BlueskyIcon size={size} />;
      default: return <Mail size={size} />;
    }
  };

  return (
    <footer className="py-16 border-t border-ink/5 bg-paper/50 backdrop-blur-sm text-center relative z-10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col items-center space-y-6">
          <div className="text-xl font-serif tracking-widest uppercase">
            {(profile.name || 'Kianosh F. Solheim').split(' ').map(n => n[0]).join('. ')}
          </div>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
            {['Home', 'Recommendations', 'CV', 'Fly-Bergen', 'Contact', 'SAMPOL-Dashboard'].map((item) => (
              <Link
                key={item}
                to={
                  item === 'Home' ? '/' : 
                  item === 'SAMPOL-Dashboard' ? '/sampol-dashboard' : 
                  item === 'Fly-Bergen' ? '/fly-bergen' :
                  `/${item.toLowerCase()}`
                }
                className="text-[10px] uppercase tracking-widest text-ink/40 hover:text-accent transition-colors"
              >
                {item}
              </Link>
            ))}
          </div>
          <div className="flex space-x-6">
            {socials.length > 0 ? (
              socials.map((social) => (
                <motion.a
                  key={social.id}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink/40 hover:text-accent transition-colors"
                  aria-label={social.label}
                  whileHover={{ y: -2, scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {getSocialIcon(social.icon)}
                </motion.a>
              ))
            ) : (
              [
                { icon: <Linkedin size={18} />, href: `https://linkedin.com/in/${(profile.name || 'kianoshfsolheim').toLowerCase().replace(/ /g, '')}`, label: "LinkedIn" },
                { icon: <Twitter size={18} />, href: `https://twitter.com/${(profile.name || 'kianoshfsolheim').toLowerCase().replace(/ /g, '')}`, label: "Twitter" },
                { icon: <Github size={18} />, href: `https://github.com/${(profile.name || 'kianoshfsolheim').toLowerCase().replace(/ /g, '')}`, label: "GitHub" },
                { icon: <Mail size={18} />, href: `mailto:${profile.email || 'kianosh@solheim.online'}`, label: "Email" }
              ].map((social) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink/40 hover:text-accent transition-colors"
                  aria-label={social.label}
                  whileHover={{ y: -2, scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {social.icon}
                </motion.a>
              ))
            )}
          </div>
          <div className="h-px w-12 bg-accent/20" />
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
            &copy; {new Date().getFullYear()} {profile.name} &bull; {profile.role}
          </p>
        </div>
      </div>
    </footer>
  );
};

const MainLayout = ({ user, canViewAdminHealth, hasKiaplayAccess, adminUid, showScrollTop, scrollToTop, background, socials }: { 
  user: any, 
  canViewAdminHealth: boolean, 
  hasKiaplayAccess: boolean,
  adminUid: string | null, 
  showScrollTop: boolean, 
  scrollToTop: () => void, 
  background: any, 
  socials: Social[] 
}) => {
  const location = useLocation();
  const isPrintPage = location.pathname === '/cv/print';
  const isKiaplayPage = location.pathname === '/kiaplay';
  const { theme } = useContext(ThemeContext);

  useEffect(() => {
    const root = window.document.documentElement;
    if ((theme === 'dark' || isKiaplayPage) && !isPrintPage) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme, isPrintPage, isKiaplayPage]);

  return (
    <div className={`min-h-screen flex flex-col ${isKiaplayPage ? 'bg-[#141414]' : 'bg-paper'} text-ink transition-colors duration-300 relative overflow-hidden`}>
      {/* Global Spotlight Effect */}
      {!isKiaplayPage && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-0 print:hidden"
          style={{ background }}
        />
      )}
      
      <div className="relative z-10 flex flex-col min-h-screen">
        {!isKiaplayPage && <Navbar user={user} canViewAdminHealth={canViewAdminHealth} hasKiaplayAccess={hasKiaplayAccess} />}
        <style>{`
          .dashboard-fullscreen-active nav,
          .dashboard-fullscreen-active footer {
            display: none !important;
          }
          .dashboard-fullscreen-active main {
            padding-top: 0 !important;
          }
          .dashboard-fullscreen-active [style*="radial-gradient"] {
            display: none !important;
          }
        `}</style>
        <main className={`flex-grow ${isPrintPage || isKiaplayPage ? '' : 'pt-16'}`}>
          <AnimatedRoutes user={user} canViewAdminHealth={canViewAdminHealth} hasKiaplayAccess={hasKiaplayAccess} adminUid={adminUid} />
        </main>
        
        <AnimatePresence>
          {showScrollTop && !isPrintPage && !isKiaplayPage && (
            <Button
              onClick={scrollToTop}
              icon={ArrowUp}
              className="fixed bottom-8 right-8 p-4 shadow-lg z-40"
              magnetic={true}
            >
              Back to Top
            </Button>
          )}
        </AnimatePresence>

        {!isKiaplayPage && <Footer socials={socials} />}
      </div>
    </div>
  );
};

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <Loader2 className="animate-spin text-accent" size={32} />
  </div>
);

const AnimatedRoutes = ({ user, canViewAdminHealth, hasKiaplayAccess, adminUid }: { user: any, canViewAdminHealth: boolean, hasKiaplayAccess: boolean, adminUid: string | null }) => {
  const location = useLocation();
  const isAdmin = user && (user.email === 'kianoshsolheim@gmail.com' || user.email === 'kianosh@solheim.online');

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageWrapper><Home /></PageWrapper>} />
          <Route path="/recommendations" element={<PageWrapper><Recommendations /></PageWrapper>} />
          <Route path="/availability" element={<PageWrapper><Availability /></PageWrapper>} />
          <Route path="/cv" element={<PageWrapper><CV /></PageWrapper>} />
          <Route path="/library" element={<PageWrapper><Library /></PageWrapper>} />
          <Route path="/admin" element={<PageWrapper><Admin user={user} /></PageWrapper>} />
          <Route path="/dashboard" element={isAdmin ? <PageWrapper><Dashboard /></PageWrapper> : <PageWrapper><Home /></PageWrapper>} />
          <Route path="/sampol-dashboard" element={<PageWrapper><SampolDashboard /></PageWrapper>} />
          <Route path="/cv/print" element={<PrintableCV />} />
          <Route path="/visiting-card" element={<VisitingCard />} />
          <Route path="/fly-bergen" element={<FlyBergen />} />
          <Route path="/expenses" element={isAdmin ? <PageWrapper><Expenses /></PageWrapper> : <PageWrapper><Home /></PageWrapper>} />
          <Route path="/user/:userId" element={<PageWrapper><UserPage /></PageWrapper>} />
          <Route path="/kiaplay" element={(isAdmin || hasKiaplayAccess) ? <Kiaplay /> : <PageWrapper><Home /></PageWrapper>} />
          {(isAdmin || canViewAdminHealth) && (
            <Route path="/health" element={<PageWrapper><HealthTracker user={user} canViewAdminHealth={canViewAdminHealth} adminUid={adminUid} /></PageWrapper>} />
          )}
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
};

const LoadingScreen = ({ theme }: { theme: string }) => {
  const isDark = theme === 'dark';
  return (
    <div className={isDark ? 'dark' : ''}>
      <div 
        className={`fixed inset-0 z-[10000] flex flex-col items-center justify-center transition-colors duration-500 ${isDark ? 'bg-[#121212] text-[#e5e5e5]' : 'bg-[#f5f2ed] text-[#1a1a1a]'}`}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center max-w-sm w-full px-8 text-center"
        >
          <div className="relative mb-16">
            <motion.div
              animate={{ 
                rotate: 360,
                scale: [1, 1.1, 1],
                borderRadius: ["30% 70% 70% 30% / 30% 30% 70% 70%", "50% 50% 20% 80% / 25% 80% 20% 75%", "38% 62% 63% 37% / 41% 44% 56% 59%"]
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="w-32 h-32 bg-accent/10 blur-3xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            />
            
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 w-20 h-20 rounded-[2.5rem] bg-accent flex items-center justify-center shadow-2xl shadow-accent/30 overflow-hidden"
            >
              <motion.div 
                 animate={{ y: [0, -5, 0], rotate: [0, -2, 2, 0] }}
                 transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                 className="text-white font-serif text-4xl font-black italic select-none"
              >
                K
              </motion.div>
              
              <motion.div
                animate={{ x: ["-100%", "200%"] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "linear", delay: 1 }}
                className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -rotate-45"
              />
            </motion.div>
          </div>

          <div className="space-y-6 w-full relative">
            <div className="space-y-2">
              <motion.h1
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className={`text-2xl font-serif font-medium tracking-tight ${isDark ? 'text-[#e5e5e5]' : 'text-[#1a1a1a]'}`}
              >
                Kianosh F. Solheim
              </motion.h1>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ delay: 0.6 }}
                className="flex items-center justify-center gap-2"
              >
                <span className="w-8 h-[1px] bg-accent/40" />
                <p className={`text-[9px] uppercase tracking-[0.4em] font-black ${isDark ? 'text-white/40' : 'text-black/40'}`}>
                  Catalogue Portfolio
                </p>
                <span className="w-8 h-[1px] bg-accent/40" />
              </motion.div>
            </div>

            <div className={`relative h-[2px] w-48 mx-auto rounded-full overflow-hidden ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "0%" }}
                transition={{ duration: 2.5, ease: [0.65, 0, 0.35, 1] }}
                className="absolute inset-0 bg-accent w-full"
              />
              <motion.div
                animate={{ x: ["-100%", "200%"] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="absolute inset-0 w-1/2 bg-white/30"
              />
            </div>
            
            <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ delay: 1.5 }}
               className="flex items-center justify-center gap-3"
            >
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.4, 1], opacity: [0.2, 1, 0.2] }}
                    transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                    className="w-1 h-1 rounded-full bg-accent"
                  />
                ))}
              </div>
              <span className="text-[9px] uppercase tracking-[0.2em] font-black text-accent/80 animate-pulse">
                Initializing Experience
              </span>
            </motion.div>
          </div>
        </motion.div>
        
        <div className="fixed inset-0 pointer-events-none border-[40px] border-transparent">
          <div className={`absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 ${isDark ? 'border-white/5' : 'border-black/5'}`} />
          <div className={`absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 ${isDark ? 'border-white/5' : 'border-black/5'}`} />
          <div className={`absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 ${isDark ? 'border-white/5' : 'border-black/5'}`} />
          <div className={`absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 ${isDark ? 'border-white/5' : 'border-black/5'}`} />
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [canViewAdminHealth, setCanViewAdminHealth] = useState(false);
  const [hasKiaplayAccess, setHasKiaplayAccess] = useState(false);
  const [adminUid, setAdminUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile>({
    name: 'Kianosh F. Solheim',
    role: 'Comparative Politics Student at the University of Bergen',
    email: 'kianosh@solheim.online',
    location: 'Bergen, Norway',
    website: 'www.solheim.online',
    phone: '',
    mobile: '',
    landline: '',
    visitingCardKey: undefined
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
      
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    }
    return 'light';
  });
  const [socials, setSocials] = useState<Social[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const ADMIN_EMAILS = ['kianoshsolheim@gmail.com', 'kianosh@solheim.online'];

  // Spotlight logic
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const background = useMotionTemplate`radial-gradient(600px circle at ${mouseX}px ${mouseY}px, rgba(var(--accent-rgb), 0.15), transparent 70%)`;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [mouseX, mouseY]);

  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        // Create user document if it doesn't exist
        const userDocRef = doc(db, 'users', user.uid);
        try {
          const userDoc = await getDocFromServer(userDocRef);
          if (!userDoc.exists()) {
            await setDoc(userDocRef, {
              email: user.email,
              displayName: user.displayName,
              role: 'client',
              approved: false,
              canViewAdminHealth: false,
              createdAt: serverTimestamp()
            }).catch(error => handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`));
          }

          // Create user page document if it doesn't exist
          const userPageRef = doc(db, 'user_pages', user.uid);
          const userPageDoc = await getDocFromServer(userPageRef);
          if (!userPageDoc.exists()) {
            await setDoc(userPageRef, {
              userId: user.uid,
              movieRecommendations: [],
              meetings: [],
              contactInfo: {
                phone: '',
                address: '',
                bio: ''
              },
              updatedAt: serverTimestamp()
            }).catch(error => handleFirestoreError(error, OperationType.WRITE, `user_pages/${user.uid}`));
          }
        } catch (error) {
          // If we can't read/write, it might be due to rules or connection
          // But we should at least try to get the snapshot for isApproved
          console.error("Error checking/creating user doc:", error);
        }

        // Check if user can view admin health and has Kiaplay access
        unsubscribeUserDoc = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            setCanViewAdminHealth(data.canViewAdminHealth === true);
            setHasKiaplayAccess(data.hasKiaplayAccess === true);
          } else {
            setCanViewAdminHealth(false);
            setHasKiaplayAccess(false);
          }
        }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}`, true));
      } else {
        setCanViewAdminHealth(false);
        setHasKiaplayAccess(false);
        if (unsubscribeUserDoc) {
          unsubscribeUserDoc();
          unsubscribeUserDoc = undefined;
        }
      }
      setLoading(false);
    });

    // Find admin UID
    const qAdmin = query(collection(db, 'users'), where('email', 'in', ADMIN_EMAILS));
    const unsubscribeAdmin = onSnapshot(qAdmin, (snapshot) => {
      if (!snapshot.empty) {
        setAdminUid(snapshot.docs[0].id);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users', true));

    const unsubscribeProfile = onSnapshot(collection(db, 'profile'), (snapshot) => {
      if (!snapshot.empty) {
        setProfile(snapshot.docs[0].data() as Profile);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'profile'));

    const unsubscribeSocials = onSnapshot(query(collection(db, 'socials'), orderBy('order', 'asc')), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Social[];
      setSocials(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'socials'));

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      unsubscribe();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
      unsubscribeAdmin();
      unsubscribeProfile();
      unsubscribeSocials();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return <LoadingScreen theme={theme} />;
  }

  return (
    <ErrorBoundary>
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <ProfileContext.Provider value={profile}>
          <SocialsContext.Provider value={socials}>
            <Router>
              <MainLayout 
                user={user} 
                canViewAdminHealth={canViewAdminHealth}
                hasKiaplayAccess={hasKiaplayAccess}
                adminUid={adminUid}
                showScrollTop={showScrollTop} 
                scrollToTop={scrollToTop} 
                background={background} 
                socials={socials}
              />
            </Router>
          </SocialsContext.Provider>
        </ProfileContext.Provider>
      </ThemeContext.Provider>
    </ErrorBoundary>
  );
}
