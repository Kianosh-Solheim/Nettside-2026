import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, Film, Tv, ExternalLink, AppWindow, Video, Plus, Search, X, Check, Loader2, Edit2, Trash2, Save } from 'lucide-react';
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
  const [isSearchingMovies, setIsSearchingMovies] = useState(false);
  const [isSearchingBooks, setIsSearchingBooks] = useState(false);
  const [movieSearchResults, setMovieSearchResults] = useState<any[]>([]);
  const [bookSearchResults, setBookSearchResults] = useState<any[]>([]);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [personalizedMovies, setPersonalizedMovies] = useState<any[]>([]);

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
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Recommendation[];
      setRecommendations(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'recommendations');
      setLoading(false);
    });

    // Fetch Admin's Personalized Movie Recommendations
    const adminEmails = ['kianoshsolheim@gmail.com', 'kianosh@solheim.online'];
    const qAdmin = query(collection(db, 'users'), orderBy('email'), where('email', 'in', adminEmails));
    
    let unsubscribeAdminPage: (() => void) | undefined;

    const unsubscribeAdminUser = onSnapshot(qAdmin, (snapshot) => {
      if (!snapshot.empty) {
        const adminId = snapshot.docs[0].id;
        unsubscribeAdminPage = onSnapshot(doc(db, 'user_pages', adminId), (pageDoc) => {
          if (pageDoc.exists()) {
            const data = pageDoc.data();
            setPersonalizedMovies(data.movieRecommendations || []);
          }
        });
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeRecs();
      unsubscribeAdminUser();
      if (unsubscribeAdminPage) unsubscribeAdminPage();
    };
  }, []);

  const handleSearchMovies = async () => {
    if (!formData.title) return;
    setIsSearchingMovies(true);
    try {
      const omdbKey = import.meta.env.VITE_OMDB_API_KEY;
      const response = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(formData.title)}&type=movie&apikey=${omdbKey || 'b054da29'}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Movies API failed: ${errorData.Error || response.statusText}`);
      }
      const data = await response.json();
      
      if (data.Response === 'False') {
        setMovieSearchResults([]);
        if (data.Error !== 'Movie not found!') {
          throw new Error(data.Error);
        }
      } else {
        setMovieSearchResults(data.Search || []);
      }
    } catch (error) {
      console.error("Error searching movies:", error);
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Movies search failed' });
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
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Books API failed: ${errorData.error?.message || response.statusText}`);
      }
      const data = await response.json();
      setBookSearchResults(data.items || []);
    } catch (error) {
      console.error("Error searching books:", error);
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Books search failed' });
    } finally {
      setIsSearchingBooks(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'recommendations', editingId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        setStatus({ type: 'success', message: 'Updated successfully' });
      } else {
        await addDoc(collection(db, 'recommendations'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setStatus({ type: 'success', message: 'Added successfully' });
      }
      resetForm();
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to save' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this recommendation?')) return;
    try {
      await deleteDoc(doc(db, 'recommendations', id));
      setStatus({ type: 'success', message: 'Deleted successfully' });
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to delete' });
    }
  };

  const resetForm = () => {
    setFormData({ title: '', author: '', category: 'Books', description: '', link: '', imageUrl: '' });
    setIsAdding(false);
    setEditingId(null);
    setMovieSearchResults([]);
    setBookSearchResults([]);
  };

  const startEdit = (rec: Recommendation) => {
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

  const categories = [
    { name: 'Books', icon: <Book size={20} /> },
    { name: 'Movies & Shows', icon: <Film size={20} /> },
    { name: 'Video & Media', icon: <Video size={20} /> },
    { name: 'Apps', icon: <AppWindow size={20} /> }
  ];

  const getCategoryIcon = (catName: string) => {
    switch (catName) {
      case 'Books': return <Book size={20} />;
      case 'Movies & Shows': return <Film size={20} />;
      case 'Video & Media': return <Video size={20} />;
      case 'Apps': return <AppWindow size={20} />;
      default: return <Book size={20} />;
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-xs uppercase tracking-widest text-ink/40 animate-pulse">Loading recommendations...</p>
      </div>
    );
  }

  const groupedRecommendations = recommendations.reduce((acc, rec) => {
    if (!acc[rec.category]) acc[rec.category] = [];
    acc[rec.category].push(rec);
    return acc;
  }, {} as Record<string, Recommendation[]>);

  return (
    <div className="max-w-4xl mx-auto px-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-16 flex justify-between items-end"
      >
        <div>
          <h1 className="text-5xl md:text-7xl font-serif mb-4">Recommendations</h1>
          <p className="text-sm text-ink/40 uppercase tracking-[0.2em]">A curated list of media that has shaped my perspective.</p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => isAdding ? resetForm() : setIsAdding(true)}
            variant={isAdding ? "ghost" : "primary"}
            size="sm"
            magnetic={true}
            icon={isAdding ? X : Plus}
          >
            {isAdding ? 'Cancel' : 'Add New'}
          </Button>
        )}
      </motion.div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-16 overflow-hidden"
          >
            <div className="p-8 bg-surface border border-ink/5 rounded-[32px] shadow-sm space-y-8">
              <h2 className="text-2xl font-serif">{editingId ? 'Edit Recommendation' : 'New Recommendation'}</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 font-black">Title</label>
                    <div className="flex gap-2">
                      <input
                        required
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && formData.category === 'Movies & Shows' && (e.preventDefault(), handleSearchMovies())}
                        className="flex-grow px-5 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent transition-all"
                        placeholder="Enter title..."
                      />
                      {formData.category === 'Movies & Shows' && (
                        <Button
                          type="button"
                          onClick={handleSearchMovies}
                          isLoading={isSearchingMovies}
                          variant="outline"
                          className="px-6 border-accent/20 text-accent"
                          icon={Search}
                        >
                          Search
                        </Button>
                      )}
                      {formData.category === 'Books' && (
                        <Button
                          type="button"
                          onClick={handleSearchBooks}
                          isLoading={isSearchingBooks}
                          variant="outline"
                          className="px-6 border-accent/20 text-accent"
                          icon={Search}
                        >
                          Search
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 font-black">Author / Creator</label>
                    <input
                      required
                      type="text"
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      className="w-full px-5 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent transition-all"
                      placeholder="Enter author..."
                    />
                  </div>
                </div>

                {formData.category === 'Movies & Shows' && movieSearchResults.length > 0 && (
                  <div className="space-y-3 p-4 bg-accent/5 rounded-3xl border border-accent/10">
                    <label className="text-[10px] uppercase tracking-widest text-accent font-black">Select Movie Poster</label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-60 overflow-y-auto p-2 custom-scrollbar">
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
                              isSelected ? 'border-accent ring-4 ring-accent/10 scale-95' : 'border-transparent hover:border-accent/30'
                            }`}
                          >
                            <img src={posterUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            {isSelected && (
                              <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                                <Check className="text-accent" size={24} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {formData.category === 'Books' && bookSearchResults.length > 0 && (
                  <div className="space-y-3 p-4 bg-accent/5 rounded-3xl border border-accent/10">
                    <label className="text-[10px] uppercase tracking-widest text-accent font-black">Select Book Cover</label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-60 overflow-y-auto p-2 custom-scrollbar">
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
                              isSelected ? 'border-accent ring-4 ring-accent/10 scale-95' : 'border-transparent hover:border-accent/30'
                            }`}
                          >
                            {posterUrl ? (
                              <img src={posterUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full bg-ink/5 flex items-center justify-center text-[8px] text-center p-2">
                                {volumeInfo.title}
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                                <Check className="text-accent" size={24} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 font-black">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      className="w-full px-5 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent transition-all appearance-none"
                    >
                      <option value="Books">Books</option>
                      <option value="Movies & Shows">Movies & Shows</option>
                      <option value="Video & Media">Video & Media</option>
                      <option value="Apps">Apps</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 font-black">Image URL</label>
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="w-full px-5 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent transition-all"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-ink/40 font-black">Description</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-5 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent transition-all resize-none"
                    placeholder="Why do you recommend this?"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-ink/40 font-black">External Link</label>
                  <input
                    type="url"
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                    className="w-full px-5 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent transition-all"
                    placeholder="https://..."
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full py-4 rounded-2xl shadow-xl shadow-accent/20"
                  icon={editingId ? Save : Plus}
                >
                  {editingId ? 'Save Changes' : 'Add Recommendation'}
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {status && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-8 p-4 rounded-2xl text-xs uppercase tracking-widest text-center ${
            status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
          }`}
        >
          {status.message}
        </motion.div>
      )}

      <div className="grid gap-16">
        {personalizedMovies.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="flex items-center space-x-4 mb-8">
              <div className="p-3 bg-accent/10 rounded-2xl text-accent">
                <Film size={20} />
              </div>
              <h2 className="text-3xl font-serif">Personalized Movie Recommendations</h2>
              <div className="flex-grow h-px bg-ink/5 ml-4" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {personalizedMovies.map((movie, idx) => (
                <motion.div 
                  key={idx}
                  whileHover={{ y: -4 }}
                  className="group p-6 bg-surface border border-ink/5 rounded-2xl transition-all hover:shadow-xl hover:shadow-accent/5"
                >
                  <div className="flex gap-4 mb-4">
                    {movie.imageUrl && (
                      <div className="w-16 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-ink/5 border border-ink/5">
                        <img 
                          src={movie.imageUrl} 
                          alt={movie.title} 
                          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                    )}
                    <div className="flex-grow">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-serif group-hover:text-accent transition-colors">{movie.title}</h3>
                          <p className="text-xs text-ink/40 font-medium uppercase tracking-wider">Personal Recommendation</p>
                        </div>
                        {movie.link && (
                          <a 
                            href={movie.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 text-ink/20 hover:text-accent transition-colors"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  {movie.description && (
                    <p className="text-sm text-ink/60 leading-relaxed italic">
                      "{movie.description}"
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {Object.entries(groupedRecommendations).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
          <motion.section 
            key={category}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="flex items-center space-x-4 mb-8">
              <div className="p-3 bg-accent/10 rounded-2xl text-accent">
                {getCategoryIcon(category)}
              </div>
              <h2 className="text-3xl font-serif">{category}</h2>
              <div className="flex-grow h-px bg-ink/5 ml-4" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {items.map((item) => (
                <motion.div 
                  key={item.id}
                  whileHover={{ y: -4 }}
                  className="group p-6 bg-surface border border-ink/5 rounded-2xl transition-all hover:shadow-xl hover:shadow-accent/5"
                >
                  <div className="flex gap-4 mb-4">
                    {item.imageUrl && (
                      <div className="w-16 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-ink/5 border border-ink/5">
                        <img 
                          src={item.imageUrl} 
                          alt={item.title} 
                          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                    )}
                    <div className="flex-grow">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-serif group-hover:text-accent transition-colors">{item.title}</h3>
                          <p className="text-xs text-ink/40 font-medium uppercase tracking-wider">{item.author}</p>
                        </div>
                        <div className="flex items-center space-x-1">
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => startEdit(item)}
                                className="p-2 text-ink/20 hover:text-accent transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="p-2 text-ink/20 hover:text-red-500 transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                          {item.link && (
                            <a 
                              href={item.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-2 text-ink/20 hover:text-accent transition-colors"
                            >
                              <ExternalLink size={16} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {item.description && (
                    <p className="text-sm text-ink/60 leading-relaxed italic">
                      "{item.description}"
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.section>
        ))}

        {recommendations.length === 0 && (
          <div className="text-center py-20 border border-dashed border-ink/10 rounded-3xl">
            <p className="text-sm text-ink/40 uppercase tracking-widest">No recommendations found yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
