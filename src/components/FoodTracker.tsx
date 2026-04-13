import React, { useState, useEffect, useRef } from 'react';
import { 
  Utensils, 
  Plus, 
  Camera, 
  Search, 
  ChevronRight, 
  Trash2, 
  X, 
  Check,
  AlertCircle,
  Loader2,
  PieChart as PieChartIcon,
  Flame,
  Zap,
  Wheat,
  Droplet,
  Barcode,
  Scale as ScaleIcon
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  setDoc,
  getDoc,
  db,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { GoogleGenAI, Type } from "@google/genai";
import Button from './ui/Button';

interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  mealType: string;
  date: string;
}

interface FoodConfig {
  dailyCalorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatsGoal: number;
}

export default function FoodTracker({ user, isAdmin }: { user: any, isAdmin?: boolean }) {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [config, setConfig] = useState<FoodConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  
  const [newFood, setNewFood] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
    mealType: 'Lunch',
    amountGrams: '100',
    isFromBarcode: false,
    per100g: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0
    }
  });

  const scannerRef = useRef<Html5Qrcode | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!user) return;

    // Fetch config
    const configRef = doc(db, 'food_configs', user.uid);
    const unsubConfig = onSnapshot(configRef, (doc) => {
      if (doc.exists()) {
        setConfig(doc.data() as FoodConfig);
      } else {
        // Default config
        const defaultConfig = {
          dailyCalorieGoal: 2000,
          proteinGoal: 150,
          carbsGoal: 200,
          fatsGoal: 70
        };
        setDoc(configRef, { ...defaultConfig, userId: user.uid, updatedAt: serverTimestamp() })
          .catch(error => handleFirestoreError(error, OperationType.WRITE, `food_configs/${user.uid}`));
        setConfig(defaultConfig);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `food_configs/${user.uid}`);
    });

    // Fetch daily foods
    const q = query(
      collection(db, 'food_logs'),
      where('userId', '==', user.uid),
      where('date', '==', today)
    );

    const unsubFoods = onSnapshot(q, (snapshot) => {
      const foodData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FoodItem[];
      setFoods(foodData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'food_logs');
    });

    return () => {
      unsubConfig();
      unsubFoods();
    };
  }, [user, today]);

  const totals = foods.reduce((acc, food) => ({
    calories: acc.calories + (food.calories || 0),
    protein: acc.protein + (food.protein || 0),
    carbs: acc.carbs + (food.carbs || 0),
    fats: acc.fats + (food.fats || 0)
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

  const isTransitioning = useRef(false);

  useEffect(() => {
    let active = true;

    const startScanner = async () => {
      if (!isScanningBarcode || isTransitioning.current) return;
      
      const element = document.getElementById("barcode-reader");
      if (!element) {
        // If element not found, retry after a short delay (modal animation)
        setTimeout(() => {
          if (active) startScanner();
        }, 100);
        return;
      }

      try {
        isTransitioning.current = true;
        const html5QrCode = new Html5Qrcode("barcode-reader");
        scannerRef.current = html5QrCode;
        
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 }
          },
          (decodedText) => {
            handleBarcodeResult(decodedText);
            setIsScanningBarcode(false); // This will trigger the useEffect to stop the scanner
          },
          () => { /* ignore errors */ }
        );
      } catch (err) {
        console.error("Scanner start error:", err);
        if (active) {
          setScanError("Could not start camera. Please check permissions.");
          setIsScanningBarcode(false);
        }
      } finally {
        isTransitioning.current = false;
      }
    };

    if (isScanningBarcode) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      active = false;
      stopScanner();
    };
  }, [isScanningBarcode]);

  const stopScanner = async () => {
    if (isTransitioning.current) {
      // If transitioning, wait and try again
      setTimeout(stopScanner, 100);
      return;
    }

    if (scannerRef.current) {
      try {
        isTransitioning.current = true;
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      } catch (err) {
        console.error("Stop error:", err);
      } finally {
        isTransitioning.current = false;
      }
    }
  };

  const handleBarcodeResult = async (barcode: string) => {
    setScanLoading(true);
    setScanError(null);
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
        headers: { 'User-Agent': 'HealthTrackerApp - Web - Version 1.0' }
      });
      const data = await response.json();

      if (data.status === 1) {
        const product = data.product;
        const nutriments = product.nutriments;
        
        const per100 = {
          calories: Math.round(nutriments['energy-kcal_100g'] || 0),
          protein: Math.round(nutriments.proteins_100g || 0),
          carbs: Math.round(nutriments.carbohydrates_100g || 0),
          fats: Math.round(nutriments.fat_100g || 0)
        };

        setNewFood({
          name: product.product_name || 'Unknown Product',
          calories: per100.calories.toString(),
          protein: per100.protein.toString(),
          carbs: per100.carbs.toString(),
          fats: per100.fats.toString(),
          mealType: 'Lunch',
          amountGrams: '100',
          isFromBarcode: true,
          per100g: per100
        });
        setIsAdding(true);
      } else {
        setScanError("Product not found in database.");
      }
    } catch (error) {
      console.error("Barcode fetch error:", error);
      setScanError("Failed to fetch product data.");
    } finally {
      setScanLoading(false);
    }
  };

  const handleWeightChange = (weight: string) => {
    const w = parseFloat(weight) || 0;
    const factor = w / 100;
    setNewFood(prev => ({
      ...prev,
      amountGrams: weight,
      calories: Math.round(prev.per100g.calories * factor).toString(),
      protein: Math.round(prev.per100g.protein * factor).toString(),
      carbs: Math.round(prev.per100g.carbs * factor).toString(),
      fats: Math.round(prev.per100g.fats * factor).toString(),
    }));
  };

  const handleAddFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newFood.name || !newFood.calories) return;

    try {
      await addDoc(collection(db, 'food_logs'), {
        userId: user.uid,
        date: today,
        name: newFood.name,
        calories: parseInt(newFood.calories),
        protein: parseInt(newFood.protein) || 0,
        carbs: parseInt(newFood.carbs) || 0,
        fats: parseInt(newFood.fats) || 0,
        mealType: newFood.mealType,
        amountGrams: parseInt(newFood.amountGrams) || 0,
        createdAt: serverTimestamp()
      });
      setNewFood({ 
        name: '', 
        calories: '', 
        protein: '', 
        carbs: '', 
        fats: '', 
        mealType: 'Lunch',
        amountGrams: '100',
        isFromBarcode: false,
        per100g: { calories: 0, protein: 0, carbs: 0, fats: 0 }
      });
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'food_logs');
    }
  };

  const deleteFood = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'food_logs', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `food_logs/${id}`);
    }
  };

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setScanLoading(true);
    setScanError(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            {
              parts: [
                { text: "Analyze this food image and provide the estimated nutritional information. Return ONLY a JSON object with fields: name, calories, protein, carbs, fats. If multiple items are present, provide the total. Be as accurate as possible." },
                { inlineData: { data: base64Data, mimeType: file.type } }
              ]
            }
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                calories: { type: Type.INTEGER },
                protein: { type: Type.INTEGER },
                carbs: { type: Type.INTEGER },
                fats: { type: Type.INTEGER }
              },
              required: ["name", "calories"]
            }
          }
        });

        const result = JSON.parse(response.text || '{}');
        if (result.name && result.calories) {
          setNewFood({
            name: result.name,
            calories: result.calories.toString(),
            protein: (result.protein || 0).toString(),
            carbs: (result.carbs || 0).toString(),
            fats: (result.fats || 0).toString(),
            mealType: 'Lunch',
            amountGrams: '100',
            isFromBarcode: false,
            per100g: { calories: 0, protein: 0, carbs: 0, fats: 0 }
          });
          setIsAdding(true);
        } else {
          setScanError("Could not identify food. Please try again or enter manually.");
        }
        setScanLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Scan error:", error);
      setScanError("An error occurred during scanning.");
      setScanLoading(false);
    }
  };

  if (loading) return null;

  const calorieProgress = config ? (totals.calories / config.dailyCalorieGoal) * 100 : 0;

  return (
    <div className="bg-surface border border-ink/10 p-8 rounded-3xl shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-orange-500/20 rounded-2xl text-orange-500">
            <Utensils size={24} />
          </div>
          <div>
            <h3 className="text-xl font-serif">Nutrition</h3>
            <p className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Daily Intake</p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex space-x-2">
            <Button 
              onClick={() => setIsScanningBarcode(true)}
              variant="ghost"
              size="sm"
              magnetic={true}
              className="bg-ink/5 hover:bg-ink/10 text-ink/60 hover:text-ink"
              title="Scan Barcode"
              icon={Barcode}
            />
            <Button 
              onClick={() => fileInputRef.current?.click()}
              variant="ghost"
              size="sm"
              magnetic={true}
              className="bg-ink/5 hover:bg-ink/10 text-ink/60 hover:text-ink"
              disabled={scanLoading}
              isLoading={scanLoading}
              title="Scan Food with AI"
              icon={Camera}
            />
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleScan}
              capture="environment"
            />
            <Button 
              onClick={() => {
                setNewFood({ 
                  name: '', 
                  calories: '', 
                  protein: '', 
                  carbs: '', 
                  fats: '', 
                  mealType: 'Lunch',
                  amountGrams: '100',
                  isFromBarcode: false,
                  per100g: { calories: 0, protein: 0, carbs: 0, fats: 0 }
                });
                setIsAdding(true);
              }}
              magnetic={true}
              className="bg-accent text-paper shadow-lg shadow-accent/20"
              icon={Plus}
            />
          </div>
        )}
      </div>

      {/* Calorie Progress */}
      <div className="flex items-center justify-between mb-8 p-6 bg-ink/5 rounded-3xl">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-ink/5"
            />
            <motion.circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={251.2}
              initial={{ strokeDashoffset: 251.2 }}
              animate={{ strokeDashoffset: 251.2 - (251.2 * Math.min(calorieProgress, 100)) / 100 }}
              className="text-orange-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-serif">{Math.round(totals.calories)}</span>
            <span className="text-[8px] uppercase font-bold text-ink/40">kcal</span>
          </div>
        </div>
        <div className="flex-1 ml-8 space-y-1">
          <div className="flex justify-between items-end">
            <span className="text-[10px] uppercase tracking-widest font-bold text-ink/40">Remaining</span>
            <span className="text-xl font-serif text-accent">
              {config ? Math.max(0, config.dailyCalorieGoal - totals.calories) : '--'}
            </span>
          </div>
          <div className="w-full h-1.5 bg-ink/5 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(calorieProgress, 100)}%` }}
            />
          </div>
          <p className="text-[8px] text-right text-ink/40 font-bold">Goal: {config?.dailyCalorieGoal} kcal</p>
        </div>
      </div>

      {/* Macros */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Protein', value: totals.protein, goal: config?.proteinGoal, color: 'bg-blue-500', icon: Zap },
          { label: 'Carbs', value: totals.carbs, goal: config?.carbsGoal, color: 'bg-green-500', icon: Wheat },
          { label: 'Fats', value: totals.fats, goal: config?.fatsGoal, color: 'bg-purple-500', icon: Droplet },
        ].map((macro) => (
          <div key={macro.label} className="p-4 bg-ink/5 rounded-2xl">
            <div className="flex items-center space-x-2 mb-2">
              <macro.icon size={12} className={macro.color.replace('bg-', 'text-')} />
              <span className="text-[8px] uppercase tracking-widest font-bold text-ink/40">{macro.label}</span>
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="text-lg font-serif">{Math.round(macro.value)}</span>
              <span className="text-[8px] text-ink/40">/ {macro.goal}g</span>
            </div>
            <div className="w-full h-1 bg-ink/10 rounded-full mt-2 overflow-hidden">
              <motion.div 
                className={`h-full ${macro.color}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((macro.value / (macro.goal || 1)) * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Food List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {foods.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-ink/20 py-8">
            <Utensils size={40} className="mb-4 opacity-20" />
            <p className="text-xs italic">No food logged today</p>
          </div>
        ) : (
          foods.sort((a, b) => b.calories - a.calories).map((food) => (
            <div key={food.id} className="group flex items-center justify-between p-4 bg-ink/5 hover:bg-ink/10 rounded-2xl transition-all">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center text-orange-500 shadow-sm">
                  <span className="text-[10px] font-bold">{food.mealType[0]}</span>
                </div>
                <div>
                  <p className="text-sm font-serif">{food.name}</p>
                  <div className="flex items-center space-x-3 mt-1">
                    <span className="text-[8px] uppercase font-bold text-ink/40">{food.mealType}</span>
                    <div className="flex space-x-2 text-[8px] text-ink/30">
                      <span>P: {food.protein}g</span>
                      <span>C: {food.carbs}g</span>
                      <span>F: {food.fats}g</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm font-serif font-bold">{food.calories} <span className="text-[8px] font-sans text-ink/40">kcal</span></span>
                {isAdmin && (
                  <Button 
                    onClick={() => deleteFood(food.id)}
                    variant="ghost"
                    size="sm"
                    magnetic={true}
                    className="text-red-500/0 group-hover:text-red-500/40 hover:text-red-500"
                    icon={Trash2}
                  />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Food Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface w-full max-w-md rounded-3xl p-8 shadow-2xl border border-ink/10"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-serif">Add Food</h3>
                <Button 
                  onClick={() => setIsAdding(false)} 
                  variant="ghost"
                  size="sm"
                  magnetic={true}
                  className="hover:bg-ink/5"
                  icon={X}
                />
              </div>

              <form onSubmit={handleAddFood} className="space-y-6">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-ink/40 block mb-2">Food Name</label>
                  <input 
                    type="text"
                    required
                    value={newFood.name}
                    onChange={e => setNewFood({...newFood, name: e.target.value})}
                    className="w-full bg-ink/5 border-none rounded-2xl p-4 focus:ring-2 focus:ring-accent transition-all"
                    placeholder="e.g. Chicken Salad"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink/40 block mb-2">
                      {newFood.isFromBarcode ? 'Amount (grams)' : 'Calories'}
                    </label>
                    <div className="relative">
                      <input 
                        type="number"
                        required
                        value={newFood.isFromBarcode ? newFood.amountGrams : newFood.calories}
                        onChange={e => newFood.isFromBarcode ? handleWeightChange(e.target.value) : setNewFood({...newFood, calories: e.target.value})}
                        className="w-full bg-ink/5 border-none rounded-2xl p-4 focus:ring-2 focus:ring-accent transition-all pr-12"
                        placeholder="0"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-ink/20">
                        {newFood.isFromBarcode ? 'g' : 'kcal'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink/40 block mb-2">Meal Type</label>
                    <select 
                      value={newFood.mealType}
                      onChange={e => setNewFood({...newFood, mealType: e.target.value})}
                      className="w-full bg-ink/5 border-none rounded-2xl p-4 focus:ring-2 focus:ring-accent transition-all appearance-none"
                    >
                      {["Breakfast", "Lunch", "Dinner", "Snack"].map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {newFood.isFromBarcode && (
                  <div className="p-4 bg-accent/5 border border-accent/10 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-accent">Calculated Calories</span>
                      <span className="text-lg font-serif text-accent">{newFood.calories} kcal</span>
                    </div>
                    <p className="text-[8px] text-ink/40 italic">Based on {newFood.per100g.calories} kcal per 100g</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink/40 block mb-2">Protein (g)</label>
                    <input 
                      type="number"
                      value={newFood.protein}
                      onChange={e => setNewFood({...newFood, protein: e.target.value})}
                      className="w-full bg-ink/5 border-none rounded-2xl p-4 focus:ring-2 focus:ring-accent transition-all"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink/40 block mb-2">Carbs (g)</label>
                    <input 
                      type="number"
                      value={newFood.carbs}
                      onChange={e => setNewFood({...newFood, carbs: e.target.value})}
                      className="w-full bg-ink/5 border-none rounded-2xl p-4 focus:ring-2 focus:ring-accent transition-all"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink/40 block mb-2">Fats (g)</label>
                    <input 
                      type="number"
                      value={newFood.fats}
                      onChange={e => setNewFood({...newFood, fats: e.target.value})}
                      className="w-full bg-ink/5 border-none rounded-2xl p-4 focus:ring-2 focus:ring-accent transition-all"
                      placeholder="0"
                    />
                  </div>
                </div>

                <Button 
                  type="submit"
                  magnetic={true}
                  className="w-full bg-accent text-paper py-4 shadow-lg shadow-accent/20"
                >
                  Log Food
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Barcode Scanner Modal */}
      <AnimatePresence>
        {isScanningBarcode && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink/90 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative"
            >
              <div className="p-6 border-b border-ink/5 flex justify-between items-center bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
                <div>
                  <h3 className="text-xl font-serif">Scan Barcode</h3>
                  <p className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Point at product barcode</p>
                </div>
                <Button 
                  onClick={() => setIsScanningBarcode(false)}
                  variant="ghost"
                  size="sm"
                  magnetic={true}
                  className="hover:bg-ink/5"
                  icon={X}
                />
              </div>
              
              <div className="aspect-square bg-black relative">
                <div id="barcode-reader" className="w-full h-full" />
                <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40">
                  <div className="w-full h-full border-2 border-accent/50 rounded-lg relative">
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-accent/50 animate-pulse" />
                  </div>
                </div>
              </div>

              <div className="p-8 text-center bg-surface">
                <p className="text-xs text-ink/40 leading-relaxed">
                  Scanning for barcodes... Make sure the barcode is well-lit and centered in the frame.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Error Toast */}
      <AnimatePresence>
        {scanError && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full shadow-xl flex items-center space-x-3 z-[100]"
          >
            <AlertCircle size={18} />
            <span className="text-xs font-bold">{scanError}</span>
            <Button 
              onClick={() => setScanError(null)} 
              variant="ghost"
              size="sm"
              magnetic={true}
              className="hover:bg-white/20 text-white"
              icon={X}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
