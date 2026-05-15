import React, { useState, useEffect, useRef, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, CheckSquare, Clock, Calendar, 
  TrainFront, Timer as TimerIcon, Loader2, 
  X, Edit2, Maximize2, Minimize2, Cloud, Sun, 
  ChevronLeft, ChevronRight,
  CloudRain, Wind, Thermometer, Play, Pause, RotateCcw,
  LayoutDashboard, Newspaper, ArrowUpRight, Book
} from 'lucide-react';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, handleFirestoreError, OperationType, auth, onAuthStateChanged } from '../firebase';
import Button from './ui/Button';
import { ThemeContext } from '../contexts/ThemeContext';

interface DashboardItem {
  id: string;
  title: string;
  description?: string;
  type: 'task' | 'event';
  startDate?: any;
  targetDate: any;
  color?: string;
  completed: boolean;
  createdAt: any;
}

interface WeatherData {
  temp: number;
  condition: string;
  wind: number;
  symbol: string;
}

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  logo: string;
  contentSnippet?: string;
}

interface Quote {
  id: string;
  text: string;
  author: string;
  createdAt: any;
}

interface TickerMessage {
  id: string;
  text: string;
  createdAt: any;
}

interface TimetableBoard {
  id: string;
  url: string;
  name: string;
  order: number;
  createdAt: any;
}

