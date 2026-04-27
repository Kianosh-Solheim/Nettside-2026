import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, CheckSquare, Clock, Calendar, 
  TrainFront, Timer as TimerIcon, Loader2, AlertCircle, 
  X, Edit2, Maximize2, Minimize2, Cloud, Sun, 
  CloudRain, Wind, Thermometer, Play, Pause, RotateCcw 
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

export default function Dashboard() {
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<DashboardItem | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [fetchingWeather, setFetchingWeather] = useState(false);

  // Timer State
  const [timerSeconds, setTimerSeconds] = useState(1500); // 25 mins
  const [isTimerRunning, setIsTimerRunning] = useState(false);

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
    const q = query(collection(db, 'dashboard_items'), orderBy('targetDate', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DashboardItem[];
      setItems(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'dashboard_items'));

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Timer Logic
  useEffect(() => {
    let interval: any;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => setTimerSeconds(s => s - 1), 1000);
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  // Weather Logic
  useEffect(() => {
    fetchWeather();
    const weatherInterval = setInterval(fetchWeather, 30 * 60 * 1000); // 30 mins
    return () => clearInterval(weatherInterval);
  }, []);

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
        await updateDoc(doc(db, 'dashboard_items', editingItem.id), data);
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'dashboard_items'), data);
        setIsAdding(false);
      }
      setFormData({ title: '', description: '', type: 'task', startDate: '', targetDate: '', color: '' });
    } catch (error) {
      handleFirestoreError(error, editingItem ? OperationType.UPDATE : OperationType.CREATE, 'dashboard_items');
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
      await updateDoc(doc(db, 'dashboard_items', id), { completed: !current });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `dashboard_items/${id}`);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'dashboard_items', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `dashboard_items/${id}`);
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

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  return (
    <div className={`transition-all duration-500 ease-in-out ${isFullscreen ? 'fixed inset-0 z-[100] bg-paper overflow-auto p-8 md:p-20' : 'max-w-7xl mx-auto px-4 py-20'}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-serif mb-2">Control Center</h1>
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
        <div className="flex gap-4 w-full md:w-auto">
          <Button 
            variant="ghost" 
            onClick={() => setIsFullscreen(!isFullscreen)}
            icon={isFullscreen ? Minimize2 : Maximize2}
            className="flex-1 md:flex-none"
          >
            {isFullscreen ? 'Exit Full' : 'Fullscreen'}
          </Button>
          <Button 
            variant="primary" 
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
            className="flex-1 md:flex-none"
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
            className="mb-12 bg-surface p-8 rounded-2xl border border-ink/5"
          >
            <form onSubmit={handleAddItem} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2">Title</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full bg-paper border border-ink/10 rounded-lg p-3 outline-none focus:border-accent"
                      placeholder="Enter title..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2">Type</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as 'task' | 'event' })}
                        className="w-full bg-paper border border-ink/10 rounded-lg p-3 outline-none focus:border-accent"
                      >
                        <option value="task">Task</option>
                        <option value="event">Event</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2">Color</label>
                      <div className="flex flex-wrap gap-2">
                        {COLORS.map(c => (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => setFormData({ ...formData, color: c.value })}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${
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
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2">Start Date (Opt)</label>
                      <input
                        type="datetime-local"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full bg-paper border border-ink/10 rounded-lg p-3 outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2">End Date & Time</label>
                      <input
                        type="datetime-local"
                        required
                        value={formData.targetDate}
                        onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                        className="w-full bg-paper border border-ink/10 rounded-lg p-3 outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2">Description (Optional)</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-paper border border-ink/10 rounded-lg p-3 outline-none focus:border-accent h-[46px]"
                      placeholder="Brief description..."
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-ink/5">
                {editingItem && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => {
                      setEditingItem(null);
                      setIsAdding(false);
                      setFormData({ title: '', description: '', type: 'task', startDate: '', targetDate: '', color: '' });
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button type="submit" variant="primary">
                  {editingItem ? 'Update Item' : 'Create Item'}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          <section>
            <div className="flex items-center gap-3 mb-6">
              <CheckSquare className="text-accent" size={20} />
              <h2 className="text-lg font-serif">Tasks & Countdowns</h2>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {items.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-ink/5 rounded-2xl">
                  <p className="text-ink/40 text-xs uppercase tracking-widest">No active items</p>
                </div>
              ) : (
                items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    className={`p-6 rounded-2xl border transition-all ${
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
                          <p className="text-xs text-ink/60 mb-4">{item.description}</p>
                        )}
                        {!item.completed && formatCountdown(item)}
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
        </div>

        <div className="space-y-8">
          <section className="bg-surface p-6 rounded-3xl border border-ink/5 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                  <Thermometer size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest">Bergen</h3>
                  <p className="text-[9px] text-ink/40 uppercase tracking-tighter">MET.NO Data</p>
                </div>
              </div>
              {fetchingWeather && <Loader2 size={14} className="animate-spin text-ink/20" />}
            </div>

            {weather ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-5xl font-mono font-black tracking-tighter">
                    {Math.round(weather.temp)}°
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-ink/40 mt-1 flex items-center gap-2">
                    <Wind size={10} /> {weather.wind} m/s
                  </p>
                </div>
                <div className="text-right">
                  <div className="w-16 h-16 bg-accent/5 rounded-2xl flex items-center justify-center mb-1">
                    {weather.symbol.includes('rain') ? <CloudRain className="text-blue-500" size={32} /> : 
                     weather.symbol.includes('sun') || weather.symbol.includes('clear') ? <Sun className="text-orange-500" size={32} /> : 
                     <Cloud className="text-ink/60" size={32} />}
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-40">{weather.condition.replace('_', ' ')}</p>
                </div>
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center gap-2 text-ink/20">
                <Cloud size={32} />
                <p className="text-[9px] uppercase tracking-widest font-black">Connecting...</p>
              </div>
            )}
          </section>

          <section className="bg-surface rounded-3xl border border-ink/5 shadow-sm h-[400px] relative overflow-hidden">
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-paper/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-ink/5">
              <TrainFront size={12} className="text-accent" />
              <span className="text-[10px] font-black uppercase tracking-widest">Byparken</span>
            </div>
            <div className="absolute inset-0 overflow-hidden bg-black">
              <iframe 
                src="https://vis-tavla.entur.no/NMnjuXGA6AGs72LhErfe" 
                className="absolute border-none"
                style={{ 
                  top: '-45px',
                  left: '-39px',
                  width: 'calc(100% + 78px)',
                  height: 'calc(100% + 100px)',
                  pointerEvents: 'auto'
                }}
                title="Entur Departure Board"
              />
            </div>
          </section>
          <section className="bg-surface p-6 rounded-3xl border border-ink/5 shadow-xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl opacity-50" />
             <div className="relative z-10">
               <div className="flex justify-between items-center mb-6">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-accent/10 rounded-xl text-accent">
                     <TimerIcon size={18} />
                   </div>
                   <h3 className="text-xs font-black uppercase tracking-widest">Timer</h3>
                 </div>
                 <button onClick={() => { setTimerSeconds(1500); setIsTimerRunning(false); }} className="p-2 hover:bg-ink/5 rounded-full transition-colors">
                   <RotateCcw size={14} className="text-ink/40" />
                 </button>
               </div>
               <div className="text-center py-4">
                 <p className="text-6xl font-mono font-black tracking-tighter mb-6 text-ink">{formatTimer(timerSeconds)}</p>
                 <div className="flex justify-center gap-4">
                   <Button 
                    variant="primary" 
                    onClick={() => setIsTimerRunning(!isTimerRunning)}
                    className="w-12 h-12 rounded-full flex items-center justify-center p-0"
                   >
                     {isTimerRunning ? <Pause size={20} /> : <Play size={20} />}
                   </Button>
                   <div className="flex gap-2">
                     <button onClick={() => { setTimerSeconds(1500); setIsTimerRunning(false); }} className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${timerSeconds === 1500 ? 'bg-accent text-white border-accent' : 'border-ink/10 hover:border-accent text-ink/60'}`}>Focus</button>
                     <button onClick={() => { setTimerSeconds(300); setIsTimerRunning(false); }} className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${timerSeconds === 300 ? 'bg-accent text-white border-accent' : 'border-ink/10 hover:border-accent text-ink/60'}`}>Break</button>
                   </div>
                 </div>
                </div>
              </div>
          </section>
        </div>
      </div>
    </div>
  );
}
