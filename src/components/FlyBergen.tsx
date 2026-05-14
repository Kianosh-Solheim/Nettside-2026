import React, { useState, useEffect, useRef, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, Clock, Info, RefreshCw, Search, Sun, Moon, User, Lock, X, Check, Globe } from 'lucide-react';
import { ThemeContext } from '../contexts/ThemeContext';
import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, doc, setDoc, onSnapshot, collection, serverTimestamp, OperationType, handleFirestoreError } from '../firebase';

interface Flight {
  uniqueId: string;
  flightId: string;
  dom_int: string;
  schedule_time: string;
  arr_dep: 'A' | 'D';
  airport: string;
  airline: string;
  gate?: string;
  status?: {
    code: string;
    time?: string;
  };
}

interface AirportName {
  code: string;
  name: string;
}

interface AirlineName {
  code: string;
  name: string;
}

const FLY_BERGEN_AIRPORT = 'BGO';

import { useSearchParams } from 'react-router-dom';

export default function FlyBergen() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const [searchParams] = useSearchParams();
  const [direction, setDirection] = useState<'D' | 'A'>((searchParams.get('direction') as 'D' | 'A') || 'D');
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [airportNames, setAirportNames] = useState<Record<string, string>>({});
  const [airlineNames, setAirlineNames] = useState<Record<string, string>>({});
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Admin & Custom Logos State
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [customLogos, setCustomLogos] = useState<Record<string, string>>({});
  const [editingAirline, setEditingAirline] = useState<{code: string, name: string} | null>(null);
  const [newLogoData, setNewLogoData] = useState('');
  const [savingLogo, setSavingLogo] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      // Hardcoded admin for now as per user request context
      const isAdminEmail = u?.email === 'kianoshsolheim@gmail.com' || u?.email === 'kianosh@solheim.online';
      setIsAdmin(!!u && isAdminEmail);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Custom Logos from Firestore
  useEffect(() => {
    const path = 'airline_logos';
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const logos: Record<string, string> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.airlineCode && data.logoData) {
          logos[data.airlineCode] = data.logoData;
        }
      });
      setCustomLogos(logos);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path, true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const saveLogo = async () => {
    if (!editingAirline || !newLogoData.trim()) return;
    setSavingLogo(true);
    const path = `airline_logos/${editingAirline.code}`;
    try {
      await setDoc(doc(db, 'airline_logos', editingAirline.code), {
        airlineCode: editingAirline.code,
        logoData: newLogoData.trim(),
        updatedAt: serverTimestamp()
      });
      setEditingAirline(null);
      setNewLogoData('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setSavingLogo(false);
    }
  };

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch names and status maps on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [airportsRes, airlinesRes] = await Promise.all([
          fetch('/api/flights/airports'),
          fetch('/api/flights/airlines')
        ]);

        const parser = new DOMParser();

        if (airportsRes.ok) {
          const xmlText = await airportsRes.text();
          const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
          const airportNodes = xmlDoc.getElementsByTagName('airportName');
          const names: Record<string, string> = {};
          for (let i = 0; i < airportNodes.length; i++) {
            const code = airportNodes[i].getAttribute('code');
            const name = airportNodes[i].getAttribute('name');
            if (code && name) names[code] = name;
          }
          setAirportNames(prev => ({ ...prev, ...names }));
        }

        if (airlinesRes.ok) {
          const xmlText = await airlinesRes.text();
          const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
          const airlineNodes = xmlDoc.getElementsByTagName('airlineName');
          const names: Record<string, string> = {};
          for (let i = 0; i < airlineNodes.length; i++) {
            const code = airlineNodes[i].getAttribute('code');
            const name = airlineNodes[i].getAttribute('name');
            if (code && name) names[code] = name;
          }
          setAirlineNames(prev => ({ ...prev, ...names }));
        }
      } catch (err) {
        console.error('Meta fetch error:', err);
        // Fallback names
        const commonAirports: Record<string, string> = {
          'OSL': 'Oslo', 'SVG': 'Stavanger', 'TRD': 'Trondheim', 'KRS': 'Kristiansand',
          'TOS': 'Tromsø', 'AES': 'Ålesund', 'BOO': 'Bodø', 'MOL': 'Molde',
          'AMS': 'Amsterdam', 'CPH': 'København', 'FRA': 'Frankfurt', 'LHR': 'London Heathrow',
          'LGW': 'London Gatwick', 'HEL': 'Helsinki', 'CDG': 'Paris', 'BLL': 'Billund',
          'GDN': 'Gdansk', 'KEF': 'Reykjavik', 'ALC': 'Alicante', 'AGP': 'Malaga',
          'LPA': 'Gran Canaria', 'TFS': 'Tenerife', 'BGO': 'Bergen'
        };
        const commonAirlines: Record<string, string> = {
          'SK': 'SAS', 'DY': 'Norwegian', 'WF': 'Widerøe', 'KL': 'KLM', 
          'LH': 'Lufthansa', 'AF': 'Air France', 'AY': 'Finnair', 'BA': 'British Airways',
          'LX': 'Swiss', 'D8': 'Norwegian Air', 'W6': 'Wizz Air', 'FR': 'Ryanair'
        };
        setAirportNames(commonAirports);
        setAirlineNames(commonAirlines);
      }
    };
    fetchMetadata();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/flights?airport=BGO&direction=${direction}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Kunne ikke hente flydata fra serveren');
      
      const text = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');
      
      const flightNodes = xmlDoc.getElementsByTagName('flight');
      const fetchedFlights: Flight[] = [];
      for (let i = 0; i < flightNodes.length; i++) {
        const node = flightNodes[i];
        const statusNode = node.getElementsByTagName('status')[0];
        
        fetchedFlights.push({
          uniqueId: node.getAttribute('uniqueId') || String(Math.random()),
          flightId: node.getElementsByTagName('flight_id')[0]?.textContent || '',
          dom_int: node.getElementsByTagName('dom_int')[0]?.textContent || '',
          schedule_time: node.getElementsByTagName('schedule_time')[0]?.textContent || '',
          arr_dep: node.getElementsByTagName('arr_dep')[0]?.textContent as 'A' | 'D' || 'D',
          airport: node.getElementsByTagName('airport')[0]?.textContent || '',
          airline: node.getElementsByTagName('airline')[0]?.textContent || '',
          gate: node.getElementsByTagName('gate')[0]?.textContent || undefined,
          status: statusNode ? {
            code: statusNode.getAttribute('code') || '',
            time: statusNode.getAttribute('time') || undefined
          } : undefined
        });
      }

      fetchedFlights.sort((a, b) => new Date(a.schedule_time).getTime() - new Date(b.schedule_time).getTime());
      setFlights(fetchedFlights);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError('Det oppstod en feil ved henting av data. Dette kan skyldes begrensninger i nettleseren for direkte henting.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300000); // 5 minutes as requested
    return () => clearInterval(interval);
  }, [direction]);


  const formatTime = (isoString: string) => {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
  };

  const getAirlineLogo = (code: string) => {
    // Check custom logos first
    if (customLogos[code]) return customLogos[code];

    // SAS Logo provided by user
    const sasLogo = "data:image/svg+xml,%3Csvg%20width='100'%20height='100'%20viewBox='0%200%20100%20100'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3E%3Crect%20width='100'%20height='100'%20fill='%232B3087'/%3E%3Cpath%20d='M62.4314%2036.295H54.5214C54.1164%2036.295%2053.9134%2036.492%2053.9134%2036.492L32.1144%2062.762C32.0124%2062.959%2032.0124%2063.056%2032.2164%2063.056H35.4604C35.7644%2063.056%2035.8664%2062.958%2035.8664%2062.859L40.5314%2057.075C40.5314%2057.075%2040.6324%2056.978%2040.7334%2056.978H48.5404C48.5404%2056.978%2048.6424%2056.978%2048.6424%2057.076C48.6424%2057.174%2047.5274%2062.762%2047.5274%2062.762C47.5274%2062.86%2047.5274%2063.056%2047.8314%2063.056H57.2614C57.3634%2063.056%2057.4644%2063.056%2057.4644%2062.859L62.7364%2036.588C62.6344%2036.588%2062.7364%2036.293%2062.4314%2036.293V36.295ZM49.0464%2054.332H42.9624H42.8614V54.234L50.9724%2044.139L51.0744%2044.041C51.1754%2044.041%2051.0744%2044.139%2051.0744%2044.139L49.0464%2054.334C49.1484%2054.236%2049.1484%2054.236%2049.0464%2054.334V54.332ZM11.0244%2059.724C11.0244%2059.724%2011.7354%2057.372%2011.8354%2057.469C11.8354%2057.078%2012.0384%2056.979%2012.2414%2057.175C13.1544%2058.057%2015.9934%2060.705%2019.9474%2060.705C24.3064%2060.705%2024.0024%2057.274%2024.0024%2056.784C24.0024%2055.412%2022.1764%2048.647%2021.6704%2046.883C20.2514%2041.197%2023.8004%2036.001%2032.2154%2036.001C36.6764%2036.001%2038.9074%2037.178%2039.7184%2037.569C40.2254%2037.864%2040.1234%2038.256%2040.1234%2038.256C40.1234%2038.256%2039.6174%2040.315%2039.6174%2040.511C39.5154%2040.708%2039.3134%2040.708%2039.1114%2040.511C37.7924%2039.727%2036.2714%2038.845%2033.9394%2038.845C31.2024%2038.845%2029.7824%2040.805%2030.4934%2043.648C30.7974%2044.629%2032.5204%2051.393%2032.8244%2052.765C34.0414%2057.667%2030.5934%2063.548%2021.2674%2063.548C16.0954%2063.548%2012.8514%2061.686%2011.7364%2060.804C11.1264%2060.312%2010.9244%2060.018%2011.0244%2059.724ZM60.6054%2059.822C60.6054%2059.822%2061.1124%2057.274%2061.1124%2057.469C61.2144%2057.175%2061.5174%2057.078%2061.7204%2057.273C62.7354%2058.155%2065.3704%2060.704%2069.3254%2060.704C73.6844%2060.704%2073.3824%2057.273%2073.3824%2056.783C73.3824%2055.411%2071.5564%2048.646%2071.0494%2046.882C69.6304%2041.196%2073.1804%2036%2081.5944%2036C86.0554%2036%2088.2864%2037.177%2089.0974%2037.568C89.6044%2037.863%2089.5034%2038.255%2089.5034%2038.255C89.5034%2038.255%2088.9964%2040.314%2088.9964%2040.51C88.8954%2040.707%2088.6924%2040.707%2088.4904%2040.51C87.1714%2039.726%2085.6504%2038.844%2083.3184%2038.844C80.5814%2038.844%2079.1624%2040.804%2079.8724%2043.647C80.1764%2044.628%2081.8994%2051.392%2082.2044%2052.764C83.4204%2057.666%2079.9734%2063.547%2070.6444%2063.547C65.4734%2063.547%2062.4324%2061.782%2061.3174%2060.901C60.7074%2060.41%2060.5044%2060.116%2060.6054%2059.822Z'%20fill='white'/%3E%3C/svg%3E";
    
    if (code === 'SK') return sasLogo;
    if (code === 'KL') return "data:image/svg+xml,%3Csvg%20width='100'%20height='100'%20viewBox='0%200%20100%20100'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3E%3Crect%20width='100'%20height='100'%20fill='%2300A1DE'/%3E%3Cpath%20d='M48.388%2035.67H50.613V33.446H52.838V31.224H50.613V29H48.388V31.224H46.163V33.446H48.388V35.67ZM62.783%2035.114C60.637%2035.109%2058.894%2036.844%2058.888%2038.99C58.888%2038.995%2058.888%2039%2058.888%2039.004C58.885%2041.15%2060.622%2042.892%2062.768%2042.895C62.773%2042.895%2062.778%2042.895%2062.782%2042.895C64.928%2042.899%2066.671%2041.163%2066.675%2039.018C66.675%2039.014%2066.675%2039.009%2066.675%2039.005C66.678%2036.859%2064.941%2035.117%2062.795%2035.114C62.792%2035.114%2062.787%2035.114%2062.783%2035.114ZM36.184%2048.453H62.783V44.007H36.184V48.453ZM40.077%2039.005C40.077%2036.851%2038.339%2035.114%2036.218%2035.114C34.072%2035.109%2032.329%2036.844%2032.323%2038.99C32.323%2038.995%2032.323%2039%2032.323%2039.004C32.32%2041.15%2034.057%2042.892%2036.203%2042.895C36.208%2042.895%2036.213%2042.895%2036.217%2042.895C38.34%2042.896%2040.077%2041.158%2040.077%2039.005ZM50.056%2039.005C50.053%2041.151%2051.79%2042.893%2053.936%2042.896C53.941%2042.896%2053.946%2042.896%2053.95%2042.896C56.105%2042.896%2057.809%2041.158%2057.809%2039.005C57.809%2036.851%2056.071%2035.114%2053.95%2035.114C51.804%2035.109%2050.061%2036.844%2050.055%2038.99C50.056%2038.995%2050.056%2039%2050.056%2039.005ZM45.05%2042.896C47.196%2042.888%2048.934%2041.151%2048.943%2039.005C48.946%2036.859%2047.209%2035.117%2045.063%2035.114C45.059%2035.114%2045.054%2035.114%2045.05%2035.114C42.904%2035.109%2041.161%2036.844%2041.155%2038.99C41.155%2038.995%2041.155%2039%2041.155%2039.004C41.19%2041.159%2042.895%2042.896%2045.05%2042.896ZM73.874%2052.899L70.536%2062.904L67.198%2052.899H56.106V70.65H62.747V57.311L67.197%2070.616H73.838L78.254%2057.311V70.616H84.895V52.864H73.874V52.899ZM42.825%2052.899H36.184V70.65H53.916V66.17H42.824V52.9L42.825%2052.899ZM33.959%2052.899H27.318L20.641%2059.569V52.899H14V70.65H20.641V63.981L27.318%2070.65H36.184L26.205%2060.646L33.959%2052.899Z'%20fill='white'/%3E%3C/svg%3E";
    if (code === 'LH') return `https://www.lufthansa.com/favicon.ico`;
    
    return `https://www.google.com/s2/favicons?domain=avinor.no&sz=64`;
  };

  const getStatusDisplay = (flight: Flight) => {
    const code = flight.status?.code;
    const time = flight.status?.time;
    const schTime = new Date(flight.schedule_time);
    const now = new Date();
    const diffMs = (time ? new Date(time).getTime() : schTime.getTime()) - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (code === 'C') return <span className="text-[#ff4444] font-black uppercase tracking-tight">Innstilt</span>;
    if (code === 'D') return <span className={`${isDark ? 'text-white/30' : 'text-slate-400'} font-bold uppercase tracking-tight`}>Avreist</span>;
    if (code === 'B') return <span className="text-[#00ffaa] animate-pulse font-black uppercase tracking-tight">Boarding</span>;

    if (diffMins <= 0) return <span className="text-[#00ffaa] font-black text-xl uppercase tracking-tighter">NÅ</span>;
    if (diffMins < 15) return <span className={`${isDark ? 'text-white' : 'text-slate-900'} font-black text-xl tracking-tighter`}>{diffMins} min</span>;

    const displayTime = time ? new Date(time) : schTime;
    return (
      <div className="flex flex-col items-end">
        <span className={`${time ? 'text-[#ff4444]' : (isDark ? 'text-white' : 'text-slate-900')} font-mono font-bold text-xl tracking-tighter leading-none`}>
          {displayTime.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
        </span>
        {time && (
          <span className={`text-[10px] ${isDark ? 'text-white/30' : 'text-slate-400'} font-mono line-through leading-none mt-1`}>
            {schTime.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    );
  };

  const filteredFlights = flights.filter(f => 
    f.flightId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.airport.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (airportNames[f.airport] || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#1c1c1e] text-white' : 'bg-slate-50 text-slate-900'} font-sans antialiased selection:bg-purple-500/30`}>
      {/* Header - Skyss Style */}
      <div className={`${isDark ? 'bg-[#1c1c1e]' : 'bg-white'} border-b ${isDark ? 'border-white/5' : 'border-slate-200'} pt-12 pb-6 px-10 transition-colors duration-300`}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between mb-8">
            <h1 className={`text-5xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'} capitalize`}>
              Bergen Lufthavn
            </h1>
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button 
                    onClick={handleLogout}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isDark ? 'bg-white/5 text-white/50 hover:bg-white/10' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'} transition-colors`}
                  >
                    <Lock size={12} />
                    Logg ut
                  </button>
                )}
                {!user && (
                  <button 
                    onClick={handleLogin}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isDark ? 'bg-white/5 text-white/50 hover:bg-white/10' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'} transition-colors`}
                  >
                    <User size={12} />
                    Admin
                  </button>
                )}
                <button 
                  onClick={toggleTheme}
                  className={`p-2 rounded-full ${isDark ? 'bg-white/5 hover:bg-white/10 text-yellow-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'} transition-colors`}
                  title={isDark ? 'Bytt til lyst tema' : 'Bytt til mørkt tema'}
                >
                  {isDark ? <Sun size={20} /> : <Moon size={20} />}
                </button>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className={`flex items-center gap-2 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                  <Clock size={14} className="opacity-50" />
                  <span className="text-xs font-black uppercase tracking-[0.3em] font-mono">
                    {currentTime.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`text-[10px] font-black ${isDark ? 'text-white/20' : 'text-slate-300'} uppercase tracking-[0.2em] mt-1 flex items-center gap-2`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  Sanntid aktiv
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-6">
            <div className={`flex ${isDark ? 'bg-[#2c2c2e]' : 'bg-slate-100'} p-1 rounded-xl border ${isDark ? 'border-white/5' : 'border-slate-200'} shadow-inner`}>
              <button
                onClick={() => setDirection('D')}
                className={`px-8 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                  direction === 'D' 
                    ? 'bg-[#c0a0ff] text-[#121212] shadow-lg' 
                    : `${isDark ? 'text-white/40 hover:text-white/60' : 'text-slate-400 hover:text-slate-600'}`
                }`}
              >
                Avganger
              </button>
              <button
                onClick={() => setDirection('A')}
                className={`px-8 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                  direction === 'A' 
                    ? 'bg-[#c0a0ff] text-[#121212] shadow-lg' 
                    : `${isDark ? 'text-white/40 hover:text-white/60' : 'text-slate-400 hover:text-slate-600'}`
                }`}
              >
                Ankomster
              </button>
            </div>

            <div className="flex items-center gap-4 flex-grow max-w-sm">
              <div className="relative flex-grow">
                <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-white/10' : 'text-slate-300'}`} size={16} />
                <input 
                  type="text"
                  placeholder="Søk flynummer eller destinasjon..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full ${isDark ? 'bg-[#2c2c2e] text-white border-white/5 placeholder:text-white/10' : 'bg-white text-slate-900 border-slate-200 placeholder:text-slate-300'} border rounded-xl py-3 pl-12 pr-4 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-[#c0a0ff]/40 transition-colors`}
                />
              </div>
              <button 
                onClick={fetchData}
                disabled={loading}
                className={`p-3 ${isDark ? 'bg-[#2c2c2e] hover:bg-white/5 border-white/5' : 'bg-white hover:bg-slate-50 border-slate-200'} border rounded-xl transition-colors disabled:opacity-50`}
              >
                <RefreshCw className={`${loading ? 'animate-spin' : ''} text-[#c0a0ff]`} size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-10 py-10">
        {error ? (
          <div className={`py-20 text-center ${isDark ? 'bg-red-500/5 border-red-500/10' : 'bg-red-50 border-red-100'} rounded-3xl border`}>
            <Info className="mx-auto text-red-500 mb-4" size={32} />
            <p className="text-red-400 font-bold uppercase tracking-widest text-sm mb-4">{error}</p>
            <button 
              onClick={fetchData}
              className="px-6 py-2 bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-colors"
            >
              Prøv igjen
            </button>
          </div>
        ) : (
          <div className="bg-transparent overflow-hidden">
            <div className={`grid grid-cols-12 gap-4 px-4 py-4 text-[10px] font-black uppercase tracking-[0.25em] ${isDark ? 'text-white/30 border-white/5' : 'text-slate-400 border-slate-200'} border-b`}>
              <div className="col-span-2 pl-4">Selskap</div>
              <div className="col-span-2">Flynummer</div>
              <div className="col-span-1">Gate</div>
              <div className="col-span-4">Destinasjon</div>
              <div className="col-span-3 text-right pr-4">Forventet</div>
            </div>

            <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
              <AnimatePresence mode="popLayout">
                {loading && flights.length === 0 ? (
                  <div className="py-32 flex flex-col items-center">
                    <div className={`w-8 h-8 border-2 ${isDark ? 'border-white/10 border-t-[#c0a0ff]' : 'border-slate-200 border-t-[#c0a0ff]'} rounded-full animate-spin mb-4`} />
                    <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${isDark ? 'text-white/10' : 'text-slate-300'}`}>Laster tavla...</span>
                  </div>
                ) : filteredFlights.length > 0 ? (
                  filteredFlights.map((flight) => {
                    const isSAS = flight.airline === 'SK';
                    const isNorwegian = flight.airline === 'DY' || flight.airline === 'D8';
                    const isWideroe = flight.airline === 'WF';
                    
                    return (
                      <motion.div
                        key={flight.uniqueId}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`grid grid-cols-12 gap-4 px-4 py-5 items-center ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'} transition-colors group`}
                      >
                        {/* Airline Column */}
                        <div className="col-span-2 flex items-center pl-4 gap-3">
                          <div 
                            onClick={() => {
                              if (isAdmin) {
                                setEditingAirline({ code: flight.airline, name: airlineNames[flight.airline] || flight.airline });
                                setNewLogoData(customLogos[flight.airline] || '');
                              }
                            }}
                            className={`w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'} flex items-center justify-center p-1.5 shadow-sm ${isAdmin ? 'cursor-pointer ring-2 ring-transparent hover:ring-[#c0a0ff] transition-all' : ''}`}
                          >
                            <img 
                              src={getAirlineLogo(flight.airline)} 
                              alt={flight.airline}
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://www.google.com/s2/favicons?domain=avinor.no&sz=64`;
                              }}
                            />
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-tighter ${isDark ? 'text-white/40' : 'text-slate-400'} truncate hidden md:block`}>
                            {airlineNames[flight.airline] || flight.airline}
                          </span>
                        </div>

                        {/* Flight Number Column */}
                        <div className="col-span-2 flex items-center">
                          <span className={`font-mono font-black text-base tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {flight.flightId}
                          </span>
                        </div>

                        {/* Gate Column */}
                        <div className="col-span-1 flex items-center">
                          {flight.gate ? (
                            <span className="text-base font-mono font-black text-[#c0a0ff]">{flight.gate}</span>
                          ) : (
                            <span className="text-[10px] font-black text-white/10 uppercase tracking-widest">—</span>
                          )}
                        </div>

                        {/* Destination Column */}
                        <div className="col-span-4 flex flex-col">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} tracking-tight group-hover:translate-x-1 transition-transform`}>
                              {airportNames[flight.airport] || flight.airport}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-black ${isDark ? 'text-white/20' : 'text-slate-400'} uppercase tracking-[0.2em] ml-0.5`}>
                              {airlineNames[flight.airline] || flight.airline}
                            </span>
                          </div>
                        </div>

                        {/* Expected Time Column */}
                        <div className="col-span-3 flex justify-end pr-4">
                          {getStatusDisplay(flight)}
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="py-32 text-center">
                    <span className={`text-[10px] font-black uppercase tracking-[0.25em] ${isDark ? 'text-white/10' : 'text-slate-300'}`}>Ingen fly funnet</span>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Logo Editor Modal */}
      <AnimatePresence>
        {editingAirline && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-24">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingAirline(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-lg ${isDark ? 'bg-[#2c2c2e] border-white/10' : 'bg-white border-slate-200'} border rounded-3xl shadow-2xl p-8 overflow-hidden`}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                    <Globe className="text-[#c0a0ff]" size={20} />
                  </div>
                  <div>
                    <h2 className="font-black uppercase tracking-widest text-sm">Oppdater Logo</h2>
                    <p className={`text-[10px] font-bold ${isDark ? 'text-white/30' : 'text-slate-400'} uppercase tracking-widest`}>
                      {editingAirline.name} ({editingAirline.code})
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingAirline(null)}
                  className={`p-2 rounded-full ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200'} transition-colors`}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                    Logo Bilde Data (URL eller Base64)
                  </label>
                  <textarea 
                    value={newLogoData}
                    onChange={(e) => setNewLogoData(e.target.value)}
                    placeholder="Lim inn data:image/svg+xml,... eller en URL"
                    className={`w-full h-48 ${isDark ? 'bg-[#1c1c1e] border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl p-4 text-xs font-mono focus:outline-none focus:border-[#c0a0ff]/40 transition-colors resize-none`}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={saveLogo}
                    disabled={savingLogo || !newLogoData.trim()}
                    className="flex-grow bg-[#c0a0ff] disabled:opacity-50 text-[#121212] font-black uppercase tracking-widest text-[10px] h-12 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                  >
                    {savingLogo ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    Lagre Logo
                  </button>
                  <button 
                    onClick={() => setEditingAirline(null)}
                    className={`px-6 h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] ${isDark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'} transition-all`}
                  >
                    Avbryt
                  </button>
                </div>
              </div>

              {/* Preview */}
              {newLogoData.trim() && (
                <div className="mt-6 pt-6 border-t border-white/5">
                  <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-white/40' : 'text-slate-400'} mb-3`}>
                    Forhåndsvisning
                  </p>
                  <div className={`w-16 h-16 rounded-xl border ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'} flex items-center justify-center p-3 mx-auto`}>
                    <img 
                      src={newLogoData} 
                      alt="Preview" 
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://www.google.com/s2/favicons?domain=avinor.no&sz=64`;
                      }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