export default function SampolDashboard() {
  const [user, setUser] = useState<any>(null);
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [quotes, setQuotes] = useState<Quote[] | any[]>([]);
  const [tickerMessages, setTickerMessages] = useState<TickerMessage[]>([]);
  const [timetableBoards, setTimetableBoards] = useState<TimetableBoard[]>([]);
  const [activeQuoteIndex, setActiveQuoteIndex] = useState(0);
  const [activeBoardIndex, setActiveBoardIndex] = useState(0);
  const [boardTimer, setBoardTimer] = useState(15);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [addMode, setAddMode] = useState<'item' | 'quote' | 'ticker' | 'board'>('item');
  const [editingItem, setEditingItem] = useState<DashboardItem | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const getIframeUrl = (url: string) => {
    if (!url) return '';
    // Handle local routes or files
    if (url.startsWith('/') || url.includes('Fly.html') || url.includes('fly-bergen')) {
      return url;
    }
    // Avinor specific support: Map official flight status URL to our internal component
    if (url.includes('avinor.no/flyplass/bergen/flytider')) {
      const dir = url.toLowerCase().includes('arrival') ? 'A' : 'D';
      return `/fly-bergen?direction=${dir}`;
    }
    // Entur Tavla specific dark mode parameter
    if (url.includes('vis-tavla.entur.no')) {
      const separator = url.includes('?') ? '&' : '?';
      return isDark ? `${url}${separator}theme=dark` : url;
    }
    return url;
  };

  const [quoteFormData, setQuoteFormData] = useState({
    text: '',
    author: ''
  });

  const [tickerFormData, setTickerFormData] = useState({
    text: ''
  });

  const [boardFormData, setBoardFormData] = useState({
    name: '',
    url: ''
  });

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (isFull) {
        document.documentElement.classList.add('dashboard-fullscreen-active');
      } else {
        document.documentElement.classList.remove('dashboard-fullscreen-active');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.documentElement.classList.remove('dashboard-fullscreen-active');
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (dashboardRef.current?.requestFullscreen) {
        dashboardRef.current.requestFullscreen().catch(() => {
          setIsFullscreen(true);
          document.documentElement.classList.add('dashboard-fullscreen-active');
        });
      } else {
        setIsFullscreen(true);
        document.documentElement.classList.add('dashboard-fullscreen-active');
      }
    } else {
      document.exitFullscreen().catch(() => {
        setIsFullscreen(false);
        document.documentElement.classList.remove('dashboard-fullscreen-active');
      });
    }
  };
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [academicNews, setAcademicNews] = useState<NewsItem[]>([]);
  const [newsTab, setNewsTab] = useState<'news' | 'academic'>('news');
  const [fetchingNews, setFetchingNews] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'event' as 'task' | 'event',
    startDate: '',
    targetDate: '',
    color: ''
  });
  const [now, setNow] = useState(new Date());
  
  const isAdmin = user && (user.email === 'kianoshsolheim@gmail.com' || user.email === 'kianosh@solheim.online');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const COLORS = [
    { name: 'Default', value: '' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Orange', value: '#f97316' },
  ];

  useEffect(() => {
    const q = query(collection(db, 'sampol_dashboard_items'), orderBy('targetDate', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DashboardItem[];
      setItems(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sampol_dashboard_items'));

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'quotes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Quote[];
      setQuotes(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'quotes'));

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'ticker_messages'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TickerMessage[];
      setTickerMessages(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'ticker_messages'));

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'timetable_boards'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TimetableBoard[];
      setTimetableBoards(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'timetable_boards'));

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (timetableBoards.length <= 1) {
      setBoardTimer(15);
      if (activeBoardIndex !== 0) setActiveBoardIndex(0);
      return;
    }
    
    const interval = setInterval(() => {
      setBoardTimer((prev) => prev - 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timetableBoards.length, activeBoardIndex]);

  useEffect(() => {
    if (boardTimer <= 0 && timetableBoards.length > 1) {
      setActiveBoardIndex((prev) => (prev + 1) % timetableBoards.length);
      setBoardTimer(15);
    }
  }, [boardTimer, timetableBoards.length]);

  useEffect(() => {
    if (activeBoardIndex >= timetableBoards.length && timetableBoards.length > 0) {
      setActiveBoardIndex(0);
      setBoardTimer(15);
    }
  }, [timetableBoards.length, activeBoardIndex]);

  useEffect(() => {
    if (quotes.length <= 1) return;
    
    const interval = setInterval(() => {
      setActiveQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 15000); // 15 seconds
    
    return () => clearInterval(interval);
  }, [quotes.length]);

  useEffect(() => {
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Weather Logic
  useEffect(() => {
    fetchWeather();
    const weatherInterval = setInterval(fetchWeather, 60 * 60 * 1000); // 1 hour
    return () => clearInterval(weatherInterval);
  }, []);

  // News Logic
  useEffect(() => {
    fetchNews();
    const newsInterval = setInterval(fetchNews, 15 * 60 * 1000); // 15 mins
    return () => clearInterval(newsInterval);
  }, []);

  const fetchNews = async () => {
    setFetchingNews(true);
    try {
      // Since this is hosted on GitHub Pages, we don't have a backend proxy.
      // We'll use a public CORS proxy and rss-parser to fetch directly in the client.
      const RSS_FEEDS = {
        news: [
          { url: 'https://www.nrk.no/toppsaker.rss', source: 'NRK' },
          { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC' }
        ],
        academic: [
          { url: 'https://www.uib.no/aktuelt/rss', source: 'UiB' },
          { url: 'https://www.chathamhouse.org/rss/news', source: 'Chatham House' }
        ]
      };

      const fetchFeed = async (feedUrl: string, sourceName: string) => {
        try {
          // Use corsproxy.io to bypass CORS - it's often more reliable for plain text/xml
          const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(feedUrl)}`;
          const res = await fetch(proxyUrl);
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          const xmlContent = await res.text();
          
          if (!xmlContent || xmlContent.trim().startsWith('<!DOCTYPE html>')) {
            throw new Error('Received HTML instead of XML');
          }

          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
          
          // Check for parsing errors
          const parseError = xmlDoc.getElementsByTagName("parsererror");
          if (parseError.length > 0) throw new Error('XML parsing error');

          const items = Array.from(xmlDoc.querySelectorAll("item")).slice(0, 5);
          
          return items.map(item => ({
            title: item.querySelector("title")?.textContent || 'No Title',
            link: item.querySelector("link")?.textContent || '#',
            pubDate: item.querySelector("pubDate")?.textContent || new Date().toISOString(),
            source: sourceName,
            logo: ''
          }));
        } catch (err) {
          console.warn(`Failed to fetch ${sourceName}:`, err);
          return [];
        }
      };

      const [newsResults, academicResults] = await Promise.all([
        Promise.all(RSS_FEEDS.news.map(f => fetchFeed(f.url, f.source))),
        Promise.all(RSS_FEEDS.academic.map(f => fetchFeed(f.url, f.source)))
      ]);

      setNews(newsResults.flat().sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()));
      setAcademicNews(academicResults.flat().sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()));
    } catch (e) {
      console.error('News fetch fail:', e);
    } finally {
      setFetchingNews(false);
    }
  };
  const fetchWeather = async () => {
    setFetchingWeather(true);
    try {
      // Bergen coords
      const lat = 60.3913;
      const lon = 5.3221;
      const response = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat}&lon=${lon}`, {
        headers: { 'User-Agent': 'KianoshPortfolio/1.0 kianoshsolheim@gmail.com' }
      });
      if (!response.ok) throw new Error('Weather fetch failed');
      const data = await response.json();
      const current = data.properties.timeseries[0].data;
      setWeather({
        temp: current.instant.details.air_temperature,
        condition: current.next_1_hours.summary.symbol_code,
        wind: current.instant.details.wind_speed,
        symbol: current.next_1_hours.summary.symbol_code
      });
    } catch (e) {
      console.error('Weather fetch fail:', e);
    } finally {
      setFetchingWeather(false);
    }
  };

  const translateWeatherCondition = (condition: string) => {
    if (!condition) return '';
    const code = condition.split('_')[0];
    const translations: Record<string, string> = {
      'clearsky': 'Klarvær',
      'fair': 'Lettskyet',
      'partlycloudy': 'Delvis skyet',
      'cloudy': 'Skyet',
      'rain': 'Regn',
      'heavyrain': 'Kraftig regn',
      'lightrain': 'Lett regn',
      'rainshowers': 'Regnbyger',
      'lightrainshowers': 'Lette regnbyger',
      'heavyrainshowers': 'Kraftige regnbyger',
      'snow': 'Snø',
      'heavysnow': 'Kraftig snø',
      'lightsnow': 'Lett snø',
      'snowshowers': 'Snøbyger',
      'lightsnowshowers': 'Lette snøbyger',
      'heavysnowshowers': 'Kraftige snøbyger',
      'sleet': 'Sludd',
      'heavyrainandthunder': 'Kraftig regn og torden',
      'heavyrainshowersandthunder': 'Kraftige regnbyger og torden',
      'lightrainandthunder': 'Lett regn og torden',
      'lightrainshowersandthunder': 'Lette regnbyger og torden',
      'rainandthunder': 'Regn og torden',
      'rainshowersandthunder': 'Regnbyger og torden',
      'sleetandthunder': 'Sludd og torden',
      'sleetshowersandthunder': 'Sluddbyger og torden',
      'snowandthunder': 'Snø og torden',
      'snowshowersandthunder': 'Snøbyger og torden',
      'fog': 'Tåke'
    };
    return translations[code] || condition.replace(/_/g, ' ');
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.targetDate) return;

    try {
      const data = {
        ...formData,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        targetDate: new Date(formData.targetDate).toISOString(),
        completed: false,
        createdAt: serverTimestamp()
      };

      if (editingItem) {
        await updateDoc(doc(db, 'sampol_dashboard_items', editingItem.id), data);
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'sampol_dashboard_items'), data);
        setIsAdding(false);
      }
      setFormData({ title: '', description: '', type: 'event', startDate: '', targetDate: '', color: '' });
    } catch (error) {
      handleFirestoreError(error, editingItem ? OperationType.UPDATE : OperationType.CREATE, 'sampol_dashboard_items');
    }
  };

  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteFormData.text || !quoteFormData.author) return;

    try {
      await addDoc(collection(db, 'quotes'), {
        ...quoteFormData,
        createdAt: serverTimestamp()
      });
      setQuoteFormData({ text: '', author: '' });
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'quotes');
    }
  };

  const handleAddTickerMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tickerFormData.text) return;

    try {
      await addDoc(collection(db, 'ticker_messages'), {
        ...tickerFormData,
        createdAt: serverTimestamp()
      });
      setTickerFormData({ text: '' });
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'ticker_messages');
    }
  };

  const handleAddTimetableBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardFormData.name || !boardFormData.url) return;

    try {
      await addDoc(collection(db, 'timetable_boards'), {
        ...boardFormData,
        order: timetableBoards.length,
        createdAt: serverTimestamp()
      });
      setBoardFormData({ name: '', url: '' });
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'timetable_boards');
    }
  };

  const deleteTimetableBoard = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'timetable_boards', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `timetable_boards/${id}`);
    }
  };

  const deleteTickerMessage = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'ticker_messages', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `ticker_messages/${id}`);
    }
  };

  const deleteQuote = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'quotes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `quotes/${id}`);
    }
  };

  const startEditing = (item: DashboardItem) => {
    setEditingItem(item);
    setIsAdding(true);
    setFormData({
      title: item.title,
      description: item.description || '',
      type: item.type,
      startDate: item.startDate ? new Date(item.startDate).toISOString().slice(0, 16) : '',
      targetDate: new Date(item.targetDate).toISOString().slice(0, 16),
      color: item.color || ''
    });
  };

  const toggleComplete = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'sampol_dashboard_items', id), { completed: !current });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sampol_dashboard_items/${id}`);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'sampol_dashboard_items', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sampol_dashboard_items/${id}`);
    }
  };

  const formatCountdown = (item: DashboardItem) => {
    const start = item.startDate ? new Date(item.startDate) : null;
    const end = new Date(item.targetDate);
    
    let target = end;
    let label = 'Ends in';

    if (start && now < start) {
      target = start;
      label = 'Starts in';
    } else if (now > end) {
      return <span className="text-[10px] uppercase font-black tracking-widest text-ink/40">Passed</span>;
    }

    const diff = target.getTime() - now.getTime();
    const weeks = Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
    const days = Math.floor((diff % (1000 * 60 * 60 * 24 * 7)) / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return (
      <div className="space-y-2">
        <p className="text-[9px] uppercase tracking-[0.2em] font-black opacity-40">{label}</p>
        <div className="flex gap-4">
          {weeks > 0 && (
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold">{weeks}</span>
              <span className="text-[10px] uppercase tracking-tighter opacity-50">Wks</span>
            </div>
          )}
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold">{days}</span>
            <span className="text-[10px] uppercase tracking-tighter opacity-50">Days</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold">{hours.toString().padStart(2, '0')}</span>
            <span className="text-[10px] uppercase tracking-tighter opacity-50">Hrs</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold font-mono">{seconds.toString().padStart(2, '0')}</span>
            <span className="text-[10px] uppercase tracking-tighter opacity-50">Sec</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  return (
    <div 
      ref={dashboardRef}
      className={`transition-all duration-500 ease-in-out ${isFullscreen ? 'fixed inset-0 z-[100] bg-paper p-8 flex flex-col h-screen overflow-hidden' : 'max-w-7xl mx-auto px-4 py-12'}`}
    >
      {/* Top Ticker Bar */}
      <div className={`w-full overflow-hidden mb-4 border-b border-ink/5 pb-1`}>
        {tickerMessages.length > 0 ? (
          <div className="relative w-full flex items-center h-6">
            <div className="whitespace-nowrap flex animate-ticker w-max">
              {[...tickerMessages, ...tickerMessages, ...tickerMessages, ...tickerMessages].map((msg, i) => (
                <div key={`${msg.id}-${i}`} className="flex items-center gap-4 px-8">
                  <p className={`uppercase tracking-[0.25em] font-black ${isFullscreen ? 'text-[10px] text-ink/40' : 'text-[9px] text-ink/30'}`}>
                    {msg.text}
                  </p>
                  <div className="w-1.5 h-1.5 rounded-full bg-accent/20" />
                  {!isFullscreen && isAdmin && (
                    <button 
                      onClick={() => deleteTickerMessage(msg.id)}
                      className="text-red-500/0 group-hover:text-red-500/50 hover:text-red-500 transition-colors"
                      title="Slett melding"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full text-center">
            <p className="text-[8px] text-ink/30 uppercase tracking-[0.25em] font-black">
              SAMPOL Dashboard er en tjeneste laget av Kianosh F. Solheim
            </p>
          </div>
        )}
      </div>

      <div className={`flex flex-col md:flex-row justify-between items-start md:items-end ${isFullscreen ? 'mb-4 justify-center' : 'mb-8'} gap-6 flex-shrink-0`}>
        {!isFullscreen && (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-accent/10 rounded-xl text-accent">
                <LayoutDashboard size={24} />
              </div>
              <h1 className="text-4xl font-serif">SAMPOL Dashboard</h1>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="text-ink/60 uppercase text-[10px] tracking-[0.3em] font-black">
                {now.toLocaleDateString('no-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <div className="hidden md:block w-1 h-1 bg-ink/20 rounded-full" />
              <p className="text-4xl font-mono font-black text-accent tracking-tighter">
                {now.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          </div>
        )}
        <div className="flex gap-2 w-full md:w-auto">
          {!isFullscreen && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={toggleFullscreen}
              icon={Maximize2}
              className="flex-grow md:flex-none py-2 text-[10px]"
            >
              Fullskjerm
            </Button>
          )}
          {!isFullscreen && isAdmin && (
            <>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setAddMode('ticker');
                  setIsAdding(true);
                }}
                className="flex-grow md:flex-none py-2 text-[10px]"
              >
                Add Ticker Message
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setAddMode('quote');
                  setIsAdding(true);
                }}
                className="flex-grow md:flex-none py-2 text-[10px]"
              >
                Add Quote
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setAddMode('board');
                  setIsAdding(true);
                }}
                className="flex-grow md:flex-none py-2 text-[10px]"
              >
                Add Timetable
              </Button>
              <Button 
                variant="primary" 
                size="sm"
                onClick={() => {
                  if (isAdding && addMode === 'item') {
                    setIsAdding(false);
                    setEditingItem(null);
                    setFormData({ title: '', description: '', type: 'event', startDate: '', targetDate: '', color: '' });
                  } else {
                    setAddMode('item');
                    setIsAdding(true);
                  }
                }}
                icon={isAdding && addMode === 'item' ? X : Plus}
                magnetic={true}
                className="flex-grow md:flex-none py-2 text-[10px]"
              >
                {isAdding && addMode === 'item' ? 'Cancel' : 'Add Item'}
              </Button>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-8 bg-surface p-6 rounded-2xl border border-ink/5"
          >
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-ink/5">
              <h3 className="text-xs font-black uppercase tracking-widest text-ink">
                {addMode === 'item' ? (editingItem ? 'Edit Item' : 'New Dashboard Item') : addMode === 'quote' ? 'Add New Quote' : addMode === 'ticker' ? 'Add Ticker Message' : 'Add Timetable Board'}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                <X size={16} />
              </Button>
            </div>

            {addMode === 'item' ? (
              <form onSubmit={handleAddItem} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[9px] uppercase tracking-widest text-ink/40 mb-1.5">Title</label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full bg-paper border border-ink/10 rounded-lg p-2.5 text-sm outline-none focus:border-accent"
                        placeholder="Enter title..."
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-widest text-ink/40 mb-1.5">Color</label>
                      <div className="flex flex-wrap gap-1.5">
                        {COLORS.map(c => (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => setFormData({ ...formData, color: c.value })}
                            className={`w-5 h-5 rounded-full border-2 transition-all ${
                              formData.color === c.value ? 'border-ink scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c.value || '#f5f5f5' }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] uppercase tracking-widest text-ink/40 mb-1.5">Start Date (Opt)</label>
                        <input
                          type="datetime-local"
                          value={formData.startDate}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                          className="w-full bg-paper border border-ink/10 rounded-lg p-2.5 text-sm outline-none focus:border-accent"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase tracking-widest text-ink/40 mb-1.5">End Date & Time</label>
                        <input
                          type="datetime-local"
                          required
                          value={formData.targetDate}
                          onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                          className="w-full bg-paper border border-ink/10 rounded-lg p-2.5 text-sm outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-widest text-ink/40 mb-1.5">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full bg-paper border border-ink/10 rounded-lg p-2.5 text-sm outline-none focus:border-accent h-[36px] resize-none"
                        placeholder="Brief description..."
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-3 border-t border-ink/5">
                  <Button type="submit" variant="primary" size="sm">
                    {editingItem ? 'Update Item' : 'Create Item'}
                  </Button>
                </div>
              </form>
            ) : addMode === 'quote' ? (
              <form onSubmit={handleAddQuote} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-ink/40 mb-1.5">Quote Text</label>
                    <textarea
                      required
                      value={quoteFormData.text}
                      onChange={(e) => setQuoteFormData({ ...quoteFormData, text: e.target.value })}
                      className="w-full bg-paper border border-ink/10 rounded-lg p-2.5 text-sm outline-none focus:border-accent h-[100px] resize-none"
                      placeholder="Enter the quote..."
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-ink/40 mb-1.5">Author</label>
                    <input
                      type="text"
                      required
                      value={quoteFormData.author}
                      onChange={(e) => setQuoteFormData({ ...quoteFormData, author: e.target.value })}
                      className="w-full bg-paper border border-ink/10 rounded-lg p-2.5 text-sm outline-none focus:border-accent"
                      placeholder="Who said it?"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-3 border-t border-ink/5">
                  <Button type="submit" variant="primary" size="sm">
                    Add Quote
                  </Button>
                </div>
              </form>
            ) : addMode === 'ticker' ? (
              <form onSubmit={handleAddTickerMessage} className="space-y-4">
                <div className="max-w-xl">
                  <label className="block text-[9px] uppercase tracking-widest text-ink/40 mb-1.5">Ticker Message</label>
                  <input
                    type="text"
                    required
                    value={tickerFormData.text}
                    onChange={(e) => setTickerFormData({ text: e.target.value })}
                    className="w-full bg-paper border border-ink/10 rounded-lg p-2.5 text-sm outline-none focus:border-accent"
                    placeholder="Enter short message for the top ticker..."
                  />
                </div>
                <div className="flex justify-end gap-3 pt-3 border-t border-ink/5">
                  <Button type="submit" variant="primary" size="sm">
                    Add Ticker Message
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddTimetableBoard} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-ink/40 mb-1.5">Board Name</label>
                    <input
                      type="text"
                      required
                      value={boardFormData.name}
                      onChange={(e) => setBoardFormData({ ...boardFormData, name: e.target.value })}
                      className="w-full bg-paper border border-ink/10 rounded-lg p-2.5 text-sm outline-none focus:border-accent"
                      placeholder="e.g. Festplassen"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-ink/40 mb-1.5">Board URL (Entur or Local)</label>
                    <input
                      type="text"
                      required
                      value={boardFormData.url}
                      onChange={(e) => setBoardFormData({ ...boardFormData, url: e.target.value })}
                      className="w-full bg-paper border border-ink/10 rounded-lg p-2.5 text-sm outline-none focus:border-accent"
                      placeholder="Entur-URL, Avinor-URL eller /fly-bergen"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-3 border-t border-ink/5">
                  <Button type="submit" variant="primary" size="sm">
                    Add Timetable
                  </Button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 ${isFullscreen ? 'flex-grow min-h-0 overflow-hidden' : ''}`}>
        <div className={`flex flex-col gap-8 ${isFullscreen ? 'overflow-hidden h-full' : 'space-y-8'}`}>
          <section className={`flex flex-col ${isFullscreen ? 'hidden' : ''}`}>
            <div className="flex items-center gap-3 mb-6 flex-shrink-0">
              <TimerIcon className="text-accent" size={20} />
              <h2 className="text-lg font-serif">Countdowns</h2>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {items.filter(item => item.type === 'event').length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-ink/5 rounded-2xl">
                  <p className="text-ink/40 text-xs uppercase tracking-widest">No active countdowns</p>
                </div>
              ) : (
                items
                  .filter(item => item.type === 'event')
                  .map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    className={`p-6 rounded-2xl border transition-all flex-shrink-0 ${
                      item.completed 
                        ? 'bg-paper border-ink/5 opacity-50' 
                        : 'bg-surface border-ink/5 shadow-sm hover:shadow-md'
                    }`}
                    style={!item.completed && item.color ? { borderColor: `${item.color}40`, background: `linear-gradient(to bottom right, var(--surface), ${item.color}10)` } : {}}
                  >
                    <div className="flex justify-between items-start gap-6">
                      <div className="flex-grow">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className={`font-medium ${item.completed ? 'opacity-50' : ''}`}>
                            {item.title}
                          </h3>
                        </div>
                        {item.description && (
                          <p className={`text-xs text-ink/60 ${isFullscreen ? 'line-clamp-1' : 'mb-4'}`}>{item.description}</p>
                        )}
                        {!item.completed && (
                          <div className={isFullscreen ? 'scale-90 origin-left mt-2' : ''}>
                            {formatCountdown(item)}
                          </div>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => toggleComplete(item.id, item.completed)}
                            className={item.completed ? 'text-green-500' : 'text-ink/30'}
                          >
                            <CheckSquare size={18} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => startEditing(item)}
                          >
                            <Edit2 size={16} className="text-ink/30 hover:text-accent" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => deleteItem(item.id)}
                            className="text-red-500/50 hover:text-red-500"
                          >
                            <Trash2 size={18} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </section>

          <div className={`${isFullscreen ? 'flex flex-col gap-4 flex-grow min-h-0 overflow-hidden' : 'grid grid-cols-1 gap-8'}`}>
            {isFullscreen ? (
              <>
                <div className="grid grid-cols-3 gap-4 flex-shrink-0">
                  <section className="bg-surface p-4 rounded-3xl border border-ink/5 shadow-xl relative overflow-hidden group">
                    {/* Weather Content */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                          <Thermometer size={18} />
                        </div>
                        <div>
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-ink">Bergen</h3>
                          <p className="text-[8px] text-ink/40 uppercase tracking-tighter">MET.NO data</p>
                        </div>
                      </div>
                      {fetchingWeather && <Loader2 size={14} className="animate-spin text-ink/20" />}
                    </div>

                    {weather ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-3xl font-mono font-black tracking-tighter text-ink">
                            {Math.round(weather.temp)}°
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <Wind size={10} className="text-ink/40" />
                            <p className="text-[9px] font-black uppercase tracking-widest text-ink/40">{weather.wind} m/s</p>
                          </div>
                        </div>
                        <div className="w-10 h-10 bg-accent/5 rounded-xl flex items-center justify-center">
                          {weather.symbol.includes('rain') ? <CloudRain className="text-blue-500" size={20} /> : 
                           weather.symbol.includes('sun') || weather.symbol.includes('clear') ? <Sun className="text-orange-500" size={20} /> : 
                           <Cloud className="text-ink/60" size={20} />}
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 flex flex-col items-center gap-1 text-ink/20">
                        <Cloud size={20} />
                        <p className="text-[8px] uppercase tracking-widest font-black">Laster...</p>
                      </div>
                    )}
                  </section>

                  <section className="bg-surface p-4 rounded-3xl border border-ink/5 shadow-xl relative overflow-hidden flex flex-col justify-center items-center text-center">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,var(--accent-rgb,100,100,100)_0%,transparent_70%)] opacity-[0.03]" />
                    <div className="relative">
                      <div className="flex items-center justify-center gap-2">
                        <p className="text-4xl font-mono font-black tracking-tight text-accent">
                          {now.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-xl font-mono font-medium text-ink/40">
                          :{now.toLocaleTimeString('no-NO', { second: '2-digit' })}
                        </p>
                      </div>
                      <div className="pt-2 mt-1 border-t border-ink/5">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-ink/60">
                          {now.toLocaleDateString('no-NO', { weekday: 'long' })}
                        </p>
                        <p className="text-[10px] font-serif italic text-ink">
                          {now.toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="bg-surface p-4 rounded-3xl border border-ink/5 shadow-xl relative overflow-hidden flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-accent/10 rounded-lg text-accent">
                        <TimerIcon size={14} />
                      </div>
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-ink">Countdowns</h3>
                    </div>
                    
                    <div className="space-y-3 overflow-y-auto custom-scrollbar flex-grow pr-1">
                      {items.filter(i => i.type === 'event' && !i.completed).length > 0 ? (
                        items.filter(i => i.type === 'event' && !i.completed).map(item => (
                          <div key={item.id} className="group">
                            <div className="flex justify-between items-center mb-1">
                              <h4 className="text-[10px] font-bold truncate text-ink max-w-[120px]">{item.title}</h4>
                              <p className="text-[8px] font-black uppercase tracking-widest text-accent">
                                {Math.ceil((new Date(item.targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))}d
                              </p>
                            </div>
                            <div className="h-1 bg-ink/5 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: '100%' }}
                                className="h-full bg-accent/30"
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 py-2">
                          <TimerIcon size={16} />
                          <p className="text-[8px] font-black uppercase mt-1">Empty</p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                  <div className={`grid grid-cols-2 gap-4 flex-grow min-h-0 h-full`}>
                    {/* Verden Feed */}
                    <section className="bg-surface p-4 rounded-3xl border border-ink/5 shadow-xl relative overflow-hidden flex flex-col min-h-0">
                      <div className="flex justify-between items-center mb-3 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-accent/10 rounded-lg text-accent">
                            <Newspaper size={14} />
                          </div>
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-ink">Verden</h3>
                        </div>
                        {fetchingNews && <Loader2 size={12} className="animate-spin text-ink/20" />}
                      </div>

                      <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-grow">
                        {news.length > 0 ? (
                          news.map((item, index) => (
                            <motion.a
                              key={`news-${index}`}
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block group"
                            >
                              <div className="flex justify-between items-start gap-4">
                                <div className="space-y-1 flex-grow">
                                  <h4 className="text-[11px] font-medium leading-tight text-ink group-hover:text-accent transition-colors line-clamp-2">
                                    {item.title}
                                  </h4>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-black tracking-widest uppercase text-ink/40">
                                      {item.source}
                                    </span>
                                    <div className="w-1 h-1 bg-ink/10 rounded-full" />
                                    <p className="text-[9px] text-ink/40 uppercase tracking-tighter font-mono">
                                      {new Date(item.pubDate).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              {index < news.length - 1 && <div className="h-px bg-ink/5 mt-3" />}
                            </motion.a>
                          ))
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center opacity-20 py-4 text-center">
                            <Newspaper size={24} />
                            <p className="text-[9px] uppercase tracking-widest font-black mt-2">
                              {fetchingNews ? 'Laster...' : 'Ingen nyheter'}
                            </p>
                          </div>
                        )}
                      </div>
                    </section>

                    {/* Akademisk & Sitater Feed */}
                    <div className="flex flex-col gap-4 min-h-0 h-full overflow-hidden">
                      <section className="bg-surface p-4 rounded-3xl border border-ink/5 shadow-xl relative overflow-hidden flex flex-col flex-[1.5] min-h-0">
                        <div className="flex justify-between items-center mb-3 flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-accent/10 rounded-lg text-accent">
                              <Book size={14} />
                            </div>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-ink">Akademisk</h3>
                          </div>
                        </div>

                        <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-grow">
                          {academicNews.length > 0 ? (
                            academicNews.map((item, index) => (
                              <motion.a
                                key={`academic-${index}`}
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block group"
                              >
                                <div className="flex justify-between items-start gap-4">
                                  <div className="space-y-1 flex-grow">
                                    <h4 className="text-[11px] font-medium leading-tight text-ink group-hover:text-accent transition-colors line-clamp-2">
                                      {item.title}
                                    </h4>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[8px] font-black tracking-widest uppercase text-ink/40">
                                        {item.source}
                                      </span>
                                      <div className="w-1 h-1 bg-ink/10 rounded-full" />
                                      <p className="text-[9px] text-ink/40 uppercase tracking-tighter font-mono">
                                        {new Date(item.pubDate).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })} • {new Date(item.pubDate).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                {index < academicNews.length - 1 && <div className="h-px bg-ink/5 mt-3" />}
                              </motion.a>
                            ))
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center opacity-20 py-4 text-center">
                              <Book size={24} />
                              <p className="text-[9px] uppercase tracking-widest font-black mt-2">
                                {fetchingNews ? 'Laster...' : 'Ingen nyheter'}
                              </p>
                            </div>
                          )}
                        </div>
                      </section>

                      {/* Siterte Sitater Widget */}
                      <section className="bg-surface p-4 rounded-3xl border border-ink/5 shadow-xl relative overflow-hidden flex flex-col flex-1 min-h-0">
                        <div className="flex justify-between items-center mb-3 flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-accent/10 rounded-lg text-accent">
                              <Edit2 size={14} />
                            </div>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-ink">Siterte Sitater</h3>
                          </div>
                        </div>

                        <div className="flex-grow relative">
                          {quotes.length > 0 ? (
                            <div className="h-full relative overflow-hidden">
                              <AnimatePresence mode="wait">
                                <motion.div
                                  key={quotes[activeQuoteIndex]?.id || 'empty'}
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  transition={{ duration: 0.5, ease: "easeInOut" }}
                                  className="absolute inset-0 flex flex-col justify-center"
                                >
                                  <p className="text-[18px] md:text-[24px] font-serif italic text-ink leading-relaxed mb-4 text-center px-4">
                                    "{quotes[activeQuoteIndex]?.text}"
                                  </p>
                                  <div className="flex justify-center items-center">
                                    <p className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.2em] text-accent">
                                      — {quotes[activeQuoteIndex]?.author}
                                    </p>
                                  </div>
                                </motion.div>
                              </AnimatePresence>

                              {!isFullscreen && isAdmin && (
                                <button 
                                  onClick={() => deleteQuote(quotes[activeQuoteIndex].id)}
                                  className="absolute bottom-0 right-0 p-2 text-red-500/30 hover:text-red-500 transition-colors"
                                  title="Slett sitat"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                              
                              <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1.5 pb-2">
                                {quotes.map((_, idx) => (
                                  <div 
                                    key={idx}
                                    className={`w-1 h-1 rounded-full transition-all duration-500 ${
                                      idx === activeQuoteIndex ? 'bg-accent w-3' : 'bg-ink/10'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center opacity-20 py-2">
                              <p className="text-[8px] font-black uppercase tracking-widest">Ingen sitater</p>
                            </div>
                          )}
                        </div>
                      </section>
                    </div>
                  </div>
                </>
              ) : (

              <>
                <section className="bg-surface p-8 rounded-3xl border border-ink/5 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                        <Thermometer size={24} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-ink">Bergen</h3>
                        <p className="text-[10px] text-ink/40 uppercase tracking-tighter">MET.NO data</p>
                      </div>
                    </div>
                    {fetchingWeather && <Loader2 size={16} className="animate-spin text-ink/20" />}
                  </div>

                  {weather ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-6xl font-mono font-black tracking-tighter text-ink">
                          {Math.round(weather.temp)}°
                        </p>
                        <p className="text-xs font-black uppercase tracking-widest text-ink/40 mt-2 flex items-center gap-2">
                          <Wind size={12} /> {weather.wind} m/s
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="w-20 h-20 bg-accent/5 rounded-2xl flex items-center justify-center mb-2">
                          {weather.symbol.includes('rain') ? <CloudRain className="text-blue-500" size={40} /> : 
                           weather.symbol.includes('sun') || weather.symbol.includes('clear') ? <Sun className="text-orange-500" size={40} /> : 
                           <Cloud className="text-ink/60" size={40} />}
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 text-ink">{translateWeatherCondition(weather.condition)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center gap-2 text-ink/20">
                      <Cloud size={32} />
                      <p className="text-[9px] uppercase tracking-widest font-black">Laster...</p>
                    </div>
                  )}
                </section>

                <section className="bg-surface p-8 rounded-3xl border border-ink/5 shadow-xl relative overflow-hidden flex flex-col">
                  <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <div className="flex gap-6">
                      <button 
                        onClick={() => setNewsTab('news')}
                        className={`flex items-center gap-3 pb-2 border-b-2 transition-all ${newsTab === 'news' ? 'border-accent text-accent' : 'border-transparent text-ink/40 hover:text-ink/60'}`}
                      >
                        <Newspaper size={20} />
                        <div>
                          <h3 className="text-sm font-black uppercase tracking-widest leading-none">Verden</h3>
                          <p className="text-[8px] opacity-40 uppercase tracking-tighter mt-1">NRK & BBC</p>
                        </div>
                      </button>
                      <button 
                        onClick={() => setNewsTab('academic')}
                        className={`flex items-center gap-3 pb-2 border-b-2 transition-all ${newsTab === 'academic' ? 'border-accent text-accent' : 'border-transparent text-ink/40 hover:text-ink/60'}`}
                      >
                        <Book size={20} />
                        <div>
                          <h3 className="text-sm font-black uppercase tracking-widest leading-none">Akademisk</h3>
                          <p className="text-[8px] opacity-40 uppercase tracking-tighter mt-1">UiB & Chatham</p>
                        </div>
                      </button>
                    </div>
                    {fetchingNews && <Loader2 size={16} className="animate-spin text-ink/20" />}
                  </div>

                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {(newsTab === 'news' ? news : academicNews).length > 0 ? (
                      (newsTab === 'news' ? news : academicNews).map((item, index) => (
                        <motion.a
                          key={index}
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="block group"
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-1 flex-grow">
                              <h4 className="text-sm font-medium leading-tight text-ink group-hover:text-accent transition-colors">
                                {item.title}
                              </h4>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black tracking-widest uppercase text-ink/40">
                                  {item.source}
                                </span>
                                <div className="w-1 h-1 bg-ink/10 rounded-full" />
                                <p className="text-[10px] text-ink/40 uppercase tracking-tighter">
                                  {newsTab === 'academic' && `${new Date(item.pubDate).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })} • `}
                                  {new Date(item.pubDate).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                            <ArrowUpRight size={14} className="text-ink/10 group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0" />
                          </div>
                          {index < (newsTab === 'news' ? news : academicNews).length - 1 && <div className="h-px bg-ink/5 mt-4" />}
                        </motion.a>
                      ))
                    ) : (
                      <div className="py-12 flex flex-col items-center gap-2 text-ink/20 text-center">
                        {newsTab === 'news' ? <Newspaper size={32} /> : <Book size={32} />}
                        <p className="text-[9px] uppercase tracking-widest font-black mt-2">
                          {fetchingNews ? 'Laster...' : 'Ingen nyheter'}
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="bg-surface p-8 rounded-3xl border border-ink/5 shadow-xl relative overflow-hidden flex flex-col">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-accent/10 rounded-xl text-accent">
                      <Edit2 size={24} />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-ink">Siterte Sitater</h3>
                  </div>

                  <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {quotes.length > 0 ? (
                      quotes.map((quote, idx) => (
                        <div key={quote.id} className="relative group p-4 bg-paper/30 rounded-2xl border border-ink/5 transition-all hover:border-accent/20">
                          <p className="text-base font-serif italic text-ink leading-relaxed">
                            "{quote.text}"
                          </p>
                          <div className="flex justify-between items-center mt-3">
                            <p className="text-xs font-black uppercase tracking-widest text-accent">— {quote.author}</p>
                            {isAdmin && (
                              <button 
                                onClick={() => deleteQuote(quote.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500/30 hover:text-red-500"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 flex flex-col items-center gap-2 text-ink/20 text-center">
                        <Edit2 size={32} />
                        <p className="text-[9px] uppercase tracking-widest font-black mt-2">Ingen sitater lagt til</p>
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>

        <div className={`space-y-8 flex flex-col ${isFullscreen ? 'overflow-hidden h-full' : ''}`}>
          <section className={`bg-surface rounded-3xl border border-ink/5 shadow-sm relative overflow-hidden flex flex-col ${isFullscreen ? 'flex-grow' : 'h-[950px]'}`}>
            <div className="flex-grow relative overflow-hidden bg-black">
              {timetableBoards.length > 0 ? (
                timetableBoards.map((board, idx) => (
                  <motion.div
                    key={board.id}
                    initial={false}
                    animate={{ 
                      opacity: idx === activeBoardIndex ? 1 : 0,
                      zIndex: idx === activeBoardIndex ? 10 : 0
                    }}
                    transition={{ duration: 1 }}
                    className="absolute inset-0"
                    style={{ 
                      pointerEvents: idx === activeBoardIndex ? 'auto' : 'none'
                    }}
                  >
                    <iframe 
                      src={getIframeUrl(board.url)} 
                      className="absolute inset-0 w-full h-full border-none"
                      style={{ 
                        pointerEvents: 'auto',
                        filter: isDark && !board.url.includes('theme=dark') && !board.url.startsWith('/') && !board.url.includes('Fly.html') && !board.url.includes('fly-bergen') ? 'invert(0.9) hue-rotate(180deg) brightness(1.1)' : 'none'
                      }}
                      title={board.name}
                    />
                  </motion.div>
                ))
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-ink/20 p-12 text-center">
                  <TrainFront size={48} />
                  <p className="mt-4 text-xs font-black uppercase tracking-widest">Ingen rutetabeller lagt til</p>
                  {isAdmin && <p className="mt-2 text-[10px] opacity-60">Klikk "Add Timetable" for å legge til en Entur-tavle eller lokal fil</p>}
                </div>
              )}
            </div>

            {/* Carousel Navigation & Board Info */}
            {timetableBoards.length > 0 && (
              <div className={`absolute ${isFullscreen ? 'bottom-0 left-0 right-0 px-0' : 'bottom-1 left-1 right-1 px-1'} flex flex-col items-center pointer-events-none z-20`}>
                <div className={`${isDark ? 'bg-[#242426]' : 'bg-[#f6f6f9]'} backdrop-blur-md ${isFullscreen ? 'w-full rounded-none' : 'w-[594px] rounded-2xl'} h-[42px] px-6 border border-white/10 pointer-events-auto flex items-center justify-between gap-4 shadow-2xl group/nav ${isDark ? 'text-[#dadeff]' : 'text-[#181c56]'}`}>
                  {timetableBoards.length > 1 ? (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveBoardIndex((prev) => (prev - 1 + timetableBoards.length) % timetableBoards.length);
                        setBoardTimer(15);
                      }}
                      className={`p-2 ${isDark ? 'text-[#dadeff]/40 hover:text-[#dadeff] hover:bg-white/5' : 'text-[#181c56]/40 hover:text-[#181c56] hover:bg-[#181c56]/5'} rounded-full transition-colors`}
                      title="Forrige tavle"
                    >
                      <ChevronLeft size={20} />
                    </button>
                  ) : <div className="w-10" />}

                  <div className="flex flex-col items-center flex-grow">
                    <p className={`text-[11px] font-black uppercase tracking-[0.1em] leading-none ${isDark ? 'text-[#dadeff]' : 'text-[#181c56]'} mb-1`}>
                      {timetableBoards[activeBoardIndex]?.name} <span className="opacity-40 mx-2">•</span> <span className="opacity-70">Neste: {timetableBoards[(activeBoardIndex + 1) % timetableBoards.length]?.name} om {boardTimer}s</span>
                    </p>
                    {timetableBoards.length > 1 && (
                      <div className="flex gap-1.5 items-center">
                        {timetableBoards.map((_, idx) => (
                          <div 
                            key={idx}
                            className={`h-1 rounded-full transition-all duration-300 ${
                              idx === activeBoardIndex 
                                ? (isDark ? 'bg-[#dadeff] w-3' : 'bg-[#181c56] w-3') 
                                : (isDark ? 'bg-[#dadeff]/20 w-1.5' : 'bg-[#181c56]/20 w-1.5')
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {timetableBoards.length > 1 && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveBoardIndex((prev) => (prev + 1) % timetableBoards.length);
                          setBoardTimer(15);
                        }}
                        className={`p-2 ${isDark ? 'text-[#dadeff]/40 hover:text-[#dadeff] hover:bg-white/5' : 'text-[#181c56]/40 hover:text-[#181c56] hover:bg-[#181c56]/5'} rounded-full transition-colors`}
                        title="Neste tavle"
                      >
                        <ChevronRight size={20} />
                      </button>
                    )}

                    {isAdmin && (
                      <button 
                        onClick={(e) => deleteTimetableBoard(timetableBoards[activeBoardIndex].id, e)}
                        className={`p-2 ${isDark ? 'text-[#dadeff]/20 hover:text-red-500' : 'text-[#181c56]/20 hover:text-red-500'} transition-colors ml-2 border-l ${isDark ? 'border-[#dadeff]/10' : 'border-[#181c56]/10'}`}
                        title="Slett denne tavlen"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
