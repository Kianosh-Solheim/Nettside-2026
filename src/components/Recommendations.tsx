import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, Film, Tv, ExternalLink, AppWindow, Video, Plus, Search, X, Check, Loader2, Edit2, Trash2, Save, Info } from 'lucide-react';
import { db, collection, onSnapshot, query, orderBy, handleFirestoreError, OperationType, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, auth, where } from '../firebase';
import Button from './ui/Button';

interface Recommendation {
  id: string;
  title: string;
  author: string;
  category: string;
  description?: string;
  link?: string;
  imageUrl?: string;
}

export default function Recommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Recommendation | null>(null);
  const [isSearchingMovies, setIsSearchingMovies] = useState(false);
  const [isSearchingBooks, setIsSearchingBooks] = useState(false);
  const [movieSearchResults, setMovieSearchResults] = useState<any[]>([]);
  const [bookSearchResults, setBookSearchResults] = useState<any[]>([]);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Recommendation>>({
    title: '',
    author: '',
    category: 'Books',
    description: '',
    link: '',
    imageUrl: ''
  });

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      setIsAdmin(user?.email === 'kianoshsolheim@gmail.com' || user?.email === 'kianosh@solheim.online');
    });

    const q = query(collection(db, 'recommendations'), orderBy('createdAt', 'desc'));
    
    const unsubscribeRecs = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const docData = doc.data();
        let cat = docData.category;
        if (cat === 'Movies & Shows') cat = 'Movies';
        
        return {
          ...docData,
          category: cat,
          id: doc.id
        };
      }) as Recommendation[];
      setRecommendations(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'recommendations');
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeRecs();
    };
  }, []);

  const handleSearchMovies = async () => {
    if (!formData.title) return;
    setIsSearchingMovies(true);
    try {
      const omdbKey = import.meta.env.VITE_OMDB_API_KEY;
      let actualKey = omdbKey || 'b054da29';
      if (actualKey.includes('apikey=')) {
        actualKey = actualKey.split('apikey=')[1].split('&')[0];
      }
      const type = formData.category === 'Shows' ? 'series' : 'movie';
      let response = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(formData.title)}&type=${type}&apikey=${actualKey}`);
      if (!response.ok && response.status === 401 && actualKey !== 'b054da29') {
        // Fallback to default key if user's key is invalid
        response = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(formData.title)}&type=${type}&apikey=b054da29`);
      }
      if (!response.ok) throw new Error(`Movies API failed: ${response.status} ${response.statusText}`);
      const data = await response.json();
      if (data.Response === 'False') {
        setMovieSearchResults([]);
      } else {
        setMovieSearchResults(data.Search || []);
      }
    } catch (error) {
      console.error("Error searching movies:", error);
      setStatus({ type: 'error', message: 'Movies search failed' });
    } finally {
      setIsSearchingMovies(false);
    }
  };

  const handleSearchBooks = async () => {
    if (!formData.title) return;
    setIsSearchingBooks(true);
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_YOUTUBE_API_KEY;
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(formData.title)}&maxResults=12${apiKey ? `&key=${apiKey}` : ''}`);
      if (!response.ok) throw new Error(`Books API failed: ${response.statusText}`);
      const data = await response.json();
      setBookSearchResults(data.items || []);
    } catch (error) {
      console.error("Error searching books:", error);
      setStatus({ type: 'error', message: 'Books search failed' });
    } finally {
      setIsSearchingBooks(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSave = { ...formData };
      if (dataToSave.description === undefined) dataToSave.description = '';
      if (dataToSave.link === undefined) dataToSave.link = '';
      if (dataToSave.imageUrl === undefined) dataToSave.imageUrl = '';
      delete dataToSave.id;

      if (editingId) {
        await updateDoc(doc(db, 'recommendations', editingId), {
          ...dataToSave,
          updatedAt: serverTimestamp()
        });
        setStatus({ type: 'success', message: 'Updated successfully' });
      } else {
        await addDoc(collection(db, 'recommendations'), {
          ...dataToSave,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setStatus({ type: 'success', message: 'Added successfully' });
      }
      resetForm();
      setTimeout(() => setStatus(null), 3000);
    } catch (error: any) {
      console.error("Error saving recommendation:", error);
      setStatus({ type: 'error', message: `Failed to save: ${error.message}` });
    }
  };

  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    console.log('[Recommendations] Starting handleDelete for ID:', id);
    try {
      setStatus({ type: 'success', message: 'Initiating deletion...' });
      await deleteDoc(doc(db, 'recommendations', id));
      console.log('[Recommendations] deleteDoc resolved successfully for:', id);
      setStatus({ type: 'success', message: 'Deleted successfully' });
      setDeleteConfirmation(null);
      
      // Quick verification log
      setTimeout(() => {
        setRecommendations(prev => {
          const stillExists = prev.some(r => r.id === id);
          if (stillExists) {
            console.warn('[Recommendations] Warning: Item still in local state after successful deleteDoc for ID:', id);
          } else {
            console.log('[Recommendations] Item confirmed gone from local state for ID:', id);
          }
          return prev;
        });
        setStatus(null);
      }, 2000);
    } catch (error) {
      console.error('[Recommendations] Delete failed:', error);
      setStatus({ type: 'error', message: 'Failed to delete' });
      setDeleteConfirmation(null);
    }
  };

  const resetForm = () => {
    setFormData({ title: '', author: '', category: 'Books', description: '', link: '', imageUrl: '' });
    setIsAdding(false);
    setEditingId(null);
    setMovieSearchResults([]);
    setBookSearchResults([]);
  };

  const startEdit = (rec: Recommendation, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData({
      title: rec.title,
      author: rec.author,
      category: rec.category as any,
      description: rec.description || '',
      link: rec.link || '',
      imageUrl: rec.imageUrl || ''
    });
    setEditingId(rec.id);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getCategoryIcon = (catName: string) => {
    switch (catName) {
      case 'Books': return <Book size={20} />;
      case 'Movies': return <Film size={20} />;
      case 'Shows': return <Tv size={20} />;
      case 'Video & Media': return <Video size={20} />;
      case 'Apps': return <AppWindow size={20} />;
      default: return <Book size={20} />;
    }
  };

  if (loading) {
    return (
      <div key="loader-container" className="max-w-7xl mx-auto px-4 py-40 flex flex-col items-center justify-center">
        <motion.div
           key="library-loader-icon"
           animate={{ 
             scale: [0.8, 1, 0.8],
             opacity: [0.5, 1, 0.5]
           }}
           transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
           className="w-16 h-16 relative flex items-center justify-center mb-8"
        >
          <div className="absolute inset-0 border-2 border-accent/10 rounded-2xl" />
          <div className="absolute inset-2 border-2 border-accent/20 rounded-full" />
          <div className="w-2 h-2 bg-accent rounded-full animate-ping" />
        </motion.div>
        <p className="text-[10px] uppercase tracking-[0.5em] text-accent/40 font-black animate-pulse">
           Curating Library
        </p>
      </div>
    );
  }

  const filteredRecommendations = recommendations.filter(rec => {
    const matchesCategory = selectedCategory ? (selectedCategory === 'All' ? true : rec.category === selectedCategory) : true;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      rec.title.toLowerCase().includes(searchLower) || 
      rec.author.toLowerCase().includes(searchLower) ||
      (rec.description && rec.description.toLowerCase().includes(searchLower));
    
    return matchesCategory && matchesSearch;
  });

  const groupedRecommendations = filteredRecommendations.reduce((acc, rec) => {
    if (!acc[rec.category]) acc[rec.category] = [];
    acc[rec.category].push(rec);
    return acc;
  }, {} as Record<string, Recommendation[]>);

  return (
    <div key="library-content" className="max-w-7xl mx-auto px-4 py-20 h-full">
      <div className="mb-16 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="max-w-2xl">
          <h1 style={{ transform: 'none' }} className="text-5xl md:text-7xl font-serif mb-6 leading-tight">My Library</h1>
        </div>
        {isAdmin && (
          <Button
            onClick={() => isAdding ? resetForm() : setIsAdding(true)}
            variant={isAdding ? "ghost" : "primary"}
            size="lg"
            magnetic={true}
            icon={isAdding ? X : Plus}
            className="rounded-full px-8 shadow-xl shadow-accent/10"
          >
            {isAdding ? 'Close Editor' : 'Add Entry'}
          </Button>
        )}
      </div>

      <div className="mb-16 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="relative w-full md:w-96 shrink-0">
          <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-ink/30" size={20} />
          <input
            type="text"
            placeholder="Search titles, authors, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-surface border border-ink/10 rounded-full text-sm focus:outline-none focus:border-accent transition-all ring-1 ring-ink/5 focus:ring-accent/10"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto custom-scrollbar pb-4 md:pb-0 -ml-4 pl-4 md:ml-0 md:pl-0 pr-4 md:pr-0">
          {['All', 'Books', 'Movies', 'Shows', 'Video & Media', 'Apps'].map((cat) => {
            const isActive = selectedCategory === cat || (cat === 'All' && !selectedCategory);
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
                className={`flex-shrink-0 px-6 py-3 rounded-full text-[10px] font-black tracking-widest uppercase transition-all duration-300 whitespace-nowrap ${
                  isActive
                    ? 'bg-accent text-white shadow-lg shadow-accent/20 scale-100' 
                    : 'bg-surface border border-ink/5 text-ink/50 hover:bg-ink/5 hover:text-ink scale-[0.98]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-20 overflow-hidden"
          >
            <div className="p-10 bg-surface border border-ink/5 rounded-[48px] shadow-2xl space-y-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                  {editingId ? <Edit2 size={24} /> : <Plus size={24} />}
                </div>
                <h2 className="text-3xl font-serif">{editingId ? 'Edit Entry' : 'New Entry'}</h2>
              </div>
              
              {status && status.type === 'error' && (
                <div className="p-4 bg-accent/10 text-accent rounded-2xl text-sm font-medium">
                  {status.message}
                </div>
              )}
              {status && status.type === 'success' && (
                <div className="p-4 bg-green-500/10 text-green-600 rounded-2xl text-sm font-medium">
                  {status.message}
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">Title</label>
                    <div className="flex gap-2">
                      <input
                        required
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="flex-grow px-6 py-4 bg-paper border border-ink/5 rounded-2xl text-base focus:outline-none focus:border-accent transition-all ring-1 ring-ink/5 focus:ring-accent/10"
                        placeholder="e.g. Leviathan"
                      />
                      {(formData.category === 'Movies' || formData.category === 'Shows' || formData.category === 'Books') && (
                        <Button
                          type="button"
                          onClick={formData.category === 'Movies' || formData.category === 'Shows' ? handleSearchMovies : handleSearchBooks}
                          isLoading={formData.category === 'Movies' || formData.category === 'Shows' ? isSearchingMovies : isSearchingBooks}
                          variant="outline"
                          className="px-6 rounded-2xl border-accent/20 text-accent font-black text-[10px] tracking-widest uppercase hover:bg-accent/5"
                          icon={Search}
                        >
                          Find
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">Author / Creator</label>
                    <input
                      required
                      type="text"
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      className="w-full px-6 py-4 bg-paper border border-ink/5 rounded-2xl text-base focus:outline-none focus:border-accent transition-all ring-1 ring-ink/5 focus:ring-accent/10"
                      placeholder="e.g. Thomas Hobbes"
                    />
                  </div>
                </div>

                {(formData.category === 'Movies' || formData.category === 'Shows') && movieSearchResults.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 p-6 bg-accent/5 rounded-[32px] border border-accent/10">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-accent font-black">Quick Results</label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 max-h-80 overflow-y-auto p-2 custom-scrollbar">
                      {movieSearchResults.map((result, idx) => {
                        const posterUrl = result.Poster !== 'N/A' ? result.Poster : '';
                        const isSelected = formData.imageUrl === posterUrl;
                        if (!posterUrl) return null;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setFormData({ 
                              ...formData, 
                              imageUrl: posterUrl,
                              title: result.Title || formData.title,
                              author: result.Year || formData.author,
                              link: `https://www.imdb.com/title/${result.imdbID}`
                            })}
                            className={`relative aspect-[2/3] rounded-xl overflow-hidden border-2 transition-all ${
                              isSelected ? 'border-accent ring-4 ring-accent/20 scale-95 shadow-lg' : 'border-transparent hover:border-accent/40 grayscale hover:grayscale-0'
                            }`}
                          >
                            <img src={posterUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            {isSelected && <div className="absolute inset-0 bg-accent/20 flex items-center justify-center"><Check className="text-accent" size={24} /></div>}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {formData.category === 'Books' && bookSearchResults.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 p-6 bg-accent/5 rounded-[32px] border border-accent/10">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-accent font-black">Search Results</label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 max-h-80 overflow-y-auto p-2 custom-scrollbar">
                      {bookSearchResults.map((item, idx) => {
                        const volumeInfo = item.volumeInfo;
                        const posterUrl = volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || '';
                        const isSelected = formData.imageUrl === posterUrl;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setFormData({ 
                              ...formData, 
                              imageUrl: posterUrl,
                              title: volumeInfo.title || formData.title,
                              author: volumeInfo.authors?.join(', ') || formData.author,
                              link: volumeInfo.infoLink || formData.link
                            })}
                            className={`relative aspect-[2/3] rounded-xl overflow-hidden border-2 transition-all ${
                              isSelected ? 'border-accent ring-4 ring-accent/20 scale-95 shadow-lg' : 'border-transparent hover:border-accent/40 grayscale hover:grayscale-0'
                            }`}
                          >
                            {posterUrl ? (
                              <img src={posterUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full bg-ink/5 flex items-center justify-center text-[10px] font-black text-center p-2 uppercase tracking-tighter leading-none">
                                {volumeInfo.title}
                              </div>
                            )}
                            {isSelected && <div className="absolute inset-0 bg-accent/20 flex items-center justify-center"><Check className="text-accent" size={24} /></div>}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      className="w-full px-6 py-4 bg-paper border border-ink/5 rounded-2xl text-base focus:outline-none focus:border-accent transition-all appearance-none ring-1 ring-ink/5 focus:ring-accent/10 [color-scheme:dark]"
                    >
                      <option value="Books" className="bg-paper text-ink">Books</option>
                      <option value="Movies" className="bg-paper text-ink">Movies</option>
                      <option value="Shows" className="bg-paper text-ink">Shows</option>
                      <option value="Video & Media" className="bg-paper text-ink">Video & Media</option>
                      <option value="Apps" className="bg-paper text-ink">Apps</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">Image URL</label>
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="w-full px-6 py-4 bg-paper border border-ink/5 rounded-2xl text-base focus:outline-none focus:border-accent transition-all ring-1 ring-ink/5 focus:ring-accent/10"
                      placeholder="Custom thumbnail URL"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">Insight / Commentary</label>
                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-6 py-4 bg-paper border border-ink/5 rounded-2xl text-base focus:outline-none focus:border-accent transition-all resize-none ring-1 ring-ink/5 focus:ring-accent/10"
                    placeholder="Provide a brief summary or critical note..."
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">External Reference Link</label>
                  <input
                    type="url"
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                    className="w-full px-6 py-4 bg-paper border border-ink/5 rounded-2xl text-base focus:outline-none focus:border-accent transition-all ring-1 ring-ink/5 focus:ring-accent/10"
                    placeholder="https://..."
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="flex-grow py-5 rounded-3xl shadow-2xl shadow-accent/20 transition-transform active:scale-95"
                    icon={editingId ? Save : Plus}
                  >
                    {editingId ? 'Save Changes' : 'Initialize Entry'}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-24">
        {Object.keys(groupedRecommendations).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="text-ink/10 mb-4" size={48} />
            <h3 className="text-2xl font-serif mb-2">No recommendations found</h3>
            <p className="text-ink/40 text-sm">Try adjusting your search keywords or clearing your filters.</p>
            {(searchQuery || selectedCategory) && (
              <Button
                variant="ghost"
                className="mt-6 uppercase text-[10px] tracking-widest font-black"
                onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
              >
                Clear all filters
              </Button>
            )}
          </div>
        ) : (
          Object.entries(groupedRecommendations).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
            <section key={category} className="group/section">
            <div className="flex flex-col md:flex-row md:items-center gap-6 mb-12 border-b border-ink/5 pb-8">
              <div className="w-16 h-16 rounded-3xl bg-accent/10 flex items-center justify-center text-accent ring-1 ring-accent/5 shadow-inner">
                {getCategoryIcon(category)}
              </div>
              <div>
                <h2 className="text-4xl font-serif font-medium">{category}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <p className="text-[10px] uppercase tracking-[0.3em] font-black text-ink/30 italic">{items.length} works collected</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8 lg:gap-12">
              {items.map((item) => (
                <motion.div 
                  key={item.id}
                  layoutId={item.id}
                  onClick={() => setSelectedItem(item)}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -8 }}
                  className="group cursor-pointer"
                >
                  <div className={`relative mb-4 rounded-[24px] overflow-hidden bg-surface border border-ink/5 shadow-md shadow-ink/5 group-hover:shadow-2xl group-hover:shadow-accent/10 transition-all duration-500 ring-1 ring-ink/5 ${item.category === 'Apps' ? 'aspect-square' : 'aspect-auto'}`}>
                    {item.imageUrl ? (
                      <img 
                        src={item.imageUrl} 
                        alt={item.title} 
                        className={`w-full transition-all duration-700 ease-[0.22, 1, 0.36, 1] group-hover:scale-105 grayscale-[0.3] group-hover:grayscale-0 ${item.category === 'Apps' ? 'h-full object-cover' : 'h-auto'}`} 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="w-full aspect-[3/4] flex items-center justify-center p-6 text-center">
                        <Book className="text-ink/10" size={48} />
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-6">
                      <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white self-center transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                        <Info size={20} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="px-1 text-center">
                    <h3 className="text-sm font-serif group-hover:text-accent transition-colors leading-tight mb-1 truncate">{item.title}</h3>
                    <p className="text-[9px] uppercase tracking-widest text-ink/30 font-black">{item.author}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        ))
        )}
      </div>

      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 pointer-events-auto"
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-ink/95 backdrop-blur-xl"
              onClick={() => setSelectedItem(null)}
            />
            
            <motion.div
              layoutId={selectedItem.id}
              className="relative w-full max-w-5xl bg-surface rounded-[40px] md:rounded-[64px] overflow-hidden shadow-2xl shadow-black/80 flex flex-col md:flex-row border border-ink/10"
            >
              <button 
                onClick={() => setSelectedItem(null)}
                className="absolute top-6 right-6 md:top-10 md:right-10 z-50 p-4 rounded-full bg-ink/5 hover:bg-ink/10 text-ink/40 hover:text-ink transition-all active:scale-90"
              >
                <X size={24} />
              </button>

              <div className="w-full md:w-[40%] bg-ink/5 relative overflow-hidden flex items-center justify-center">
                {selectedItem.imageUrl ? (
                  <img 
                    src={selectedItem.imageUrl} 
                    alt={selectedItem.title} 
                    className={`w-full ${selectedItem.category === 'Apps' ? 'h-full object-cover' : 'h-auto max-h-full object-contain'}`} 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-20 text-ink/5">
                    <Book size={120} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none md:hidden" />
              </div>

              <div className="w-full md:w-[60%] p-8 md:p-20 flex flex-col justify-start overflow-y-auto max-h-[80vh] custom-scrollbar">
                <div className="mb-10">
                  <div className="inline-flex items-center gap-3 px-4 py-2 bg-accent/5 border border-accent/10 rounded-full text-accent mb-6">
                    {getCategoryIcon(selectedItem.category)}
                    <span className="text-[10px] uppercase tracking-[0.2em] font-black">{selectedItem.category}</span>
                  </div>
                  <h2 className="text-4xl md:text-6xl font-serif text-ink mb-4 leading-[1.1]">{selectedItem.title}</h2>
                  <p className="text-xl md:text-2xl font-serif text-ink/40 italic">{selectedItem.author}</p>
                </div>

                {selectedItem.description && (
                  <div className="mb-12">
                    <h4 className="text-[10px] uppercase tracking-[0.3em] font-black text-ink/20 mb-6 border-b border-ink/5 pb-2">Insight & Commentary</h4>
                    <p className="text-lg text-ink/70 font-serif leading-relaxed italic border-l-4 border-accent/10 pl-8">
                      "{selectedItem.description}"
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 mt-auto pt-6 border-ink/5">
                  {selectedItem.link && (
                    <Button
                      to={selectedItem.link}
                      variant="primary"
                      size="lg"
                      icon={ExternalLink}
                      className="px-10 rounded-full shadow-xl shadow-accent/20"
                    >
                      Explore Further
                    </Button>
                  )}
                  {isAdmin && (
                    <>
                      <Button
                        onClick={(e) => { setSelectedItem(null); startEdit(selectedItem, e); }}
                        variant="ghost"
                        size="lg"
                        icon={Edit2}
                        className="rounded-full bg-paper border border-ink/5 hover:bg-ink/5"
                      >
                        Edit Entry
                      </Button>
                      <Button
                        onClick={() => { setSelectedItem(null); setDeleteConfirmation(selectedItem.id); }}
                        variant="ghost"
                        size="lg"
                        icon={Trash2}
                        className="rounded-full bg-paper border border-ink/5 hover:bg-red-50 hover:text-red-600 hover:border-red-100"
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirmation && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmation(null)}
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
              <h3 className="text-3xl font-serif mb-4">Delete Entry?</h3>
              <p className="text-ink/40 text-sm leading-relaxed mb-10 px-4">
                Are you sure you want to remove this recommendation from your library?
              </p>
              <div className="flex gap-4">
                <Button 
                  onClick={() => setDeleteConfirmation(null)} 
                  variant="secondary" 
                  className="flex-1 py-5 rounded-3xl"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => handleDelete(deleteConfirmation)} 
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-5 rounded-3xl border-none"
                >
                  Delete
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

