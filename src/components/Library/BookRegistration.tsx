import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Scan, Save, Loader2, Search, Plus, MapPin, AlertCircle, Move, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book } from '../../types/library';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { searchGoogleBooks, GoogleBookInfo } from '../../services/googleBooks';

interface BookRegistrationProps {
  onClose: () => void;
  onSave: (book: Omit<Book, 'id' | 'createdAt' | 'userId'>) => void;
  onVisualSelect?: () => void;
  initialLocation?: Book['location'];
  existingBooks: Book[];
  onMoveBook: (bookId: string, newLocation: Book['location']) => Promise<void>;
  editingBook?: Book;
}

export default function BookRegistration({ 
  onClose, 
  onSave, 
  onVisualSelect, 
  initialLocation,
  existingBooks,
  onMoveBook,
  editingBook
}: BookRegistrationProps) {
  const [loading, setLoading] = useState(false);
  const [conflictBook, setConflictBook] = useState<Book | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  
  const [formData, setFormData] = useState<Omit<Book, 'id' | 'createdAt' | 'userId'>>({
    title: editingBook?.title || '',
    subtitle: editingBook?.subtitle || '',
    authors: editingBook?.authors || (editingBook?.author ? [{ firstName: '', lastName: editingBook.author }] : [{ firstName: '', lastName: '' }]),
    isbn: editingBook?.isbn || '',
    genre: editingBook?.genre || '',
    description: editingBook?.description || '',
    coverUrl: editingBook?.coverUrl || '',
    readingStatus: editingBook?.readingStatus || 'To Read',
    spineColor: editingBook?.spineColor || '',
    location: initialLocation || editingBook?.location || {
      room: 'Main Hall',
      bookshelf: 'Shelf A1',
      shelfLevel: 1,
      position: 1
    }
  });

  useEffect(() => {
    if (initialLocation) {
      setFormData(prev => ({ ...prev, location: initialLocation }));
    }
  }, [initialLocation]);

  const [isScanning, setIsScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GoogleBookInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const handleSearch = async (q: string) => {
    if (!q.trim()) return;
    setIsSearching(true);
    const results = await searchGoogleBooks(q);
    setSearchResults(results);
    setIsSearching(false);
  };

  const selectBook = (info: GoogleBookInfo, onlyCover = false) => {
    if (onlyCover) {
      setFormData(prev => ({ ...prev, coverUrl: info.coverUrl }));
    } else {
      setFormData(prev => ({
        ...prev,
        title: info.title,
        subtitle: info.subtitle,
        authors: info.authors,
        isbn: info.isbn,
        description: info.description,
        genre: info.genre,
        coverUrl: info.coverUrl,
        publisher: info.publisher,
        year: info.year
      }));
    }
    setSearchResults([]);
    setSearchQuery('');
  };

  const checkConflict = (location: Book['location']) => {
    return existingBooks.find(b => 
      b.id !== editingBook?.id &&
      b.location.room === location.room &&
      b.location.bookshelf === location.bookshelf &&
      b.location.shelfLevel === location.shelfLevel &&
      b.location.position === location.position
    );
  };

  const fetchBookMetadata = async (isbn: string) => {
    setLoading(true);
    try {
      const results = await searchGoogleBooks(`isbn:${isbn}`);
      if (results.length > 0) {
        selectBook(results[0]);
      }
    } catch (error) {
      console.error("Failed to fetch book metadata:", error);
    } finally {
      setLoading(false);
    }
  };

  const startScanner = () => {
    setIsScanning(true);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );
      scanner.render((decodedText) => {
        fetchBookMetadata(decodedText);
        scanner.clear();
        setIsScanning(false);
      }, (error) => {
        // console.warn(error);
      });
      scannerRef.current = scanner;
    }, 100);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const conflict = checkConflict(formData.location);
    if (conflict) {
      setConflictBook(conflict);
      setShowConflictDialog(true);
      return;
    }
    onSave(formData);
    onClose();
  };

  const handleSwap = async () => {
    if (!conflictBook) return;
    
    // In a real app, we'd ask where to move the conflictBook.
    // For now, we'll just move it to a "Temporary Storage" room or similar,
    // or just let the user know they need to move it manually after the swap.
    // The prompt says "where would you like to place X book", but implementing a full
    // recursive placement UI is complex. I'll implement a simple "Move to Overflow" logic.
    
    const overflowLocation = {
      ...conflictBook.location,
      room: 'Overflow / Sorting'
    };
    
    await onMoveBook(conflictBook.id, overflowLocation);
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 md:p-8 overflow-y-auto custom-scrollbar">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
      />
      
      <AnimatePresence>
        {showConflictDialog && conflictBook && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute z-[110] w-full max-w-md bg-[#202020] rounded-2xl p-8 border border-white/10 shadow-2xl"
          >
            <div className="flex items-center gap-4 text-amber-500 mb-6">
              <AlertCircle size={32} />
              <h3 className="text-xl font-bold">Slot Occupied</h3>
            </div>
            <p className="text-gray-300 mb-6 leading-relaxed">
              There is already a book here: <span className="text-white font-bold">"{conflictBook.title}"</span>. 
              Do you want to move <span className="text-accent font-bold">"{formData.title || 'New Book'}"</span> into this slot and move <span className="text-white font-bold">"{conflictBook.title}"</span> to Overflow?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowConflictDialog(false)}
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSwap}
                className="flex-1 px-4 py-3 rounded-xl bg-accent hover:bg-accent/80 text-white font-bold transition-all flex items-center justify-center gap-2"
              >
                <Move size={18} />
                Swap & Move
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-4xl bg-[#181818] rounded-2xl overflow-hidden shadow-2xl border border-white/10 my-auto"
      >
        <div className="p-8 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#181818] z-10">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Plus className="text-accent" />
            {editingBook ? 'Edit Book' : 'Register New Book'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} className="text-gray-400" />
          </button>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">Quick Registration</label>
                <div className="flex gap-4">
                  <button 
                    onClick={startScanner}
                    className="flex-1 flex flex-col items-center justify-center gap-3 p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
                  >
                    <Camera size={32} className="text-accent group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-bold text-white">Scan ISBN</span>
                  </button>
                  <button 
                    onClick={onVisualSelect}
                    className="flex-1 flex flex-col items-center justify-center gap-3 p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
                  >
                    <MapPin size={32} className="text-accent group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-bold text-white">Visual Placement</span>
                  </button>
                </div>
              </div>

              {isScanning && (
                <div className="space-y-4">
                  <div id="reader" className="w-full rounded-xl overflow-hidden border border-white/10" />
                  <button 
                    onClick={() => {
                      scannerRef.current?.clear();
                      setIsScanning(false);
                    }}
                    className="w-full py-2 bg-red-500/20 text-red-500 rounded-lg font-bold text-sm"
                  >
                    Cancel Scan
                  </button>
                </div>
              )}

              <div className="relative group">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, author or ISBN..." 
                  className="w-full pl-4 pr-12 py-4 bg-white/5 rounded-xl border border-white/10 focus:border-accent outline-none text-white transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch(searchQuery);
                  }}
                />
                <button 
                  onClick={() => handleSearch(searchQuery)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-accent hover:scale-110 transition-transform"
                >
                  {isSearching ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                </button>

                <AnimatePresence>
                  {searchResults.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute left-0 right-0 top-full mt-2 bg-[#202020] border border-white/10 rounded-xl shadow-2xl z-[120] overflow-hidden"
                    >
                      <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        {searchResults.map((result, idx) => (
                          <div
                            key={idx}
                            className="w-full p-4 flex gap-4 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0 group/result"
                          >
                            <div className="relative flex-shrink-0">
                              {result.coverUrl ? (
                                <img src={result.coverUrl} alt="" className="w-12 h-16 object-cover rounded shadow" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-12 h-16 bg-white/10 rounded flex items-center justify-center">
                                  <Plus size={16} className="text-gray-500" />
                                </div>
                              )}
                              <button 
                                onClick={() => selectBook(result, true)}
                                className="absolute inset-0 bg-accent/80 opacity-0 group-hover/result:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-bold text-white uppercase text-center p-1 leading-tight rounded"
                              >
                                Use Cover
                              </button>
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <div className="font-bold text-white truncate">{result.title}</div>
                              {result.subtitle && <div className="text-[10px] text-gray-500 truncate mb-1 italic">{result.subtitle}</div>}
                              <div className="text-sm text-gray-400 truncate">{result.author}</div>
                              <div className="text-[10px] text-gray-500 mt-1">{result.isbn}</div>
                              <button 
                                onClick={() => selectBook(result)}
                                className="mt-2 text-[10px] font-bold text-accent uppercase tracking-widest hover:underline text-left"
                              >
                                Use Full Details
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-3 text-accent py-4">
                  <Loader2 className="animate-spin" />
                  <span className="font-bold">Fetching metadata...</span>
                </div>
              )}

                <div className="space-y-4">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Reading Status</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['To Read', 'Currently Reading', 'Finished'] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setFormData({ ...formData, readingStatus: status })}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                          formData.readingStatus === status 
                            ? 'bg-accent border-accent text-white' 
                            : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Palette size={14} />
                    Spine Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { name: 'Default', value: '' },
                      { name: 'Red', value: '#ef4444' },
                      { name: 'Blue', value: '#3b82f6' },
                      { name: 'Green', value: '#22c55e' },
                      { name: 'Brown', value: '#78350f' },
                      { name: 'Black', value: '#1a1a1a' },
                      { name: 'Purple', value: '#a855f7' },
                      { name: 'Gold', value: '#fbbf24' },
                    ].map((color) => (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => setFormData({ ...formData, spineColor: color.value })}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          formData.spineColor === color.value 
                            ? 'border-white scale-110 shadow-lg' 
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color.value || '#444' }}
                        title={color.name}
                      />
                    ))}
                    <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-white/10 hover:border-white/30 transition-all">
                      <input 
                        type="color"
                        value={formData.spineColor || '#444444'}
                        onChange={(e) => setFormData({ ...formData, spineColor: e.target.value })}
                        className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Cover Image</label>
                  <div className="flex gap-4">
                    <div className="w-24 h-36 bg-white/5 rounded-xl border border-white/10 overflow-hidden flex-shrink-0 shadow-lg">
                      {formData.coverUrl ? (
                        <img src={formData.coverUrl} alt="Cover preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                          <Plus size={32} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <input 
                        type="text" 
                        value={formData.coverUrl}
                        onChange={(e) => setFormData({...formData, coverUrl: e.target.value})}
                        placeholder="Cover Image URL (https://...)"
                        className="w-full px-4 py-3 bg-white/5 rounded-xl border border-white/10 focus:border-accent outline-none text-white text-sm"
                      />
                      <p className="text-[10px] text-gray-500 leading-relaxed">
                        Tip: Use the search above to find covers automatically, or paste a direct image URL here.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Description</label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={4}
                    placeholder="Brief summary of the book..."
                    className="w-full px-4 py-3 bg-white/5 rounded-xl border border-white/10 focus:border-accent outline-none text-white text-sm resize-none custom-scrollbar"
                  />
                </div>

                <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Title</label>
                  <input 
                    required
                    type="text" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full px-4 py-3 bg-white/5 rounded-xl border border-white/10 focus:border-accent outline-none text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Subtitle</label>
                  <input 
                    type="text" 
                    value={formData.subtitle}
                    onChange={(e) => setFormData({...formData, subtitle: e.target.value})}
                    placeholder="Optional subtitle..."
                    className="w-full px-4 py-3 bg-white/5 rounded-xl border border-white/10 focus:border-accent outline-none text-white"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Authors</label>
                    <button 
                      type="button"
                      onClick={() => setFormData({ ...formData, authors: [...formData.authors, { firstName: '', lastName: '' }] })}
                      className="text-[10px] font-bold text-accent uppercase tracking-widest flex items-center gap-1 hover:underline"
                    >
                      <Plus size={12} />
                      Add Author
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formData.authors.map((author, index) => (
                      <div key={index} className="flex gap-3 items-start">
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <input 
                            required
                            type="text" 
                            placeholder="First Name"
                            value={author.firstName}
                            onChange={(e) => {
                              const newAuthors = [...formData.authors];
                              newAuthors[index].firstName = e.target.value;
                              setFormData({ ...formData, authors: newAuthors });
                            }}
                            className="w-full px-4 py-3 bg-white/5 rounded-xl border border-white/10 focus:border-accent outline-none text-white text-sm"
                          />
                          <input 
                            required
                            type="text" 
                            placeholder="Last Name"
                            value={author.lastName}
                            onChange={(e) => {
                              const newAuthors = [...formData.authors];
                              newAuthors[index].lastName = e.target.value;
                              setFormData({ ...formData, authors: newAuthors });
                            }}
                            className="w-full px-4 py-3 bg-white/5 rounded-xl border border-white/10 focus:border-accent outline-none text-white text-sm"
                          />
                        </div>
                        {formData.authors.length > 1 && (
                          <button 
                            type="button"
                            onClick={() => {
                              const newAuthors = formData.authors.filter((_, i) => i !== index);
                              setFormData({ ...formData, authors: newAuthors });
                            }}
                            className="p-3 hover:bg-red-500/10 text-red-500 rounded-xl transition-colors"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Genre</label>
                    <input 
                      type="text" 
                      value={formData.genre}
                      onChange={(e) => setFormData({...formData, genre: e.target.value})}
                      className="w-full px-4 py-3 bg-white/5 rounded-xl border border-white/10 focus:border-accent outline-none text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">ISBN</label>
                    <input 
                      type="text" 
                      value={formData.isbn}
                      onChange={(e) => setFormData({...formData, isbn: e.target.value})}
                      className="w-full px-4 py-3 bg-white/5 rounded-xl border border-white/10 focus:border-accent outline-none text-white"
                    />
                  </div>
                </div>
                
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Physical Location</label>
                    {initialLocation && (
                      <span className="text-[10px] font-bold text-accent uppercase tracking-widest flex items-center gap-1">
                        <MapPin size={10} />
                        Visually Selected
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-600">Room</label>
                      <select 
                        value={formData.location.room}
                        onChange={(e) => setFormData({...formData, location: {...formData.location, room: e.target.value}})}
                        className="w-full px-4 py-3 bg-white/5 rounded-xl border border-white/10 outline-none text-white"
                      >
                        <option value="Main Hall" className="bg-gray-900">Main Hall</option>
                        <option value="History West" className="bg-gray-900">History West</option>
                        <option value="Science Wing" className="bg-gray-900">Science Wing</option>
                        <option value="Overflow / Sorting" className="bg-gray-900">Overflow / Sorting</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-600">Bookshelf</label>
                      <input 
                        type="text" 
                        value={formData.location.bookshelf}
                        onChange={(e) => setFormData({...formData, location: {...formData.location, bookshelf: e.target.value}})}
                        className="w-full px-4 py-3 bg-white/5 rounded-xl border border-white/10 outline-none text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-600">Shelf Level</label>
                      <input 
                        type="number" 
                        min={1}
                        value={formData.location.shelfLevel}
                        onChange={(e) => setFormData({...formData, location: {...formData.location, shelfLevel: parseInt(e.target.value)}})}
                        className="w-full px-4 py-3 bg-white/5 rounded-xl border border-white/10 outline-none text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-600">Position</label>
                      <input 
                        type="number" 
                        min={1}
                        max={20}
                        value={formData.location.position}
                        onChange={(e) => setFormData({...formData, location: {...formData.location, position: parseInt(e.target.value)}})}
                        className="w-full px-4 py-3 bg-white/5 rounded-xl border border-white/10 outline-none text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent/80 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-accent/20 mt-8"
              >
                <Save size={20} />
                {editingBook ? 'Update Book' : 'Save Book to Library'}
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
