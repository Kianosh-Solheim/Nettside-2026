import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, CheckSquare, Clock, Calendar, 
  TrainFront, Timer as TimerIcon, Loader2, 
  X, Edit2, Maximize2, Minimize2, Cloud, Sun, 
  CloudRain, Wind, Thermometer, Play, Pause, RotateCcw,
  LayoutDashboard, Newspaper, ArrowUpRight
} from 'lucide-react';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, handleFirestoreError, OperationType } from '../firebase';
import Button from './ui/Button';

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

export default function SampolDashboard() {
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<DashboardItem | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timetableKey, setTimetableKey] = useState(0);
  const [lastTimetableUpdate, setLastTimetableUpdate] = useState(new Date());
  const dashboardRef = useRef<HTMLDivElement>(null);

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
    type: 'task' as 'task' | 'event',
    startDate: '',
    targetDate: '',
    color: ''
  });
  const [now, setNow] = useState(new Date());

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
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Timetable Update Logic (Every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = new Date();
      if (currentTime.getSeconds() % 30 === 0) {
        setTimetableKey(k => k + 1);
        setLastTimetableUpdate(currentTime);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Weather Logic
  useEffect(() => {
    fetchWeather();
    const weatherInterval = setInterval(fetchWeather, 30 * 60 * 1000); // 30 mins
    return () => clearInterval(weatherInterval);
  }, []);

  // News Logic
  useEffect(() => {
    fetchNews();
    const newsInterval = setInterval(fetchNews, 10 * 60 * 1000); // 10 mins
    return () => clearInterval(newsInterval);
  }, []);

  const fetchNews = async () => {
    setFetchingNews(true);
    try {
      const response = await fetch('/api/rss');
      if (!response.ok) throw new Error('News fetch failed');
      const data = await response.json();
      setNews(data.news || []);
      setAcademicNews(data.academic || []);
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
      setFormData({ title: '', description: '', type: 'task', startDate: '', targetDate: '', color: '' });
    } catch (error) {
      handleFirestoreError(error, editingItem ? OperationType.UPDATE : OperationType.CREATE, 'sampol_dashboard_items');
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
      className={`transition-all duration-500 ease-in-out ${isFullscreen ? 'fixed inset-0 z-[100] bg-paper p-8 flex flex-col h-screen' : 'max-w-7xl mx-auto px-4 py-20'}`}
    >
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-end ${isFullscreen ? 'mb-8' : 'mb-12'} gap-6 flex-shrink-0`}>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-accent/10 rounded-xl text-accent">
              <LayoutDashboard size={24} />
            </div>
            <h1 className={`${isFullscreen ? 'text-2xl' : 'text-4xl'} font-serif transition-all`}>SAMPOL Dashboard</h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-ink/60 uppercase text-[10px] tracking-[0.3em] font-black">
              {now.toLocaleDateString('no-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            {!isFullscreen && (
              <>
                <div className="hidden md:block w-1 h-1 bg-ink/20 rounded-full" />
                <p className="text-4xl font-mono font-black text-accent tracking-tighter transition-all">
                  {now.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={toggleFullscreen}
            icon={isFullscreen ? Minimize2 : Maximize2}
            className="flex-grow md:flex-none py-2 text-[10px]"
          >
            {isFullscreen ? 'Exit Full' : 'Fullscreen'}
          </Button>
          <Button 
            variant="primary" 
            size="sm"
            onClick={() => {
              if (isAdding) {
                setIsAdding(false);
                setEditingItem(null);
                setFormData({ title: '', description: '', type: 'task', startDate: '', targetDate: '', color: '' });
              } else {
                setIsAdding(true);
              }
            }}
            icon={isAdding ? X : Plus}
            magnetic={true}
            className="flex-grow md:flex-none py-2 text-[10px]"
          >
            {isAdding ? 'Cancel' : 'Add Item'}
          </Button>
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] uppercase tracking-widest text-ink/40 mb-1.5">Type</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as 'task' | 'event' })}
                        className="w-full bg-paper border border-ink/10 rounded-lg p-2.5 text-sm outline-none focus:border-accent"
                      >
                        <option value="task">Task</option>
                        <option value="event">Event</option>
                      </select>
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
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 ${isFullscreen ? 'flex-grow min-h-0 overflow-hidden' : ''}`}>
        <div className={`flex flex-col gap-8 ${isFullscreen ? 'overflow-hidden h-full' : 'space-y-8'}`}>
          <section className={`flex flex-col ${isFullscreen ? 'overflow-hidden flex-grow basis-3/5' : ''}`}>
            <div className="flex items-center gap-3 mb-6 flex-shrink-0">
              <CheckSquare className="text-accent" size={20} />
              <h2 className="text-lg font-serif">{isFullscreen ? 'Tasks' : 'Tasks & Countdowns'}</h2>
            </div>
            <div className={`grid grid-cols-1 gap-4 ${isFullscreen ? 'overflow-y-auto pr-2 custom-scrollbar flex-grow' : ''}`}>
              {items.filter(item => isFullscreen ? item.type === 'task' : true).length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-ink/5 rounded-2xl">
                  <p className="text-ink/40 text-xs uppercase tracking-widest">No active items</p>
                </div>
              ) : (
                items
                  .filter(item => isFullscreen ? item.type === 'task' : true)
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
                          <span 
                            className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest"
                            style={{ 
                              backgroundColor: item.color ? `${item.color}10` : (item.type === 'event' ? '#3b82f610' : '#f9731610'),
                              color: item.color || (item.type === 'event' ? '#3b82f6' : '#f97316')
                            }}
                          >
                            {item.type}
                          </span>
                          <h3 className={`font-medium ${item.completed ? 'line-through opacity-50' : ''}`}>
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
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </section>

          <div className={`${isFullscreen ? 'flex flex-col gap-4 basis-2/2 min-h-0' : 'grid grid-cols-1 gap-8'} flex-shrink-0`}>
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
                          <p className="text-[8px] text-ink/40 uppercase tracking-tighter">MET.NO Data</p>
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

                  <section className="bg-surface p-4 rounded-3xl border border-ink/5 shadow-xl relative overflow-hidden flex flex-col flex-grow min-h-0">
                    <div className="flex justify-between items-center mb-2 flex-shrink-0">
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setNewsTab('news')}
                          className={`flex items-center gap-2 pb-1 border-b-2 transition-all ${newsTab === 'news' ? 'border-accent text-accent' : 'border-transparent text-ink/40 hover:text-ink/60'}`}
                        >
                          <Newspaper size={14} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Verden</span>
                        </button>
                        <button 
                          onClick={() => setNewsTab('academic')}
                          className={`flex items-center gap-2 pb-1 border-b-2 transition-all ${newsTab === 'academic' ? 'border-accent text-accent' : 'border-transparent text-ink/40 hover:text-ink/60'}`}
                        >
                          <Book size={14} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Akademisk</span>
                        </button>
                      </div>
                      {fetchingNews && <Loader2 size={12} className="animate-spin text-ink/20" />}
                    </div>

                    <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-grow mt-2">
                      {(newsTab === 'news' ? news : academicNews).length > 0 ? (
                        (newsTab === 'news' ? news : academicNews).map((item, index) => (
                          <motion.a
                            key={index}
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
                            {index < (newsTab === 'news' ? news : academicNews).length - 1 && <div className="h-px bg-ink/5 mt-3" />}
                          </motion.a>
                        ))
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 py-4">
                          <Newspaper size={24} />
                          <p className="text-[9px] uppercase tracking-widest font-black mt-2">Laster...</p>
                        </div>
                      )}
                    </div>
                  </section>
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
                        <p className="text-[10px] text-ink/40 uppercase tracking-tighter">MET.NO Data</p>
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
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 text-ink">{weather.condition.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center gap-2 text-ink/20">
                      <Cloud size={32} />
                      <p className="text-[9px] uppercase tracking-widest font-black">Connecting...</p>
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
                      <div className="py-12 flex flex-col items-center gap-2 text-ink/20">
                        <Newspaper size={32} />
                        <p className="text-[9px] uppercase tracking-widest font-black">Laster...</p>
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
            <div className="p-4 border-b border-ink/5 bg-paper/50 backdrop-blur-sm z-10 flex-shrink-0">
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <TrainFront size={14} className="text-accent" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-ink">SAMPOL Tavle</h3>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-ink/30 italic">
                  Sist oppdatert: {Math.max(0, Math.floor((now.getTime() - lastTimetableUpdate.getTime()) / 1000))}s siden
                </span>
              </div>
              <p className="text-[9px] text-ink/40 uppercase tracking-tighter">Henter data fra Skyss via Entur</p>
            </div>
            <div className="flex-grow relative overflow-hidden bg-black">
              <iframe 
                key={timetableKey}
                src="https://vis-tavla.entur.no/w5GeFGIYRvVgbPD1ci1v" 
                className="absolute border-none"
                style={{ 
                  top: '-45px',
                  left: '-25px',
                  width: 'calc(100% + 50px)',
                  height: 'calc(100% + 100px)',
                  pointerEvents: 'auto'
                }}
                title="Entur Departure Board"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
