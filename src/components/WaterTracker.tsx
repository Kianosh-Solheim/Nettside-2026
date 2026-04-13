import { useState, useEffect, useMemo } from 'react';
import { collection, db, auth, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, handleFirestoreError, OperationType, setDoc } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Droplets, 
  Plus, 
  Minus, 
  Settings, 
  Check, 
  X,
  ChevronRight,
  RotateCcw,
  GlassWater,
  CupSoda,
  Beer
} from 'lucide-react';
import Button from './ui/Button';

interface WaterLog {
  id: string;
  date: string;
  amount: number;
}

interface WaterConfig {
  dailyGoal: number;
  unit: 'ml' | 'oz';
}

export default function WaterTracker({ user, isAdmin }: { user: any, isAdmin?: boolean }) {
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [config, setConfig] = useState<WaterConfig>({ dailyGoal: 2000, unit: 'ml' });
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState('2000');
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!user) return;

    console.log('WaterTracker: Fetching data', {
      userUid: user.uid,
      authUid: auth.currentUser?.uid,
      authEmail: auth.currentUser?.email,
      today
    });

    // Fetch config
    const configPath = `water_configs/${user.uid}`;
    const unsubscribeConfig = onSnapshot(doc(db, 'water_configs', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setConfig(docSnap.data() as WaterConfig);
        setNewGoal(docSnap.data().dailyGoal.toString());
      }
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, `water_configs/${user.uid}`));

    // Fetch today's logs
    const q = query(
      collection(db, 'water_logs'),
      where('userId', '==', user.uid),
      where('date', '==', today)
    );
    const unsubscribeLogs = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as WaterLog[];
      setLogs(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'water_logs'));

    return () => {
      unsubscribeConfig();
      unsubscribeLogs();
    };
  }, [user, today]);

  const totalIntake = useMemo(() => logs.reduce((acc, log) => acc + log.amount, 0), [logs]);
  const progress = Math.min(100, (totalIntake / config.dailyGoal) * 100);

  const addWater = async (amount: number) => {
    try {
      await addDoc(collection(db, 'water_logs'), {
        userId: user.uid,
        date: today,
        amount,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'water_logs');
    }
  };

  const updateGoal = async () => {
    try {
      const goalNum = parseInt(newGoal);
      if (isNaN(goalNum) || goalNum <= 0) return;

      await setDoc(doc(db, 'water_configs', user.uid), {
        userId: user.uid,
        dailyGoal: goalNum,
        unit: config.unit,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setIsEditingGoal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `water_configs/${user.uid}`);
    }
  };

  const resetToday = async () => {
    // In a real app, we might want to delete all logs for today
    // For simplicity, we'll just log a message or skip for now
    // Or we could implement a "undo last" button
  };

  if (loading) return null;

  return (
    <div className="bg-surface border border-ink/10 p-8 rounded-3xl shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-500">
            <Droplets size={24} />
          </div>
          <div>
            <h3 className="text-xl font-serif">Hydration</h3>
            <p className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Daily Water Intake</p>
          </div>
        </div>
        {isAdmin && (
          <Button 
            onClick={() => setIsEditingGoal(!isEditingGoal)}
            variant="ghost"
            size="sm"
            magnetic={true}
            className="text-ink/40 hover:text-ink"
            icon={Settings}
          />
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative py-8">
        {/* Progress Circle/Wave Visualization */}
        <div className="relative w-48 h-48 rounded-full border-4 border-ink/10 flex items-center justify-center overflow-hidden">
          <motion.div 
            className="absolute bottom-0 left-0 right-0 bg-blue-500/30"
            initial={{ height: 0 }}
            animate={{ height: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 50, damping: 20 }}
          />
          <div className="relative z-10 text-center">
            <h4 className="text-4xl font-serif">{totalIntake}</h4>
            <p className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">
              / {config.dailyGoal} {config.unit}
            </p>
          </div>
        </div>

        {/* Goal Editing Overlay */}
        <AnimatePresence>
          {isEditingGoal && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 bg-surface/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 rounded-2xl"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-ink/40 mb-4">Set Daily Goal ({config.unit})</p>
              <div className="flex items-center space-x-2 mb-6">
                <input 
                  type="number"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  className="w-32 bg-ink/5 border-none rounded-xl px-4 py-3 text-center text-xl font-serif focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex space-x-3">
                <Button 
                  onClick={() => setIsEditingGoal(false)}
                  variant="ghost"
                  size="sm"
                  magnetic={true}
                  className="bg-ink/5 text-ink/40 hover:text-ink"
                  icon={X}
                />
                <Button 
                  onClick={updateGoal}
                  magnetic={true}
                  className="bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-600"
                  icon={Check}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Add Buttons */}
      {isAdmin && (
        <div className="grid grid-cols-3 gap-4 mt-8">
          <Button 
            onClick={() => addWater(250)}
            variant="ghost"
            magnetic={true}
            className="flex flex-col items-center justify-center p-4 bg-ink/10 hover:bg-blue-500/20 hover:text-blue-500 group"
          >
            <GlassWater size={20} className="mb-2 opacity-40 group-hover:opacity-100" />
            <span className="text-[10px] font-bold uppercase tracking-widest">250ml</span>
          </Button>
          <Button 
            onClick={() => addWater(500)}
            variant="ghost"
            magnetic={true}
            className="flex flex-col items-center justify-center p-4 bg-ink/10 hover:bg-blue-500/20 hover:text-blue-500 group"
          >
            <CupSoda size={20} className="mb-2 opacity-40 group-hover:opacity-100" />
            <span className="text-[10px] font-bold uppercase tracking-widest">500ml</span>
          </Button>
          <Button 
            onClick={() => addWater(750)}
            variant="ghost"
            magnetic={true}
            className="flex flex-col items-center justify-center p-4 bg-ink/10 hover:bg-blue-500/20 hover:text-blue-500 group"
          >
            <Beer size={20} className="mb-2 opacity-40 group-hover:opacity-100" />
            <span className="text-[10px] font-bold uppercase tracking-widest">750ml</span>
          </Button>
        </div>
      )}
    </div>
  );
}
