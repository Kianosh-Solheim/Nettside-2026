import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, db, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, handleFirestoreError, OperationType, where } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Target, 
  TrendingDown, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  ChevronRight, 
  Award, 
  AlertTriangle, 
  Droplets, 
  Flame, 
  Scale,
  Calendar,
  Info,
  Download,
  Settings,
  Loader2,
  CheckCircle2,
  Check
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  ReferenceLine
} from 'recharts';
import WaterTracker from './WaterTracker';
import FoodTracker from './FoodTracker';
import Button from './ui/Button';

interface HealthLog {
  id: string;
  date: string;
  weight: number;
  calories: number;
  protein?: number;
  carbs?: number;
  fats?: number;
}

interface Milestone {
  id: string;
  name: string;
  targetWeight: number;
  reward?: string;
  achieved: boolean;
  achievedAt?: any;
  targetDate?: string;
  order: number;
}

interface HealthConfig {
  id: string;
  height: number;
  age: number;
  gender: 'male' | 'female';
  activityLevel: number;
  targetWeeklyLoss: number;
  startingWeight: number;
  tdee: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-surface border border-ink/10 p-4 rounded-2xl shadow-xl backdrop-blur-md">
        <p className="text-[10px] uppercase tracking-widest text-ink/40 font-bold mb-2">{label}</p>
        {data.weight !== null && (
          <p className="text-sm font-serif mb-1">Weight: <span className="text-accent">{data.weight} kg</span></p>
        )}
        {data.calories !== null && (
          <p className="text-[10px] uppercase tracking-widest text-ink/60">Calories: {data.calories} kcal</p>
        )}
        {data.milestoneName && (
          <div className="mt-3 pt-3 border-t border-ink/5">
            <p className="text-[10px] uppercase tracking-widest text-accent font-bold mb-1">Milestone: {data.milestoneName}</p>
            <p className="text-xs font-serif">Reward: {data.milestoneReward}</p>
            <p className="text-[10px] text-ink/40">Target: {data.milestoneTargetWeight} kg</p>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function HealthTracker({ user, canViewAdminHealth, adminUid }: { user: any, canViewAdminHealth?: boolean, adminUid?: string | null }) {
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [config, setConfig] = useState<HealthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logs' | 'milestones' | 'settings'>('dashboard');
  const [showFutureEvents, setShowFutureEvents] = useState(false);
  const [chartView, setChartView] = useState<'3m' | '1y' | 'all'>('all');
  const [milestoneTab, setMilestoneTab] = useState<'active' | 'achieved'>('active');
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showFutureEvents && chartContainerRef.current) {
      // Small delay to ensure the container has resized before scrolling
      setTimeout(() => {
        if (chartContainerRef.current) {
          chartContainerRef.current.scrollTo({
            left: chartContainerRef.current.scrollWidth,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [showFutureEvents]);

  const isAdmin = user?.email === 'kianoshsolheim@gmail.com' || user?.email === 'kianosh@solheim.online';
  const targetUserId = (isAdmin || !canViewAdminHealth) ? user.uid : (adminUid || user.uid);
  const isViewingAdmin = !isAdmin && canViewAdminHealth && adminUid === targetUserId;

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const chartMargins = useMemo(() => ({
    top: 5,
    right: 10,
    bottom: 20,
    left: 0
  }), []);
  
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [logForm, setLogForm] = useState({
    date: new Date().toISOString().split('T')[0],
    weight: '',
    calories: '',
    protein: '',
    carbs: '',
    fats: ''
  });

  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [milestoneForm, setMilestoneForm] = useState({
    name: '',
    targetWeight: '',
    reward: '',
    targetDate: ''
  });

  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    height: '',
    age: '',
    gender: 'male' as 'male' | 'female',
    activityLevel: 1.2,
    targetWeeklyLoss: 0.5,
    startingWeight: ''
  });

  useEffect(() => {
    if (!user || !targetUserId) return;

    const qLogs = query(
      collection(db, 'health_logs'), 
      where('userId', '==', targetUserId),
      orderBy('date', 'desc')
    );
    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as HealthLog[];
      setLogs(data.sort((a, b) => b.date.localeCompare(a.date)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'health_logs'));

    const qMilestones = query(
      collection(db, 'milestones'), 
      where('userId', '==', targetUserId),
      orderBy('order', 'asc')
    );
    const unsubscribeMilestones = onSnapshot(qMilestones, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Milestone[];
      setMilestones(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'milestones'));

    const qConfig = query(
      collection(db, 'health_configs'),
      where('userId', '==', targetUserId)
    );
    const unsubscribeConfig = onSnapshot(qConfig, (snapshot) => {
      if (!snapshot.empty) {
        const data = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as HealthConfig;
        setConfig(data);
        setConfigForm({
          height: data.height.toString(),
          age: data.age.toString(),
          gender: data.gender,
          activityLevel: data.activityLevel,
          targetWeeklyLoss: data.targetWeeklyLoss,
          startingWeight: data.startingWeight.toString()
        });
      } else {
        setConfig(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'health_configs'));

    return () => {
      unsubscribeLogs();
      unsubscribeMilestones();
      unsubscribeConfig();
    };
  }, [user, targetUserId]);

  // Calculations
  const stats = useMemo(() => {
    if (logs.length === 0) return null;
    
    const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    const currentWeight = sortedLogs[sortedLogs.length - 1].weight;
    const previousWeight = sortedLogs.length > 1 ? sortedLogs[sortedLogs.length - 2].weight : currentWeight;
    
    // Use starting weight from config, or fallback to the first log weight
    const startWeight = (config && typeof config.startingWeight === 'number' && config.startingWeight > 0) 
      ? config.startingWeight 
      : sortedLogs[0].weight;
    
    const totalLoss = startWeight - currentWeight;
    
    // 7-day moving average
    const last7Days = sortedLogs.slice(-7);
    const avg7Day = last7Days.reduce((acc, log) => acc + log.weight, 0) / last7Days.length;
    
    // 14-day moving average
    const last14Days = sortedLogs.slice(-14);
    const avg14Day = last14Days.reduce((acc, log) => acc + log.weight, 0) / last14Days.length;

    // Plateau detection (if weight hasn't moved down in 14 days)
    const isPlateau = sortedLogs.length >= 14 && 
      sortedLogs.slice(-14).every(log => log.weight >= avg14Day - 0.1);

    // Dynamic Calorie Budget
    // Mifflin-St Jeor: 
    // Men: 10 x weight (kg) + 6.25 x height (cm) - 5 x age (y) + 5
    // Women: 10 x weight (kg) + 6.25 x height (cm) - 5 x age (y) - 161
    let bmr = 0;
    if (config) {
      if (config.gender === 'male') {
        bmr = 10 * currentWeight + 6.25 * config.height - 5 * config.age + 5;
      } else {
        bmr = 10 * currentWeight + 6.25 * config.height - 5 * config.age - 161;
      }
    }
    const tdee = bmr * (config?.activityLevel || 1.2);
    const deficit = (config?.targetWeeklyLoss || 0.5) * 7700 / 7; // 7700 kcal per kg
    const dailyTarget = tdee - deficit;

    return {
      currentWeight,
      previousWeight,
      totalLoss,
      avg7Day,
      avg14Day,
      isPlateau,
      dailyTarget,
      tdee
    };
  }, [logs, config]);

  const chartData = useMemo(() => {
    let filteredLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    
    if (chartView === '3m') {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      filteredLogs = filteredLogs.filter(log => new Date(log.date) >= threeMonthsAgo);
    } else if (chartView === '1y') {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      filteredLogs = filteredLogs.filter(log => new Date(log.date) >= oneYearAgo);
    }

    const data = filteredLogs.map(log => ({
      date: new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      rawDate: log.date,
      weight: log.weight,
      calories: log.calories
    }));

    // Achieved Milestones (Always show)
    const achievedMilestones = milestones.filter(m => m.achieved && m.achievedAt);
    achievedMilestones.forEach(m => {
      // Find the log date or the explicit achievedAt date
      const achievementDate = typeof m.achievedAt === 'string' ? m.achievedAt : 
                             (m.achievedAt && (m.achievedAt as any).seconds ? new Date((m.achievedAt as any).seconds * 1000).toISOString().split('T')[0] : null);
      
      if (achievementDate) {
        const existingPoint = data.find(d => d.rawDate === achievementDate);
        if (existingPoint) {
          (existingPoint as any).achievedMilestoneName = m.name;
        } else {
          const formattedDate = new Date(achievementDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          data.push({
            date: formattedDate,
            rawDate: achievementDate,
            weight: null,
            calories: null,
            achievedMilestoneName: m.name
          } as any);
        }
      }
    });

    if (showFutureEvents) {
      // Future Milestones
      const futureMilestones = milestones.filter(m => !m.achieved && m.targetDate);
      futureMilestones.forEach(m => {
        const existingPoint = data.find(d => d.rawDate === m.targetDate);
        if (existingPoint) {
          (existingPoint as any).milestoneName = m.name;
          (existingPoint as any).milestoneReward = m.reward;
          (existingPoint as any).milestoneTargetWeight = m.targetWeight;
        } else {
          const formattedDate = new Date(m.targetDate!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          data.push({
            date: formattedDate,
            rawDate: m.targetDate!,
            weight: null,
            calories: null,
            milestoneName: m.name,
            milestoneReward: m.reward,
            milestoneTargetWeight: m.targetWeight
          } as any);
        }
      });
    }

    if (showFutureEvents || achievedMilestones.length > 0) {
      data.sort((a, b) => a.rawDate.localeCompare(b.rawDate));
    }

    return data;
  }, [logs, milestones, showFutureEvents, chartView]);

  const sortedMilestones = useMemo(() => {
    return [...milestones]
      .filter(m => milestoneTab === 'active' ? !m.achieved : m.achieved)
      .sort((a, b) => {
        if (milestoneTab === 'achieved') {
          const dateA = a.achievedAt ? (typeof a.achievedAt === 'string' ? new Date(a.achievedAt).getTime() : (a.achievedAt as any).seconds * 1000) : 0;
          const dateB = b.achievedAt ? (typeof b.achievedAt === 'string' ? new Date(b.achievedAt).getTime() : (b.achievedAt as any).seconds * 1000) : 0;
          return dateB - dateA; // Descending achieved date
        }
        
        // Active milestones: sort by targetDate if available, otherwise by targetWeight
        if (a.targetDate && b.targetDate) {
          return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
        }
        if (a.targetDate) return -1;
        if (b.targetDate) return 1;
        
        // If no target date, sort by target weight (closest to current weight)
        const currentWeight = stats?.currentWeight || 0;
        return Math.abs(a.targetWeight - currentWeight) - Math.abs(b.targetWeight - currentWeight);
      });
  }, [milestones, milestoneTab, stats?.currentWeight]);

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      const weight = parseFloat(logForm.weight);
      const logDate = logForm.date;
      
      await addDoc(collection(db, 'health_logs'), {
        userId: user.uid,
        date: logDate,
        weight: weight,
        calories: parseInt(logForm.calories) || 0,
        protein: parseInt(logForm.protein) || 0,
        carbs: parseInt(logForm.carbs) || 0,
        fats: parseInt(logForm.fats) || 0,
        createdAt: serverTimestamp()
      }).catch(error => handleFirestoreError(error, OperationType.CREATE, 'health_logs'));

      // Check for milestone achievements
      const unachievedMilestones = milestones.filter(m => !m.achieved);
      for (const milestone of unachievedMilestones) {
        if (weight <= milestone.targetWeight) {
          await updateDoc(doc(db, 'milestones', milestone.id), {
            achieved: true,
            achievedAt: logDate // Store the date of the log that triggered it
          }).catch(error => handleFirestoreError(error, OperationType.UPDATE, `milestones/${milestone.id}`));
        }
      }

      setIsAddingLog(false);
      setLogForm({
        date: new Date().toISOString().split('T')[0],
        weight: '',
        calories: '',
        protein: '',
        carbs: '',
        fats: ''
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      const data = {
        userId: user.uid,
        height: parseFloat(configForm.height),
        age: parseInt(configForm.age),
        gender: configForm.gender,
        activityLevel: configForm.activityLevel,
        targetWeeklyLoss: configForm.targetWeeklyLoss,
        startingWeight: parseFloat(configForm.startingWeight)
      };

      if (config) {
        await updateDoc(doc(db, 'health_configs', config.id), data)
          .catch(error => handleFirestoreError(error, OperationType.UPDATE, `health_configs/${config.id}`));
      } else {
        await addDoc(collection(db, 'health_configs'), data)
          .catch(error => handleFirestoreError(error, OperationType.CREATE, 'health_configs'));
      }
      setIsEditingConfig(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      if (editingMilestone) {
        await updateDoc(doc(db, 'milestones', editingMilestone.id), {
          name: milestoneForm.name,
          targetWeight: parseFloat(milestoneForm.targetWeight),
          reward: milestoneForm.reward,
          targetDate: milestoneForm.targetDate || null
        }).catch(error => handleFirestoreError(error, OperationType.UPDATE, `milestones/${editingMilestone.id}`));
        setEditingMilestone(null);
      } else {
        await addDoc(collection(db, 'milestones'), {
          userId: user.uid,
          name: milestoneForm.name,
          targetWeight: parseFloat(milestoneForm.targetWeight),
          reward: milestoneForm.reward,
          targetDate: milestoneForm.targetDate || null,
          achieved: false,
          order: milestones.length + 1
        }).catch(error => handleFirestoreError(error, OperationType.CREATE, 'milestones'));
        setIsAddingMilestone(false);
      }
      setMilestoneForm({ name: '', targetWeight: '', reward: '', targetDate: '' });
    } catch (error) {
      console.error(error);
    }
  };

  const toggleMilestone = async (milestone: Milestone) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'milestones', milestone.id), {
        achieved: !milestone.achieved,
        achievedAt: !milestone.achieved ? new Date().toISOString().split('T')[0] : null
      }).catch(error => handleFirestoreError(error, OperationType.UPDATE, `milestones/${milestone.id}`));
    } catch (error) {
      console.error(error);
    }
  };

  const deleteItem = async (collectionName: string, id: string) => {
    if (!isAdmin) return;
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteDoc(doc(db, collectionName, id))
        .catch(error => handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`));
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-serif mb-2">Health & Weight Tracker</h1>
          <p className="text-ink/60 text-sm uppercase tracking-widest">
            {isViewingAdmin ? "Viewing Administrator's Health Data" : "Professional Grade Analytics"}
          </p>
        </div>
        <div className="flex bg-ink/5 p-1 rounded-full">
          {(['dashboard', 'logs', 'milestones', 'settings'] as const)
            .filter(tab => isAdmin || (tab !== 'settings' && !isViewingAdmin))
            .map((tab) => (
            <Button
              key={tab}
              onClick={() => setActiveTab(tab)}
              variant={activeTab === tab ? 'primary' : 'ghost'}
              size="sm"
              magnetic={true}
              className={`px-6 py-2 rounded-full text-[10px] uppercase tracking-widest transition-all ${
                activeTab === tab ? 'shadow-md' : 'text-ink/40 hover:text-ink'
              }`}
            >
              {tab}
            </Button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-surface border border-ink/10 p-6 rounded-3xl shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-accent/20 rounded-2xl text-accent">
                    <Scale size={20} />
                  </div>
                  {stats && (
                    <span className={`text-[10px] font-bold ${stats.currentWeight < stats.previousWeight ? 'text-green-500' : 'text-red-500'}`}>
                      {stats.currentWeight < stats.previousWeight ? '-' : '+'}{Math.abs(stats.currentWeight - stats.previousWeight).toFixed(1)} kg
                    </span>
                  )}
                </div>
                <p className="text-[10px] uppercase tracking-widest text-ink/40 font-bold mb-1">Current Weight</p>
                <h3 className="text-3xl font-serif">{stats?.currentWeight.toFixed(1) || '--'} <span className="text-sm font-sans text-ink/40">kg</span></h3>
              </div>

              <div className="bg-surface border border-ink/10 p-6 rounded-3xl shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-orange-500/20 rounded-2xl text-orange-500">
                    <Flame size={20} />
                  </div>
                </div>
                <p className="text-[10px] uppercase tracking-widest text-ink/40 font-bold mb-1">Daily Calorie Target</p>
                <h3 className="text-3xl font-serif">{Math.round(stats?.dailyTarget || 0)} <span className="text-sm font-sans text-ink/40">kcal</span></h3>
              </div>

              <div className="bg-surface border border-ink/10 p-6 rounded-3xl shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-500">
                    <TrendingDown size={20} />
                  </div>
                </div>
                <p className="text-[10px] uppercase tracking-widest text-ink/40 font-bold mb-1">Total Weight Loss</p>
                <h3 className="text-3xl font-serif">{stats?.totalLoss.toFixed(1) || '--'} <span className="text-sm font-sans text-ink/40">kg</span></h3>
              </div>

              <div className="bg-surface border border-ink/10 p-6 rounded-3xl shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-purple-500/20 rounded-2xl text-purple-500">
                    <Activity size={20} />
                  </div>
                  {stats?.isPlateau && (
                    <div className="flex items-center space-x-1 text-orange-500">
                      <AlertTriangle size={12} />
                      <span className="text-[8px] uppercase font-bold">Plateau Detected</span>
                    </div>
                  )}
                </div>
                <p className="text-[10px] uppercase tracking-widest text-ink/40 font-bold mb-1">7-Day Moving Avg</p>
                <h3 className="text-3xl font-serif">{stats?.avg7Day.toFixed(1) || '--'} <span className="text-sm font-sans text-ink/40">kg</span></h3>
              </div>
            </div>

            {/* Main Chart */}
            <div className="bg-surface border border-ink/10 p-8 rounded-3xl shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <h3 className="text-xl font-serif">Weight Trend</h3>
                <div className="flex flex-wrap items-center gap-4">
                   <div className="flex items-center bg-ink/5 p-1 rounded-full">
                     {(['3m', '1y', 'all'] as const).map((view) => (
                       <Button
                         key={view}
                         onClick={() => setChartView(view)}
                         variant={chartView === view ? 'ghost' : 'ghost'}
                         size="sm"
                         magnetic={true}
                         className={`px-4 py-1.5 rounded-full text-[8px] uppercase tracking-widest font-bold transition-all ${
                           chartView === view ? 'bg-surface text-ink shadow-sm' : 'text-ink/40 hover:text-ink'
                         }`}
                       >
                         {view === '3m' ? '3 Months' : view === '1y' ? '1 Year' : 'All Time'}
                       </Button>
                     ))}
                   </div>
                   <Button
                     onClick={() => setShowFutureEvents(!showFutureEvents)}
                     variant={showFutureEvents ? 'primary' : 'ghost'}
                     size="sm"
                     magnetic={true}
                     className={`px-4 py-2 rounded-full text-[8px] uppercase tracking-widest font-bold transition-all ${
                       showFutureEvents ? '' : 'bg-ink/5 text-ink/40 hover:text-ink'
                     }`}
                   >
                     {showFutureEvents ? 'Hide Future' : 'Show Future'}
                   </Button>
                   <div className="flex items-center space-x-2">
                     <div className="w-3 h-3 rounded-full bg-accent" />
                     <span className="text-[10px] uppercase tracking-widest text-ink/40">Weight (kg)</span>
                   </div>
                </div>
              </div>
              <div 
                ref={chartContainerRef}
                className="h-[400px] w-full overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth"
              >
                <div style={{ 
                  width: showFutureEvents ? `${Math.max(100, chartData.length * (windowWidth < 768 ? 20 : 35))}px` : '100%',
                  minWidth: '100%',
                  height: '100%' 
                }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={chartMargins}>
                    <defs>
                      <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--ink-rgb), 0.05)" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: 'rgba(var(--ink-rgb), 0.4)' }}
                      dy={10}
                      minTickGap={windowWidth < 768 ? 30 : 50}
                    />
                    <YAxis 
                      domain={['auto', 'auto']} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: 'rgba(var(--ink-rgb), 0.4)' }}
                      padding={{ top: 10, bottom: 10 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="weight" 
                      stroke="var(--accent)" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorWeight)" 
                      connectNulls
                    />
                    {/* Milestone Target Lines (Horizontal) */}
                    {milestones.filter(m => !m.achieved).map((m, index) => (
                      <ReferenceLine 
                        key={`h-${m.id}`}
                        y={m.targetWeight} 
                        stroke="rgba(var(--accent-rgb), 0.2)" 
                        strokeDasharray="5 5"
                      />
                    ))}

                    {/* Achieved Milestones (Vertical) */}
                    {milestones.filter(m => m.achieved && m.achievedAt).map((m, index) => {
                      const achievementDate = typeof m.achievedAt === 'string' ? m.achievedAt : 
                                             (m.achievedAt && (m.achievedAt as any).seconds ? new Date((m.achievedAt as any).seconds * 1000).toISOString().split('T')[0] : null);
                      
                      if (!achievementDate) return null;
                      const formattedDate = new Date(achievementDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                      
                      return (
                        <ReferenceLine 
                          key={`achieved-v-${m.id}`}
                          x={formattedDate} 
                          stroke="#22c55e" 
                          strokeWidth={2}
                          label={{ 
                            value: `${m.name} (ACHIEVED ${formattedDate})`, 
                            position: 'insideBottomLeft', 
                            fill: '#22c55e', 
                            fontSize: windowWidth < 768 ? 7 : 9,
                            fontWeight: 'bold',
                            angle: -90,
                            dx: 12,
                            dy: -10,
                            textAnchor: 'start'
                          }}
                        />
                      );
                    })}

                    {/* Future Milestones (Vertical) */}
                    {showFutureEvents && milestones.filter(m => !m.achieved && m.targetDate).map((m, index) => {
                      const formattedDate = new Date(m.targetDate!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                      return (
                        <ReferenceLine 
                          key={`v-${m.id}`}
                          x={formattedDate} 
                          stroke="rgba(var(--accent-rgb), 0.4)" 
                          strokeDasharray="3 3"
                          label={{ 
                            value: `${m.name} (${m.targetWeight}kg - ${formattedDate})`, 
                            position: 'insideBottomLeft', 
                            fill: 'var(--accent)', 
                            fontSize: windowWidth < 768 ? 7 : 9,
                            fontWeight: 'bold',
                            angle: -90,
                            dx: 12,
                            dy: -10,
                            textAnchor: 'start'
                          }}
                        />
                      );
                    })}
                  </AreaChart>
                </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Recent Milestones */}
              <div className="bg-surface border border-ink/10 p-8 rounded-3xl shadow-sm">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-serif">Upcoming Milestones</h3>
                  <Target size={20} className="text-accent" />
                </div>
                <div className="space-y-4">
                  {milestones.filter(m => !m.achieved).slice(0, 3).map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-4 bg-ink/10 rounded-2xl">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-surface rounded-xl text-accent">
                          <Award size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-serif font-bold">{m.name}</p>
                          <p className="text-xs text-accent font-medium">{m.reward}</p>
                          <p className="text-[10px] uppercase tracking-widest text-ink/40 mt-1">Target: {m.targetWeight} kg</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-accent">
                          {stats ? (m.targetWeight - stats.currentWeight).toFixed(1) : '--'} kg to go
                        </p>
                      </div>
                    </div>
                  ))}
                  {milestones.filter(m => !m.achieved).length === 0 && (
                    <p className="text-center py-8 text-ink/40 text-xs italic">No upcoming milestones</p>
                  )}
                </div>
              </div>

              {/* Plateau Insights */}
              <div className="bg-surface border border-ink/10 p-8 rounded-3xl shadow-sm">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-serif">Progress Insights</h3>
                  <Target size={20} className="text-accent" />
                </div>
                <div className="space-y-6">
                  {stats?.isPlateau ? (
                    <div className="p-4 bg-orange-500/20 border border-orange-500/30 rounded-2xl">
                      <div className="flex items-center space-x-3 mb-2 text-orange-500">
                        <AlertTriangle size={18} />
                        <h4 className="text-sm font-bold uppercase tracking-widest">Plateau Detected</h4>
                      </div>
                      <p className="text-xs text-ink/60 leading-relaxed">
                        Your weight has been stable for 14 days. Consider a "refeed" day or increasing your activity level by 10% to kickstart your metabolism.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl">
                      <div className="flex items-center space-x-3 mb-2 text-green-500">
                        <CheckCircle2 size={18} />
                        <h4 className="text-sm font-bold uppercase tracking-widest">Consistent Progress</h4>
                      </div>
                      <p className="text-xs text-ink/60 leading-relaxed">
                        Your 7-day average is trending downwards. You are currently in a healthy deficit of approximately {Math.round(stats?.tdee || 0 - (stats?.dailyTarget || 0))} kcal.
                      </p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-ink/5 rounded-2xl">
                      <p className="text-[8px] uppercase tracking-widest text-ink/40 font-bold mb-1">TDEE Estimate</p>
                      <p className="text-lg font-serif">{Math.round(stats?.tdee || 0)} kcal</p>
                    </div>
                    <div className="p-4 bg-ink/5 rounded-2xl">
                      <p className="text-[8px] uppercase tracking-widest text-ink/40 font-bold mb-1">Weekly Goal</p>
                      <p className="text-lg font-serif">-{config?.targetWeeklyLoss || 0} kg</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Health Trackers Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <WaterTracker user={user} isAdmin={isAdmin} />
              </div>
              <div className="lg:col-span-2">
                <FoodTracker user={user} isAdmin={isAdmin} />
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'logs' && (
          <motion.div
            key="logs"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-serif">Daily Logs</h3>
              {isAdmin && (
                <Button
                  onClick={() => setIsAddingLog(true)}
                  variant="primary"
                  size="sm"
                  magnetic={true}
                  icon={Plus}
                  className="px-6 py-3 rounded-full text-[10px] uppercase tracking-widest shadow-lg shadow-accent/20"
                >
                  Add Log
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-ink/10">
                    <th className="py-4 text-[10px] uppercase tracking-widest text-ink/40 font-bold">Date</th>
                    <th className="py-4 text-[10px] uppercase tracking-widest text-ink/40 font-bold">Weight (kg)</th>
                    <th className="py-4 text-[10px] uppercase tracking-widest text-ink/40 font-bold">Calories</th>
                    <th className="py-4 text-[10px] uppercase tracking-widest text-ink/40 font-bold">Macros (P/C/F)</th>
                    {isAdmin && <th className="py-4 text-[10px] uppercase tracking-widest text-ink/40 font-bold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-ink/5 hover:bg-ink/5 transition-colors group">
                      <td className="py-4 text-sm font-medium">{new Date(log.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}</td>
                      <td className="py-4 text-sm font-serif text-accent">{log.weight.toFixed(1)}</td>
                      <td className="py-4 text-sm">{log.calories} kcal</td>
                      <td className="py-4 text-[10px] text-ink/60">
                        {log.protein || 0}g / {log.carbs || 0}g / {log.fats || 0}g
                      </td>
                      {isAdmin && (
                        <td className="py-4 text-right">
                          <Button 
                            onClick={() => deleteItem('health_logs', log.id)}
                            variant="ghost"
                            size="sm"
                            magnetic={true}
                            icon={Trash2}
                            className="text-ink/20 hover:text-red-500"
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'milestones' && (
          <motion.div
            key="milestones"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
              <div className="flex flex-col space-y-4">
                <h3 className="text-2xl font-serif">Milestones & Rewards</h3>
                <div className="flex items-center bg-ink/5 p-1 rounded-full w-fit">
                  {(['active', 'achieved'] as const).map((tab) => (
                    <Button
                      key={tab}
                      onClick={() => setMilestoneTab(tab)}
                      variant={milestoneTab === tab ? 'ghost' : 'ghost'}
                      size="sm"
                      magnetic={true}
                      className={`px-6 py-2 rounded-full text-[10px] uppercase tracking-widest font-bold transition-all ${
                        milestoneTab === tab ? 'bg-surface text-ink shadow-sm' : 'text-ink/40 hover:text-ink'
                      }`}
                    >
                      {tab === 'active' ? 'Active' : 'Achieved'}
                    </Button>
                  ))}
                </div>
              </div>
              {isAdmin && (
                <Button
                  onClick={() => setIsAddingMilestone(true)}
                  variant="primary"
                  size="sm"
                  magnetic={true}
                  icon={Plus}
                  className="px-6 py-3 rounded-full text-[10px] uppercase tracking-widest shadow-lg shadow-accent/20"
                >
                  Add Milestone
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedMilestones.map((m) => (
                <div 
                  key={m.id} 
                  className={`p-8 rounded-3xl border transition-all ${
                    m.achieved ? 'bg-green-500/10 border-green-500/30' : 'bg-surface border-ink/10'
                  }`}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-4 rounded-2xl ${m.achieved ? 'bg-green-500 text-paper' : 'bg-accent/10 text-accent'}`}>
                      <Award size={24} />
                    </div>
                    <div className="flex items-center space-x-2">
                      {isAdmin && (
                        <Button 
                          onClick={() => {
                            setEditingMilestone(m);
                            setMilestoneForm({ 
                              name: m.name || '',
                              targetWeight: m.targetWeight.toString(), 
                              reward: m.reward || '',
                              targetDate: m.targetDate || ''
                            });
                          }}
                          variant="ghost"
                          size="sm"
                          magnetic={true}
                          icon={Edit2}
                          className="text-ink/20 hover:text-accent"
                        />
                      )}
                      {isAdmin && (
                        <Button 
                          onClick={() => deleteItem('milestones', m.id)}
                          variant="ghost"
                          size="sm"
                          magnetic={true}
                          icon={Trash2}
                          className="text-ink/20 hover:text-red-500"
                        />
                      )}
                    </div>
                  </div>
                  <h4 className="text-xl font-serif mb-1">{m.name}</h4>
                  {m.reward && <p className="text-sm text-accent font-medium mb-1">{m.reward}</p>}
                  <p className="text-[10px] uppercase tracking-widest text-ink/40 font-bold mb-6">Target: {m.targetWeight} kg</p>
                  <div className="flex flex-col space-y-1 mb-6">
                    {m.targetDate && !m.achieved && (
                      <p className="text-[10px] uppercase tracking-widest font-bold text-accent">
                        {(() => {
                          const diff = new Date(m.targetDate).getTime() - new Date().getTime();
                          const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                          return days > 0 ? `${days} days until` : days === 0 ? 'Due today' : `${Math.abs(days)} days overdue`;
                        })()}
                      </p>
                    )}
                    {m.targetDate && m.achieved && (
                      <p className="text-[10px] uppercase tracking-widest font-bold text-green-500">
                        Target Date: {new Date(m.targetDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  
                  <Button
                    onClick={() => toggleMilestone(m)}
                    disabled={!isAdmin}
                    variant={m.achieved ? 'primary' : 'ghost'}
                    size="sm"
                    magnetic={true}
                    className={`w-full py-3 rounded-xl text-[10px] uppercase tracking-widest font-bold transition-all ${
                      m.achieved 
                        ? 'bg-green-500 text-paper hover:bg-green-600' 
                        : 'bg-ink/5 text-ink/40 hover:bg-accent hover:text-paper'
                    }`}
                  >
                    {m.achieved ? 'Achieved' : 'Mark as Achieved'}
                  </Button>
                </div>
              ))}
              {sortedMilestones.length === 0 && (
                <div className="col-span-full py-20 text-center">
                  <p className="text-ink/40 font-serif italic">No {milestoneTab} milestones found.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'settings' && !isViewingAdmin && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-2xl mx-auto"
          >
            <div className="bg-surface border border-ink/5 p-8 rounded-3xl shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-serif">Configuration</h3>
                <Settings size={24} className="text-accent" />
              </div>
              
              <form onSubmit={handleUpdateConfig} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Height (cm)</label>
                    <input
                      type="number"
                      value={configForm.height}
                      onChange={(e) => setConfigForm({ ...configForm, height: e.target.value })}
                      className="w-full bg-ink/5 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-accent"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Age</label>
                    <input
                      type="number"
                      value={configForm.age}
                      onChange={(e) => setConfigForm({ ...configForm, age: e.target.value })}
                      className="w-full bg-ink/5 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-accent"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Gender</label>
                  <div className="flex space-x-4">
                    {['male', 'female'].map((g) => (
                      <Button
                        key={g}
                        type="button"
                        onClick={() => setConfigForm({ ...configForm, gender: g as 'male' | 'female' })}
                        variant={configForm.gender === g ? 'primary' : 'ghost'}
                        size="sm"
                        magnetic={true}
                        className={`flex-1 py-3 rounded-xl text-xs uppercase tracking-widest font-bold transition-all ${
                          configForm.gender === g ? '' : 'bg-ink/5 text-ink/40'
                        }`}
                      >
                        {g}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Activity Level (Multiplier)</label>
                  <select
                    value={configForm.activityLevel}
                    onChange={(e) => setConfigForm({ ...configForm, activityLevel: parseFloat(e.target.value) })}
                    className="w-full bg-ink/5 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-accent appearance-none"
                  >
                    <option value={1.2}>Sedentary (1.2)</option>
                    <option value={1.375}>Lightly Active (1.375)</option>
                    <option value={1.55}>Moderately Active (1.55)</option>
                    <option value={1.725}>Very Active (1.725)</option>
                    <option value={1.9}>Extra Active (1.9)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Starting Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={configForm.startingWeight}
                      onChange={(e) => setConfigForm({ ...configForm, startingWeight: e.target.value })}
                      className="w-full bg-ink/5 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-accent"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Weekly Loss Goal (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={configForm.targetWeeklyLoss}
                      onChange={(e) => setConfigForm({ ...configForm, targetWeeklyLoss: parseFloat(e.target.value) })}
                      className="w-full bg-ink/5 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-accent"
                      required
                    />
                  </div>
                </div>

                {isAdmin && (
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    magnetic={true}
                    className="w-full py-4 rounded-xl text-xs uppercase tracking-widest font-bold shadow-lg shadow-accent/20"
                  >
                    Save Configuration
                  </Button>
                )}
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {isAddingLog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingLog(false)}
              className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-surface w-full max-w-lg rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-serif">Add Daily Log</h3>
                <Button 
                  onClick={() => setIsAddingLog(false)} 
                  variant="ghost"
                  size="sm"
                  magnetic={true}
                  icon={X}
                  className="p-2 hover:bg-ink/5 rounded-full"
                />
              </div>
              <form onSubmit={handleAddLog} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Date</label>
                    <input
                      type="date"
                      value={logForm.date}
                      onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
                      className="w-full bg-ink/5 border-none rounded-xl px-4 py-3 text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={logForm.weight}
                      onChange={(e) => setLogForm({ ...logForm, weight: e.target.value })}
                      className="w-full bg-ink/5 border-none rounded-xl px-4 py-3 text-sm"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Calories (kcal)</label>
                  <input
                    type="number"
                    value={logForm.calories}
                    onChange={(e) => setLogForm({ ...logForm, calories: e.target.value })}
                    className="w-full bg-ink/5 border-none rounded-xl px-4 py-3 text-sm"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Protein (g)</label>
                    <input
                      type="number"
                      value={logForm.protein}
                      onChange={(e) => setLogForm({ ...logForm, protein: e.target.value })}
                      className="w-full bg-ink/5 border-none rounded-xl px-4 py-3 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Carbs (g)</label>
                    <input
                      type="number"
                      value={logForm.carbs}
                      onChange={(e) => setLogForm({ ...logForm, carbs: e.target.value })}
                      className="w-full bg-ink/5 border-none rounded-xl px-4 py-3 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Fats (g)</label>
                    <input
                      type="number"
                      value={logForm.fats}
                      onChange={(e) => setLogForm({ ...logForm, fats: e.target.value })}
                      className="w-full bg-ink/5 border-none rounded-xl px-4 py-3 text-sm"
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  variant="primary"
                  size="lg"
                  magnetic={true}
                  className="w-full py-4 rounded-xl text-xs uppercase tracking-widest font-bold shadow-lg shadow-accent/20"
                >
                  Save Daily Log
                </Button>
              </form>
            </motion.div>
          </div>
        )}

        {(isAddingMilestone || editingMilestone) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddingMilestone(false);
                setEditingMilestone(null);
                setMilestoneForm({ name: '', targetWeight: '', reward: '', targetDate: '' });
              }}
              className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-surface w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-serif">{editingMilestone ? 'Edit Milestone' : 'New Milestone'}</h3>
                <Button 
                  onClick={() => {
                    setIsAddingMilestone(false);
                    setEditingMilestone(null);
                    setMilestoneForm({ name: '', targetWeight: '', reward: '', targetDate: '' });
                  }} 
                  variant="ghost"
                  size="sm"
                  magnetic={true}
                  icon={X}
                  className="p-2 hover:bg-ink/5 rounded-full"
                />
              </div>
              <form onSubmit={handleAddMilestone} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Milestone Name</label>
                  <input
                    type="text"
                    value={milestoneForm.name}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, name: e.target.value })}
                    className="w-full bg-ink/5 border-none rounded-xl px-4 py-3 text-sm"
                    placeholder="e.g., Halfway Point"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Target Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={milestoneForm.targetWeight}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, targetWeight: e.target.value })}
                    className="w-full bg-ink/5 border-none rounded-xl px-4 py-3 text-sm"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Reward (Optional)</label>
                  <input
                    type="text"
                    value={milestoneForm.reward}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, reward: e.target.value })}
                    className="w-full bg-ink/5 border-none rounded-xl px-4 py-3 text-sm"
                    placeholder="e.g., New gym shoes"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Target Date (Optional)</label>
                  <input
                    type="date"
                    value={milestoneForm.targetDate}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, targetDate: e.target.value })}
                    className="w-full bg-ink/5 border-none rounded-xl px-4 py-3 text-sm"
                  />
                </div>
                <Button 
                  type="submit" 
                  variant="primary"
                  size="lg"
                  magnetic={true}
                  className="w-full py-4 rounded-xl text-xs uppercase tracking-widest font-bold shadow-lg shadow-accent/20"
                >
                  {editingMilestone ? 'Update Milestone' : 'Create Milestone'}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
