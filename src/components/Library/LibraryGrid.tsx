import React, { useState } from 'react';
import { Book } from '../../types/library';
import { Search, Filter, MapPin, Info, Plus, HandHelping } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LibraryGridProps {
  books: Book[];
  onBookClick: (book: Book) => void;
  onAddClick: () => void;
  selectedBookId?: string;
}

export default function LibraryGrid({ books, onBookClick, onAddClick, selectedBookId }: LibraryGridProps) {
  const [search, setSearch] = useState('');
  const [genreFilter, setGenreFilter] = useState('All');

  const filteredBooks = books.filter(book => {
    const authorString = book.authors ? book.authors.map(a => `${a.firstName} ${a.lastName}`).join(' ') : (book.author || '');
    const matchesSearch = book.title.toLowerCase().includes(search.toLowerCase()) ||
                         authorString.toLowerCase().includes(search.toLowerCase()) ||
                         book.isbn.includes(search);
    const matchesGenre = genreFilter === 'All' || book.genre === genreFilter;
    return matchesSearch && matchesGenre;
  });

  const genres = ['All', ...new Set(books.map(b => b.genre))];

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-ink/5 p-6 rounded-2xl backdrop-blur-xl border border-ink/10">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" size={20} />
          <input 
            type="text" 
            placeholder="Search by title, author, or ISBN..." 
            className="w-full pl-12 pr-4 py-3 bg-ink/5 rounded-xl border border-ink/10 focus:border-accent focus:ring-1 focus:ring-accent outline-none text-ink transition-all placeholder:text-ink/30"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-ink/5 px-4 py-2 rounded-xl border border-ink/10">
            <Filter size={18} className="text-ink/40" />
            <select 
              className="bg-transparent outline-none text-ink text-sm"
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
            >
              {genres.map(g => <option key={g} value={g} className="bg-paper text-ink">{g}</option>)}
            </select>
          </div>
          
          <button 
            onClick={onAddClick}
            className="flex items-center gap-2 bg-accent hover:bg-accent/80 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-accent/20"
          >
            <Plus size={20} />
            Add Book
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredBooks.map((book) => {
            const isSelected = book.id === selectedBookId;
            return (
              <motion.div
                key={book.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ 
                  opacity: 1, 
                  scale: isSelected ? 1.05 : 1,
                  y: isSelected ? -8 : 0
                }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ y: -8 }}
                className={`group cursor-pointer relative ${isSelected ? 'z-10' : 'z-0'}`}
                onClick={() => onBookClick(book)}
              >
                <div className={`relative aspect-[2/3] rounded-2xl overflow-hidden shadow-xl border transition-all duration-300 ${
                  isSelected 
                    ? 'border-accent ring-4 ring-accent/20 shadow-accent/20' 
                    : 'border-ink/10 bg-ink/5'
                }`}>
                  <img 
                    src={book.coverUrl || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=400'} 
                    alt={book.title}
                    className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${book.borrowedBy ? 'opacity-50 grayscale' : ''}`}
                    referrerPolicy="no-referrer"
                  />
                  {book.borrowedBy && (
                    <div className="absolute top-2 right-2 bg-orange-500 text-white p-1.5 rounded-lg shadow-lg z-20">
                      <HandHelping size={14} />
                    </div>
                  )}
                  <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity flex flex-col justify-end p-4 ${
                    isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}>
                    <div className="flex items-center gap-2 text-xs font-bold text-accent mb-1">
                      <MapPin size={12} />
                      {book.location.room}
                    </div>
                    <button className="flex items-center justify-center gap-2 bg-white text-black py-2 rounded-lg font-bold text-sm hover:bg-white/90 transition-colors">
                      <Info size={16} />
                      Details
                    </button>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <h3 className={`font-bold line-clamp-1 transition-colors ${
                    isSelected ? 'text-accent' : 'text-ink group-hover:text-accent'
                  }`}>
                    {book.title}
                  </h3>
                  <p className="text-xs text-ink/40 line-clamp-1">
                    {book.authors ? book.authors.map(a => `${a.firstName} ${a.lastName}`).join(', ') : book.author}
                  </p>
                </div>
                {isSelected && (
                  <motion.div 
                    layoutId="selection-glow"
                    className="absolute -inset-4 bg-accent/10 blur-2xl rounded-full -z-10"
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      
      {filteredBooks.length === 0 && (
        <div className="text-center py-20">
          <div className="text-ink/40 text-lg">No books found matching your criteria.</div>
        </div>
      )}
    </div>
  );
}
