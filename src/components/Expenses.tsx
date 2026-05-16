import { useState, useEffect, useMemo } from 'react';
import { db, collection, query, orderBy, onSnapshot, addDoc, setDoc, serverTimestamp, deleteDoc, doc, handleFirestoreError, OperationType } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit3, Calendar, CreditCard, Home, Zap, Car, Filter, Download, MoreVertical, DollarSign, RefreshCw, PieChart as PieChartIcon, BarChart3, TrendingUp, Settings2, X, Loader2, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, ArrowUpCircle, ArrowDownCircle, Wallet } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import Button from './ui/Button';

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: "Membership Fee" | "Rent" | "Power" | "Transport" | "Debt" | "Other";
  recurring: "One-time" | "Weekly" | "Monthly" | "6 Monthly" | "Yearly";
  date: string;
  status: "unpaid" | "paid";
  description?: string;
  createdAt: any;
  isProjected?: boolean;
}

interface Income {
  id: string;
  title: string;
  amount: number;
  date: string;
  type: "Salary" | "Dividend" | "Side Hustle" | "Other";
  recurring: "One-time" | "Weekly" | "Monthly" | "6 Monthly" | "Yearly";
  createdAt: any;
  isProjected?: boolean;
}

interface Budget {
  id: string;
  category: Expense['category'];
  amount: number;
}

