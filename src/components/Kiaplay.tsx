import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Info, Plus, Search, Bell, User, ChevronRight, ChevronLeft, X, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../App';
import Button from './ui/Button';

interface Movie {
  imdbID: string;
  Title: string;
  Year: string;
  Poster: string;
  Type: string;
  Plot?: string;
  Rating?: string;
  Genre?: string;
}

const CATEGORIES = [
  { title: "Trending Now", query: "action" },
  { title: "New Releases", query: "2024" },
  { title: "Top Picks for You", query: "drama" },
  { title: "Action & Adventure", query: "adventure" },
  { title: "Comedies", query: "comedy" },
  { title: "Sci-Fi & Fantasy", query: "sci-fi" }
];

export default function Kiaplay() {
  const [heroMovie, setHeroMovie] = useState<Movie | null>(null);
  const [rows, setRows] = useState<{ title: string, movies: Movie[] }[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const navigate = useNavigate();
  const profile = useProfile();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchMovies = async () => {
      const omdbKey = import.meta.env.VITE_OMDB_API_KEY || 'b054da29';
      
      try {
        // Fetch hero movie
        const heroRes = await fetch(`https://www.omdbapi.com/?t=Inception&apikey=${omdbKey}`);
        const heroData = await heroRes.json();
        if (heroData.Response === 'True') setHeroMovie(heroData);

        // Fetch rows
        const rowPromises = CATEGORIES.map(async (cat) => {
          const res = await fetch(`https://www.omdbapi.com/?s=${cat.query}&type=movie&apikey=${omdbKey}`);
          const data = await res.json();
          return {
            title: cat.title,
            movies: (data.Search || []).filter((m: any) => m.Poster !== 'N/A')
          };
        });

        const fetchedRows = await Promise.all(rowPromises);
        setRows(fetchedRows.filter(r => r.movies.length > 0));
      } catch (error) {
        console.error("Failed to fetch movies:", error);
      } finally {
        setDataLoaded(true);
      }
    };

    fetchMovies();
  }, []);

  const fetchMovieDetails = async (id: string) => {
    const omdbKey = import.meta.env.VITE_OMDB_API_KEY || 'b054da29';
    try {
      const res = await fetch(`https://www.omdbapi.com/?i=${id}&plot=full&apikey=${omdbKey}`);
      const data = await res.json();
      if (data.Response === 'True') setSelectedMovie(data);
    } catch (error) {
      console.error("Failed to fetch details:", error);
    }
  };

  if (!dataLoaded || !introComplete) {
    return <IntroAnimation onComplete={() => setIntroComplete(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white font-sans selection:bg-accent selection:text-white">
      {/* Navbar */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 px-4 md:px-12 py-4 flex items-center justify-between ${
        isScrolled ? 'bg-[#141414] shadow-2xl' : 'bg-gradient-to-b from-black/80 to-transparent'
      }`}>
        <div className="flex items-center gap-8">
          <div 
            onClick={() => navigate('/')}
            className="text-accent text-3xl font-black tracking-tighter cursor-pointer hover:scale-105 transition-transform"
          >
            KIAPLAY
          </div>
          <div className="hidden lg:flex items-center gap-5 text-sm font-medium text-gray-300">
            <span className="hover:text-white cursor-pointer transition-colors">Home</span>
            <span className="hover:text-white cursor-pointer transition-colors">TV Shows</span>
            <span className="hover:text-white cursor-pointer transition-colors">Movies</span>
            <span className="hover:text-white cursor-pointer transition-colors">New & Popular</span>
            <span className="hover:text-white cursor-pointer transition-colors">My List</span>
          </div>
        </div>
        <div className="flex items-center gap-6 text-gray-300">
          <Search size={20} className="hover:text-white cursor-pointer transition-colors" />
          <Bell size={20} className="hover:text-white cursor-pointer transition-colors" />
          <div className="w-8 h-8 rounded bg-accent flex items-center justify-center text-white font-bold text-xs cursor-pointer">
            {profile.name?.[0] || 'K'}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      {heroMovie && (
        <div className="relative h-[85vh] w-full overflow-hidden">
          <div className="absolute inset-0">
            <img 
              src={heroMovie.Poster.replace('SX300', 'SX1920')} 
              alt={heroMovie.Title}
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
          </div>

          <div className="absolute bottom-[20%] left-4 md:left-12 max-w-2xl space-y-6">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-7xl font-black tracking-tight"
            >
              {heroMovie.Title}
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-gray-200 line-clamp-3 leading-relaxed drop-shadow-lg"
            >
              {heroMovie.Plot || "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O."}
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-4"
            >
              <button className="flex items-center gap-2 bg-white text-black px-8 py-3 rounded font-bold hover:bg-white/80 transition-colors">
                <Play size={24} fill="currentColor" />
                Play
              </button>
              <button 
                onClick={() => fetchMovieDetails(heroMovie.imdbID)}
                className="flex items-center gap-2 bg-gray-500/50 text-white px-8 py-3 rounded font-bold hover:bg-gray-500/40 transition-colors backdrop-blur-md"
              >
                <Info size={24} />
                More Info
              </button>
            </motion.div>
          </div>
        </div>
      )}

      {/* Movie Rows */}
      <div className="relative z-10 -mt-32 pb-20 space-y-12">
        {rows.map((row, idx) => (
          <MovieRow 
            key={idx} 
            title={row.title} 
            movies={row.movies} 
            onSelect={fetchMovieDetails} 
          />
        ))}
      </div>

      {/* Footer */}
      <footer className="px-4 md:px-12 py-20 border-t border-white/10 text-gray-500 text-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12 max-w-5xl">
          <div className="space-y-4">
            <p className="hover:underline cursor-pointer">Audio Description</p>
            <p className="hover:underline cursor-pointer">Help Center</p>
            <p className="hover:underline cursor-pointer">Gift Cards</p>
            <p className="hover:underline cursor-pointer">Media Center</p>
          </div>
          <div className="space-y-4">
            <p className="hover:underline cursor-pointer">Investor Relations</p>
            <p className="hover:underline cursor-pointer">Jobs</p>
            <p className="hover:underline cursor-pointer">Terms of Use</p>
            <p className="hover:underline cursor-pointer">Privacy</p>
          </div>
          <div className="space-y-4">
            <p className="hover:underline cursor-pointer">Legal Notices</p>
            <p className="hover:underline cursor-pointer">Cookie Preferences</p>
            <p className="hover:underline cursor-pointer">Corporate Information</p>
            <p className="hover:underline cursor-pointer">Contact Us</p>
          </div>
        </div>
        <p className="text-xs">© 1997-2024 Kiaplay, Inc.</p>
      </footer>

      {/* Movie Detail Modal */}
      <AnimatePresence>
        {selectedMovie && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMovie(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-[#181818] rounded-xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button 
                onClick={() => setSelectedMovie(null)}
                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <X size={24} />
              </button>

              <div className="relative aspect-video">
                <img 
                  src={selectedMovie.Poster.replace('SX300', 'SX1280')} 
                  alt={selectedMovie.Title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-transparent" />
                <div className="absolute bottom-8 left-8">
                  <h2 className="text-4xl font-black mb-6">{selectedMovie.Title}</h2>
                  <div className="flex items-center gap-4">
                    <button className="flex items-center gap-2 bg-white text-black px-8 py-2 rounded font-bold hover:bg-white/80 transition-colors">
                      <Play size={20} fill="currentColor" />
                      Play
                    </button>
                    <button className="w-10 h-10 rounded-full border-2 border-gray-500 flex items-center justify-center hover:border-white transition-colors">
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                  <div className="flex items-center gap-3 text-sm font-bold">
                    <span className="text-green-500">98% Match</span>
                    <span className="text-gray-400">{selectedMovie.Year}</span>
                    <span className="border border-gray-600 px-1.5 py-0.5 rounded text-[10px]">HD</span>
                  </div>
                  <p className="text-lg leading-relaxed text-gray-200">
                    {selectedMovie.Plot}
                  </p>
                </div>
                <div className="space-y-4 text-sm">
                  <div>
                    <span className="text-gray-500">Cast: </span>
                    <span className="text-gray-300">Leonardo DiCaprio, Joseph Gordon-Levitt, Elliot Page</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Genres: </span>
                    <span className="text-gray-300">{selectedMovie.Genre}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Rating: </span>
                    <span className="text-gray-300">{selectedMovie.Rating || "TV-MA"}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function IntroAnimation({ onComplete }: { onComplete: () => void }) {
  const [showSkip, setShowSkip] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playTudum = () => {
    try {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -6;
      comp.knee.value = 4;
      comp.ratio.value = 8;
      comp.attack.value = 0.002;
      comp.release.value = 0.15;
      
      const bassShelf = ctx.createBiquadFilter();
      bassShelf.type = 'lowshelf';
      bassShelf.frequency.value = 120;
      bassShelf.gain.value = 10;
      bassShelf.connect(comp);
      comp.connect(ctx.destination);

      const sub = (time: number, freq: number, dur: number, gain: number) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 1.8, time);
        osc.frequency.exponentialRampToValueAtTime(freq, time + 0.06);
        env.gain.setValueAtTime(0, time);
        env.gain.linearRampToValueAtTime(gain, time + 0.008);
        env.gain.exponentialRampToValueAtTime(0.001, time + dur);
        osc.connect(env); env.connect(bassShelf);
        osc.start(time); osc.stop(time + dur + 0.05);
      };

      const body = (time: number, freq: number, dur: number, gain: number) => {
        [-4, 0, 4].forEach(detune => {
          const osc = ctx.createOscillator();
          const env = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq * 2, time);
          osc.frequency.exponentialRampToValueAtTime(freq, time + 0.05);
          osc.detune.value = detune;
          env.gain.setValueAtTime(0, time);
          env.gain.linearRampToValueAtTime(gain / 3, time + 0.01);
          env.gain.exponentialRampToValueAtTime(0.001, time + dur);
          osc.connect(env); env.connect(bassShelf);
          osc.start(time); osc.stop(time + dur + 0.05);
        });
      };

      const rumble = (time: number, dur: number, gain: number) => {
        const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 90; lp.Q.value = 1.2;
        const env = ctx.createGain();
        env.gain.setValueAtTime(gain, time);
        env.gain.exponentialRampToValueAtTime(0.001, time + dur);
        src.connect(lp); lp.connect(env); env.connect(bassShelf);
        src.start(time); src.stop(time + dur);
      };

      const t = ctx.currentTime + 0.05;
      sub(t,        28,  0.35, 1.1);
      body(t,       55,  0.25, 0.9);
      rumble(t,         0.1,  0.5);
      sub(t + 0.2,  22,  1.4,  1.4);
      sub(t + 0.2,  44,  1.1,  0.9);
      body(t + 0.2, 38,  1.0,  1.0);
      rumble(t + 0.2,   0.18, 0.7);
      sub(t + 0.25, 30,  1.8,  0.5);
    } catch (e) {
      console.warn("Audio context failed to start:", e);
    }
  };

  const handleReplay = () => {
    setAnimationKey(prev => prev + 1);
    playTudum();
  };

  useEffect(() => {
    const timer = setTimeout(onComplete, 5500);
    const skipTimer = setTimeout(() => setShowSkip(true), 1500);
    
    // Attempt to play sound
    const soundTimer = setTimeout(playTudum, 200);

    const handleInteraction = () => {
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      } else {
        playTudum();
      }
      window.removeEventListener('click', handleInteraction);
    };
    window.addEventListener('click', handleInteraction);

    return () => {
      clearTimeout(timer);
      clearTimeout(skipTimer);
      clearTimeout(soundTimer);
      window.removeEventListener('click', handleInteraction);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [onComplete, animationKey]);

  return (
    <div key={animationKey} className="fixed inset-0 z-[200] bg-black flex items-center justify-center overflow-hidden font-bebas">
      {/* Scanline texture */}
      <div className="fixed inset-0 pointer-events-none z-10 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_4px)]" />
      
      {/* Outer vignette */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.7)_100%)]" />

      <div className="relative flex flex-col items-center justify-center">
        {/* Ambient glow behind logo */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] bg-[radial-gradient(ellipse_at_center,rgba(229,9,20,0.18)_0%,transparent_70%)] opacity-0"
          style={{ animation: 'glowPulse 3.5s ease forwards 0.6s' }}
        />

        {/* Logo Group */}
        <div className="relative flex flex-col items-center">
          {/* The logo text */}
          <div 
            className="relative text-[clamp(80px,18vw,180px)] tracking-[0.04em] text-[#E50914] leading-none opacity-0 scale-[1.8] blur-[12px]"
            style={{ 
              animation: 'logoReveal 1.1s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.15s',
              textShadow: '0 0 60px rgba(229,9,20,0.5), 0 0 120px rgba(229,9,20,0.2)'
            }}
          >
            KIAPLAY
            {/* Bottom bar */}
            <div 
              className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 h-[4px] bg-[linear-gradient(90deg,transparent,#E50914_20%,#ff2a37_50%,#E50914_80%,transparent)] rounded-[2px] shadow-[0_0_20px_rgba(229,9,20,0.8),0_0_40px_rgba(229,9,20,0.4)]"
              style={{ animation: 'barGrow 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards 0.85s' }}
            />
          </div>

          {/* Reflection below - perfectly aligned via flex container */}
          <div 
            className="mt-4 text-[clamp(80px,18vw,180px)] tracking-[0.04em] text-[#E50914] leading-none opacity-0 pointer-events-none select-none blur-[1px]"
            style={{ 
              animation: 'reflectionReveal 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.25s',
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 60%)',
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 60%)'
            }}
            aria-hidden="true"
          >
            KIAPLAY
          </div>

          {/* Horizontal light sweep */}
          <div 
            className="absolute top-0 -left-full w-[60%] h-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.04)_30%,rgba(255,180,180,0.12)_50%,rgba(255,255,255,0.04)_70%,transparent_100%)] opacity-0 pointer-events-none"
            style={{ animation: 'sweep 1s ease forwards 0.9s' }}
          />
        </div>

        {/* Tagline */}
        <div 
          className="mt-12 font-sans text-[clamp(10px,1.8vw,14px)] tracking-[0.35em] text-white/45 whitespace-nowrap opacity-0 uppercase"
          style={{ animation: 'taglineIn 0.8s ease forwards 1.3s' }}
        >
          A SOLHEIM STUDIOS CORPORATION
        </div>
      </div>

      {/* Skip & Replay Buttons */}
      <div className="absolute bottom-12 right-12 flex items-center gap-4 z-20">
        <AnimatePresence>
          {showSkip && (
            <>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleReplay}
                className="px-6 py-2 border border-white/20 rounded text-xs uppercase tracking-widest hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                ↺ Replay
              </motion.button>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onComplete}
                className="px-6 py-2 border border-white/20 rounded text-xs uppercase tracking-widest hover:bg-white/10 transition-colors"
              >
                Skip Intro
              </motion.button>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MovieRow({ title, movies, onSelect }: { title: string, movies: Movie[], onSelect: (id: string) => void }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (rowRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
      setShowLeft(scrollLeft > 0);
      setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  return (
    <div className="space-y-2 px-4 md:px-12 group/row">
      <h2 className="text-xl font-bold text-gray-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1">
        {title} <ChevronRight size={20} className="opacity-0 group-hover/row:opacity-100 transition-opacity" />
      </h2>
      
      <div className="relative group">
        {showLeft && (
          <button 
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-40 w-12 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <ChevronLeft size={40} />
          </button>
        )}
        
        <div 
          ref={rowRef}
          onScroll={handleScroll}
          className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth py-4"
        >
          {movies.map((movie) => (
            <motion.div
              key={movie.imdbID}
              whileHover={{ scale: 1.05, zIndex: 30 }}
              onClick={() => onSelect(movie.imdbID)}
              className="relative flex-none w-28 sm:w-36 md:w-56 aspect-[2/3] rounded-md overflow-hidden cursor-pointer shadow-lg"
            >
              <img 
                src={movie.Poster} 
                alt={movie.Title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center">
                    <Play size={16} fill="currentColor" />
                  </div>
                  <div className="w-8 h-8 rounded-full border-2 border-gray-400 flex items-center justify-center hover:border-white">
                    <Plus size={16} />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {showRight && (
          <button 
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-40 w-12 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <ChevronRight size={40} />
          </button>
        )}
      </div>
    </div>
  );
}