const CATEGORIES = ["Membership Fee", "Rent", "Power", "Transport", "Debt", "Other"] as const;
const RECURRING_OPTIONS = ["One-time", "Weekly", "Monthly", "6 Monthly", "Yearly"] as const;
const INCOME_TYPES = ["Salary", "Dividend", "Side Hustle", "Other"] as const;

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  
  // View states
  const [showAddForm, setShowAddForm] = useState(false);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('All');
  const [view, setView] = useState<'list' | 'insights'>('list');
  const [tab, setTab] = useState<'expenses' | 'income'>('expenses');
  const [scale, setScale] = useState<'week' | 'month' | 'year'>('month');
  const [showSummary, setShowSummary] = useState(true);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

  // Date state
  const [currentDate, setCurrentDate] = useState(new Date());

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'Rent' as Expense['category'],
    recurring: 'One-time' as Expense['recurring'],
    date: new Date().toISOString().split('T')[0],
    status: 'unpaid' as Expense['status'],
    description: ''
  });

  const [incomeData, setIncomeData] = useState({
    title: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    type: 'Salary' as Income['type'],
    recurring: 'One-time' as Income['recurring']
  });

  const [budgetData, setBudgetData] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubscribeExpenses = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Expense[]);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'expenses'));

    const unsubscribeIncomes = onSnapshot(query(collection(db, 'incomes'), orderBy('date', 'desc')), (snapshot) => {
      setIncomes(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Income[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'incomes'));

    const unsubscribeBudgets = onSnapshot(collection(db, 'budgets'), (snapshot) => {
      const fetchedBudgets = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Budget[];
      setBudgets(fetchedBudgets);
      const bMap: Record<string, string> = {};
      fetchedBudgets.forEach(b => { bMap[b.category] = b.amount.toString(); });
      setBudgetData(bMap);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'budgets'));

    return () => {
      unsubscribeExpenses();
      unsubscribeIncomes();
      unsubscribeBudgets();
    };
  }, []);

  // Filter helpers
  const periodRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (scale === 'week') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end.setDate(diff + 6);
      end.setHours(23, 59, 59, 999);
    } else if (scale === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }, [currentDate, scale]);

  const getOccurrences = (items: (Expense | Income)[], rangeStart: Date, rangeEnd: Date) => {
    const realInRange = items.filter(item => {
      const d = new Date(item.date);
      return d >= rangeStart && d <= rangeEnd;
    });

    const projected: any[] = [];
    const recurringTemplates = items.filter(item => item.recurring !== 'One-time');
    
    // Group by title to find the "original" start date/template
    const templatesByTitle = new Map<string, any>();
    recurringTemplates.forEach(item => {
      const key = `${item.title}-${(item as any).category || (item as any).type}`;
      if (!templatesByTitle.has(key) || new Date(item.date) < new Date(templatesByTitle.get(key).date)) {
        templatesByTitle.set(key, item);
      }
    });

    templatesByTitle.forEach(template => {
      let current = new Date(template.date);
      
      // Safety break to prevent infinite loops or excessive calculations
      let iterations = 0;
      const MAX_ITERATIONS = 500;

      while (current <= rangeEnd && iterations < MAX_ITERATIONS) {
        iterations++;
        const dateStr = current.toISOString().split('T')[0];
        
        if (current >= rangeStart) {
          const alreadyExists = realInRange.some(r => r.title === template.title && r.date === dateStr);
          if (!alreadyExists && current > new Date(template.date)) {
            projected.push({
              ...template,
              id: `projected-${template.id}-${dateStr}`,
              date: dateStr,
              status: 'unpaid',
              isProjected: true
            });
          }
        }

        const next = new Date(current);
        if (template.recurring === 'Weekly') next.setDate(next.getDate() + 7);
        else if (template.recurring === 'Monthly') next.setMonth(next.getMonth() + 1);
        else if (template.recurring === '6 Monthly') next.setMonth(next.getMonth() + 6);
        else if (template.recurring === 'Yearly') next.setFullYear(next.getFullYear() + 1);
        else break;
        
        if (next.getTime() === current.getTime()) break; // Prevent infinite loop
        current = next;
      }
    });

    return [...realInRange, ...projected].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const currentPeriodExpenses = useMemo(() => {
    return getOccurrences(expenses, periodRange.start, periodRange.end) as Expense[];
  }, [expenses, periodRange]);

  const currentPeriodIncomes = useMemo(() => {
    return getOccurrences(incomes, periodRange.start, periodRange.end) as Income[];
  }, [incomes, periodRange]);

  const statsByCategory = useMemo(() => {
    return CATEGORIES.map(cat => {
      const spent = currentPeriodExpenses
        .filter(e => e.category === cat)
        .reduce((sum, e) => sum + e.amount, 0);
      
      let budget = budgets.find(b => b.category === cat)?.amount || 0;
      // Adjust budget display for scale
      if (scale === 'week') budget = (budget * 12) / 52;
      if (scale === 'year') budget = budget * 12;

      return { name: cat, spent, budget, percentage: budget > 0 ? (spent / budget) * 100 : 0 };
    });
  }, [currentPeriodExpenses, budgets, scale]);

  const totalExpenses = currentPeriodExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = currentPeriodIncomes.reduce((sum, i) => sum + i.amount, 0);
  const netSavings = totalIncome - totalExpenses;

  // Actions
  const handleMonthChange = (offset: number) => {
    const newDate = new Date(currentDate);
    if (scale === 'week') newDate.setDate(newDate.getDate() + (offset * 7));
    else if (scale === 'month') newDate.setMonth(newDate.getMonth() + offset);
    else newDate.setFullYear(newDate.getFullYear() + offset);
    setCurrentDate(newDate);
  };

  const getPeriodLabel = () => {
    if (scale === 'week') {
      const weekNumber = Math.ceil((((periodRange.start.getTime() - new Date(periodRange.start.getFullYear(), 0, 1).getTime()) / 86400000) + 1) / 7);
      return `Week ${weekNumber}, ${periodRange.start.getFullYear()} (${periodRange.start.toLocaleDateString('default', { month: 'short', day: 'numeric' })} – ${periodRange.end.toLocaleDateString('default', { month: 'short', day: 'numeric' })})`;
    }
    if (scale === 'month') return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    return currentDate.getFullYear().toString();
  };

  const toggleExpenseStatus = async (expense: Expense) => {
    try {
      if (expense.isProjected) {
        // Materialize the expense
        const { id, isProjected, createdAt, ...data } = expense;
        await addDoc(collection(db, 'expenses'), {
          ...data,
          status: 'paid',
          createdAt: serverTimestamp()
        });
        setStatus({ type: 'success', message: 'Projected expense recorded as paid' });
        setTimeout(() => setStatus(null), 3000);
        return;
      }

      const isMarkingPaid = expense.status === 'unpaid';
      
      await setDoc(doc(db, 'expenses', expense.id), {
        status: isMarkingPaid ? 'paid' : 'unpaid'
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `expenses/${expense.id}`);
    }
  };

  const [confirmDelete, setConfirmDelete] = useState<{ id: string, type: 'expense' | 'income' } | null>(null);

  const handleDeleteExpense = async (id: string) => {
    console.log('[Expenses] Starting handleDeleteExpense for ID:', id);
    if (!id) {
      console.error('[Expenses] Delete failed: Empty ID provided');
      setStatus({ type: 'error', message: 'Error: Missing record ID' });
      return;
    }
    
    try {
      setStatus({ type: 'info', message: 'Deleting record from database...' });
      console.log('[Expenses] Calling deleteDoc for path: expenses/', id);
      await deleteDoc(doc(db, 'expenses', id));
      
      console.log('[Expenses] deleteDoc resolved successfully for:', id);
      setStatus({ type: 'success', message: 'Record removed successfully' });
      setConfirmDelete(null);
      
      // Verification: Check if it still exists in local state for a moment
      setTimeout(() => {
        setExpenses(prev => {
          const stillExists = prev.some(e => e.id === id);
          if (stillExists) {
            console.warn('[Expenses] Warning: Item still in local state after successful deleteDoc for ID:', id);
          } else {
            console.log('[Expenses] Item successfully removed from local state for ID:', id);
          }
          return prev;
        });
        setStatus(null);
      }, 2000);
    } catch (error) {
      console.error('[Expenses] Delete operation failed for ID:', id, error);
      setStatus({ type: 'error', message: 'Database error: Could not delete' });
      setConfirmDelete(null);
      handleFirestoreError(error, OperationType.DELETE, `expenses/${id}`, true);
    }
  };

  const handleDeleteIncome = async (id: string) => {
    console.log('[Expenses] Starting handleDeleteIncome for ID:', id);
    if (!id) {
      console.error('[Expenses] Delete failed: Empty ID provided');
      setStatus({ type: 'error', message: 'Error: Missing record ID' });
      return;
    }

    try {
      setStatus({ type: 'info', message: 'Deleting record from database...' });
      console.log('[Expenses] Calling deleteDoc for path: incomes/', id);
      await deleteDoc(doc(db, 'incomes', id));
      
      console.log('[Expenses] deleteDoc resolved successfully for:', id);
      setStatus({ type: 'success', message: 'Record removed successfully' });
      setConfirmDelete(null);
      
      setTimeout(() => {
        setIncomes(prev => {
          const stillExists = prev.some(i => i.id === id);
          if (stillExists) {
            console.warn('[Expenses] Warning: Item still in local state after successful deleteDoc for ID:', id);
          }
          return prev;
        });
        setStatus(null);
      }, 2000);
    } catch (error) {
      console.error('[Expenses] Delete operation failed for ID:', id, error);
      setStatus({ type: 'error', message: 'Database error: Could not delete' });
      setConfirmDelete(null);
      handleFirestoreError(error, OperationType.DELETE, `incomes/${id}`, true);
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setStatus({ type: 'info', message: editingId ? 'Updating expense...' : 'Saving expense...' });
      if (editingId) {
        await setDoc(doc(db, 'expenses', editingId), { 
          ...formData, 
          amount: parseFloat(formData.amount),
          updatedAt: serverTimestamp() 
        }, { merge: true });
        setShowAddForm(false);
        setEditingId(null);
        setStatus({ type: 'success', message: 'Expense updated' });
      } else {
        await addDoc(collection(db, 'expenses'), {
          ...formData,
          amount: parseFloat(formData.amount),
          createdAt: serverTimestamp()
        });
        // Reset form but keep open for multiple entries
        setFormData({
          title: '',
          amount: '',
          category: 'Other',
          date: new Date().toISOString().split('T')[0],
          recurring: 'One-time',
          status: 'unpaid',
          description: ''
        });
        setStatus({ type: 'success', message: 'Expense added! Add another?' });
      }
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to save expense' });
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'expenses');
    }
  };

  const handleIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setStatus({ type: 'info', message: 'Saving income...' });
      await addDoc(collection(db, 'incomes'), {
        ...incomeData,
        amount: parseFloat(incomeData.amount),
        createdAt: serverTimestamp()
      });
      // Reset form but keep it open for multiple entries
      setIncomeData({
        title: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        type: 'Salary' as Income['type'],
        recurring: 'One-time' as Income['recurring']
      });
      setStatus({ type: 'success', message: 'Income source added! Add another?' });
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to save income' });
      handleFirestoreError(error, OperationType.CREATE, 'incomes');
    }
  };

  const handleBudgetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      for (const [category, amount] of Object.entries(budgetData)) {
        const id = category.toLowerCase().replace(/\s+/g, '_');
        await setDoc(doc(db, 'budgets', id), {
          category,
          amount: parseFloat(amount) || 0,
          updatedAt: serverTimestamp()
        });
      }
      setShowBudgetForm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'budgets');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Membership Fee': return <CreditCard size={16} />;
      case 'Rent': return <Home size={16} />;
      case "Power": return <Zap size={16} />;
      case "Transport": return <Car size={16} />;
      case "Debt": return <TrendingUp size={16} />;
      default: return <DollarSign size={16} />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-serif font-medium tracking-tight mb-2">Finance Hub</h1>
          <div className="flex items-center gap-4">
            <button onClick={() => handleMonthChange(-1)} className="p-2 hover:bg-ink/5 rounded-full text-ink/40"><ChevronLeft size={20}/></button>
            <span className="text-lg font-serif">
              {getPeriodLabel()}
            </span>
            <button onClick={() => handleMonthChange(1)} className="p-2 hover:bg-ink/5 rounded-full text-ink/40"><ChevronRight size={20}/></button>
          </div>
        </div>

        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={`px-6 py-3 rounded-2xl flex items-center gap-3 shadow-lg ${
                status.type === 'success' ? 'bg-emerald-500 text-white' :
                status.type === 'error' ? 'bg-red-500 text-white' :
                'bg-accent text-white'
              }`}
            >
              {status.type === 'success' ? <CheckCircle2 size={18} /> : 
               status.type === 'error' ? <AlertCircle size={18} /> : 
               <Loader2 size={18} className="animate-spin" />}
              <span className="text-xs font-medium">{status.message}</span>
              <button onClick={() => setStatus(null)} className="ml-2 hover:opacity-70">
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-ink/5 p-1 rounded-xl">
            {(['week', 'month', 'year'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScale(s)}
                className={`px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest transition-all ${scale === s ? 'bg-paper shadow-sm text-accent' : 'text-ink/40 hover:text-ink/60'}`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex bg-ink/5 p-1 rounded-xl ml-2">
            <button onClick={() => setView('list')} className={`px-4 py-2 rounded-lg text-[10px] uppercase tracking-widest transition-all ${view === 'list' ? 'bg-paper shadow-sm text-accent' : 'text-ink/40'}`}>List</button>
            <button onClick={() => setView('insights')} className={`px-4 py-2 rounded-lg text-[10px] uppercase tracking-widest transition-all ${view === 'insights' ? 'bg-paper shadow-sm text-accent' : 'text-ink/40'}`}>Insights</button>
          </div>
          <Button onClick={() => setShowBudgetForm(true)} variant="secondary" icon={Settings2} magnetic={true}>Budgets</Button>
          <Button onClick={() => setShowIncomeForm(true)} variant="secondary" icon={Wallet} magnetic={true}>Add Income</Button>
          <Button onClick={() => setShowAddForm(true)} variant="primary" icon={Plus} magnetic={true}>Add Expense</Button>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="bg-paper border border-ink/5 rounded-3xl p-8 flex items-center justify-between group hover:border-emerald-500/20 transition-all">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-ink/40 mb-2">Total Income (Brutto)</p>
            <h3 className="text-3xl font-serif text-emerald-500">+{totalIncome.toLocaleString()} NOK</h3>
          </div>
          <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl group-hover:scale-110 transition-transform">
            <ArrowUpCircle size={32} />
          </div>
        </div>
        <div className="bg-paper border border-ink/5 rounded-3xl p-8 flex items-center justify-between group hover:border-red-500/20 transition-all">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-ink/40 mb-2">Total Expenses</p>
            <h3 className="text-3xl font-serif text-red-500">-{totalExpenses.toLocaleString()} NOK</h3>
          </div>
          <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl group-hover:scale-110 transition-transform">
            <ArrowDownCircle size={32} />
          </div>
        </div>
        <div className={`bg-paper border border-ink/5 rounded-3xl p-8 flex items-center justify-between group transition-all ${netSavings >= 0 ? 'hover:border-accent/20' : 'hover:border-orange-500/20'}`}>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-ink/40 mb-2">Net Savings (Netto)</p>
            <h3 className={`text-3xl font-serif ${netSavings >= 0 ? 'text-accent' : 'text-orange-500'}`}>
              {netSavings >= 0 ? '+' : ''}{netSavings.toLocaleString()} NOK
            </h3>
          </div>
          <div className={`p-4 rounded-2xl group-hover:scale-110 transition-transform ${netSavings >= 0 ? 'bg-accent/10 text-accent' : 'bg-orange-500/10 text-orange-500'}`}>
            <Wallet size={32} />
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete(null)}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-paper p-10 rounded-[48px] border border-ink/5 shadow-2xl max-w-md w-full text-center"
            >
              <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-[32px] flex items-center justify-center mx-auto mb-8">
                <Trash2 size={40} />
              </div>
              <h3 className="text-3xl font-serif mb-4">Delete Permanently?</h3>
              <p className="text-ink/40 text-sm leading-relaxed mb-10 px-4">
                Are you sure you want to delete this {confirmDelete.type}? This action cannot be undone and will be removed from your records.
              </p>
              <div className="flex gap-4">
                <Button 
                  onClick={() => setConfirmDelete(null)} 
                  variant="secondary" 
                  className="flex-1 py-5 rounded-3xl"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => confirmDelete.type === 'expense' ? handleDeleteExpense(confirmDelete.id) : handleDeleteIncome(confirmDelete.id)} 
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-5 rounded-3xl border-none"
                >
                  Delete
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Forms (Add Expense, Add Income, Budgets) - Simplified for brevity but fully functional */}
        {showAddForm && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mb-12">
            <form onSubmit={handleExpenseSubmit} className="bg-paper border border-ink/5 rounded-2xl p-8 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6">
              <input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Title" required className="bg-surface border border-ink/5 text-ink p-3 rounded-xl outline-none" />
              <input value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} type="number" placeholder="Amount (NOK)" required className="bg-surface border border-ink/5 text-ink p-3 rounded-xl outline-none" />
              <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})} className="bg-surface border border-ink/5 text-ink p-3 rounded-xl outline-none">
                {CATEGORIES.map(c => <option key={c} value={c} className="bg-surface text-ink">{c}</option>)}
              </select>
              <select value={formData.recurring} onChange={e => setFormData({...formData, recurring: e.target.value as any})} className="bg-surface border border-ink/5 text-ink p-3 rounded-xl outline-none">
                {RECURRING_OPTIONS.map(o => <option key={o} value={o} className="bg-surface text-ink">{o}</option>)}
              </select>
              <input value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} type="date" className="bg-surface border border-ink/5 text-ink p-3 rounded-xl outline-none" />
              <div className="flex gap-2">
                <Button type="submit" variant="primary" className="flex-1">Save</Button>
                <Button type="button" onClick={() => setShowAddForm(false)} variant="secondary">Cancel</Button>
              </div>
            </form>
          </motion.div>
        )}

        {showIncomeForm && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mb-12">
            <form onSubmit={handleIncomeSubmit} className="bg-paper border border-ink/5 rounded-2xl p-8 shadow-xl grid grid-cols-1 md:grid-cols-6 gap-6">
              <input value={incomeData.title} onChange={e => setIncomeData({...incomeData, title: e.target.value})} placeholder="Income Source" required className="bg-surface border border-ink/5 text-ink p-3 rounded-xl outline-none" />
              <input value={incomeData.amount} onChange={e => setIncomeData({...incomeData, amount: e.target.value})} type="number" placeholder="Amount" required className="bg-surface border border-ink/5 text-ink p-3 rounded-xl outline-none" />
              <select value={incomeData.type} onChange={e => setIncomeData({...incomeData, type: e.target.value as any})} className="bg-surface border border-ink/5 text-ink p-3 rounded-xl outline-none">
                {INCOME_TYPES.map(t => <option key={t} value={t} className="bg-surface text-ink">{t}</option>)}
              </select>
              <select value={incomeData.recurring} onChange={e => setIncomeData({...incomeData, recurring: e.target.value as any})} className="bg-surface border border-ink/5 text-ink p-3 rounded-xl outline-none">
                {RECURRING_OPTIONS.map(o => <option key={o} value={o} className="bg-surface text-ink">{o}</option>)}
              </select>
              <input value={incomeData.date} onChange={e => setIncomeData({...incomeData, date: e.target.value})} type="date" className="bg-surface border border-ink/5 text-ink p-3 rounded-xl outline-none" />
              <div className="flex gap-2">
                <Button type="submit" variant="primary" className="flex-1">Save</Button>
                <Button type="button" onClick={() => setShowIncomeForm(false)} variant="secondary">Cancel</Button>
              </div>
            </form>
          </motion.div>
        )}

        {showBudgetForm && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mb-12">
            <form onSubmit={handleBudgetSubmit} className="bg-paper border border-ink/5 rounded-2xl p-8 shadow-xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {CATEGORIES.map(cat => (
                  <div key={cat} className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-ink/40">{cat}</label>
                    <input type="number" value={budgetData[cat] || ''} onChange={e => setBudgetData({...budgetData, [cat]: e.target.value})} className="w-full bg-surface border border-ink/5 text-ink p-3 rounded-xl outline-none" placeholder="0" />
                  </div>
                ))}
              </div>
              <Button type="submit" variant="primary">Update Budgets</Button>
              <Button type="button" onClick={() => setShowBudgetForm(false)} variant="secondary" className="ml-4">Close</Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main View */}
      <div className="mb-8 flex gap-6">
        <button onClick={() => setTab('expenses')} className={`text-sm font-serif pb-2 transition-all ${tab === 'expenses' ? 'text-accent border-b-2 border-accent' : 'text-ink/40'}`}>Expenses</button>
        <button onClick={() => setTab('income')} className={`text-sm font-serif pb-2 transition-all ${tab === 'income' ? 'text-accent border-b-2 border-accent' : 'text-ink/40'}`}>Income</button>
      </div>

      {/* Summary Cards */}

      {view === 'list' ? (
        <div className="space-y-4">
          {tab === 'expenses' ? (
            currentPeriodExpenses.length === 0 ? (
              <div className="text-center py-20 text-ink/20 font-serif italic">No expenses recorded for this month</div>
            ) : (
              currentPeriodExpenses.map((expense) => (
                <div key={expense.id} className="bg-paper border border-ink/5 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => toggleExpenseStatus(expense)}
                      className={`p-2 rounded-full transition-all ${expense.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}
                    >
                      {expense.status === 'paid' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    </button>
                    <div>
                      <h4 className="font-medium">{expense.title}</h4>
                      <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-ink/40">
                        <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(expense.date).toLocaleDateString('default', { day: 'numeric', month: 'short' })}</span>
                        <span className="flex items-center gap-1">{getCategoryIcon(expense.category)} {expense.category}</span>
                        {expense.recurring !== 'One-time' && <span className="flex items-center gap-1 text-accent bg-accent/5 px-2 rounded-full"><RefreshCw size={8} /> {expense.recurring}</span>}
                        {expense.isProjected && <span className="bg-ink/5 px-2 rounded-full italic">Projected</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <span className="text-xl font-serif">{expense.amount.toLocaleString()} NOK</span>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => { setFormData(expense as any); setEditingId(expense.id); setShowAddForm(true); }} 
                        variant="ghost"
                        size="sm"
                        magnetic={false}
                        className="p-2 text-ink/20 hover:text-accent transition-colors"
                        title="Edit expense"
                        icon={Edit3}
                      />
                      <Button 
                        onClick={() => setConfirmDelete({ id: expense.id, type: 'expense' })} 
                        variant="ghost"
                        size="sm"
                        magnetic={false}
                        className="p-2 text-ink/20 hover:text-red-500 transition-colors"
                        title="Delete expense"
                        icon={Trash2}
                      />
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            currentPeriodIncomes.length === 0 ? (
              <div className="text-center py-20 text-ink/20 font-serif italic">No income sources recorded for this month</div>
            ) : (
              currentPeriodIncomes.map((income) => (
                <div key={income.id} className="bg-paper border border-ink/5 rounded-2xl p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl"><Wallet size={20}/></div>
                    <div>
                      <h4 className="font-medium">{income.title}</h4>
                      <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-ink/40">
                        <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(income.date).toLocaleDateString('default', { day: 'numeric', month: 'short' })}</span>
                        <span>{income.type}</span>
                        {income.recurring !== 'One-time' && <span className="flex items-center gap-1 text-emerald-500 bg-emerald-500/5 px-2 rounded-full"><RefreshCw size={8} /> {income.recurring}</span>}
                        {income.isProjected && <span className="bg-ink/5 px-2 rounded-full italic">Projected</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <span className="text-xl font-serif text-emerald-500">+{income.amount.toLocaleString()} NOK</span>
                    <Button 
                      onClick={() => setConfirmDelete({ id: income.id, type: 'income' })} 
                      variant="ghost"
                      size="sm"
                      magnetic={false}
                      className="p-2 text-ink/20 hover:text-red-500 transition-colors"
                      title="Delete income"
                      icon={Trash2}
                    />
                  </div>
                </div>
              ))
            )
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-paper border border-ink/5 rounded-3xl p-8">
            <h3 className="text-lg font-serif mb-6 flex items-center gap-2"><PieChartIcon size={18} className="text-accent" /> Expense Mix</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statsByCategory.filter(s => s.spent > 0)} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="spent">
                    {statsByCategory.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-paper border border-ink/5 rounded-3xl p-8">
            <h3 className="text-lg font-serif mb-6 flex items-center gap-2"><BarChart3 size={18} className="text-accent" /> Budget vs Actual</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statsByCategory} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="spent" name="Spent" fill="#000" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="budget" name="Budget" fill="#e5e7eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
