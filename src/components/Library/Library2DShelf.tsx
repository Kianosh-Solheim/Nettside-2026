import React, { useState, useEffect } from 'react';
import { Book } from '../../types/library';
import { ArrowLeft, Book as BookIcon, MapPin, Plus, Edit2, Check, X, FolderPlus, Search, HandHelping } from 'lucide-react';
import { motion } from 'framer-motion';

interface Library2DShelfProps {
  books: Book[];
  onBookClick: (book: Book) => void;
  mode: 'explore' | 'select' | 'locate';
  targetBook?: Book;
  onSlotSelect?: (location: { room: string, bookshelf: string, shelfLevel: number, position: number }) => void;
  onRenameShelf?: (room: string, oldName: string, newName: string) => Promise<void>;
}

export default function Library2DShelf({ books, onBookClick, mode, targetBook, onSlotSelect, onRenameShelf }: Library2DShelfProps) {
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedShelf, setSelectedShelf] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editShelfName, setEditShelfName] = useState('');
  const [isSavingRename, setIsSavingRename] = useState(false);
  
  const [extraLevels, setExtraLevels] = useState(0);
  const [emptyShelves, setEmptyShelves] = useState<Array<{room: string, shelf: string}>>([]);
  const [addingShelfToRoom, setAddingShelfToRoom] = useState<string | null>(null);
  const [newShelfName, setNewShelfName] = useState('');
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  useEffect(() => {
    if (targetBook && mode === 'locate') {
      setSelectedRoom(targetBook.location.room);
      setSelectedShelf(targetBook.location.bookshelf);
    }
  }, [targetBook, mode]);

  useEffect(() => {
    setExtraLevels(0);
  }, [selectedRoom, selectedShelf]);

  const libraryStructure = books.reduce((acc, book) => {
    const room = book.location.room || 'Main Hall';
    const shelf = book.location.bookshelf || 'Default Shelf';
    if (!acc[room]) acc[room] = {};
    if (!acc[room][shelf]) acc[room][shelf] = [];
    acc[room][shelf].push(book);
    return acc;
  }, {} as Record<string, Record<string, Book[]>>);

  const handleRenameSubmit = async () => {
    if (!selectedRoom || !selectedShelf || !editShelfName.trim() || editShelfName === selectedShelf) {
      setIsRenaming(false);
      return;
    }
    if (onRenameShelf) {
      setIsSavingRename(true);
      await onRenameShelf(selectedRoom, selectedShelf, editShelfName.trim());
      setSelectedShelf(editShelfName.trim());
      setIsSavingRename(false);
      setIsRenaming(false);
    }
  };

  const rooms = Object.keys(libraryStructure);

  if (!selectedRoom || !selectedShelf) {
    return (
      <div className="h-full p-8 overflow-y-auto custom-scrollbar">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-ink">
          <MapPin className="text-accent" />
          {mode === 'select' ? 'Select a Shelf for Placement' : 'Browse Shelves'}
        </h2>
        
        {rooms.length === 0 && (
          <div className="text-ink/40 italic p-8 text-center bg-ink/5 rounded-2xl border border-ink/10">
            No shelves found. Add a book to create your first shelf!
          </div>
        )}

        <div className="space-y-12">
          {rooms.map(room => (
            <div key={room} className="space-y-6">
              <h3 className="text-xl font-bold text-ink border-b border-ink/10 pb-4 flex items-center gap-2">
                {room}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.keys(libraryStructure[room]).map(shelf => (
                  <button
                    key={shelf}
                    onClick={() => {
                      setSelectedRoom(room);
                      setSelectedShelf(shelf);
                    }}
                    className="flex items-center justify-between p-6 bg-ink/5 border border-ink/10 rounded-2xl hover:bg-ink/10 hover:border-accent transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
                        <BookIcon size={24} />
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-lg text-ink">{shelf}</div>
                        <div className="text-sm text-ink/40">{libraryStructure[room][shelf].length} books</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const shelfBooks = libraryStructure[selectedRoom]?.[selectedShelf] || [];
  const maxLevel = shelfBooks.length > 0 ? Math.max(...shelfBooks.map(b => b.location.shelfLevel)) : 0;
  const levels = Math.max(5, maxLevel) + extraLevels;
  const positions = 20;

  const getSpineColor = (book: Book) => {
    if (book.spineColor) return book.spineColor;
    switch (book.readingStatus) {
      case 'Currently Reading': return '#22c55e'; // bg-green-500
      case 'Finished': return '#3b82f6'; // bg-blue-500
      case 'To Read': return '#f97316'; // bg-orange-500
      default: return '#6b7280'; // bg-gray-500
    }
  };

  return (
    <div className="h-full flex flex-col p-6 lg:p-10">
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              setSelectedRoom(null);
              setSelectedShelf(null);
              setIsRenaming(false);
            }}
            className="p-3 bg-ink/5 hover:bg-ink/10 rounded-2xl transition-colors text-ink/40 hover:text-ink"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-black text-ink flex items-center gap-3">
              {selectedRoom}
              <span className="text-accent">/</span>
              {isRenaming ? (
                <div className="flex items-center gap-2">
                  <input 
                    type="text"
                    value={editShelfName}
                    onChange={(e) => setEditShelfName(e.target.value)}
                    className="bg-ink/5 border border-ink/10 rounded-lg px-3 py-1 text-accent outline-none focus:border-accent w-48"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSubmit();
                      if (e.key === 'Escape') setIsRenaming(false);
                    }}
                    disabled={isSavingRename}
                  />
                  <button onClick={handleRenameSubmit} disabled={isSavingRename} className="p-1.5 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30">
                    <Check size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <span className="text-accent">{selectedShelf}</span>
                  {onRenameShelf && mode === 'explore' && (
                    <button 
                      onClick={() => {
                        setEditShelfName(selectedShelf);
                        setIsRenaming(true);
                      }}
                      className="p-1.5 text-ink/40 hover:text-ink opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-ink/5"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                </div>
              )}
            </h2>
            <div className="flex items-center gap-2 text-[10px] font-bold text-ink/40 uppercase tracking-widest mt-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              Interactive Bookcase View
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-6 mr-8">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent" />
              <span className="text-[10px] font-bold text-ink/40 uppercase tracking-widest">Empty Slot (Click to Add)</span>
            </div>
          </div>
          
          {mode === 'locate' && (
            <div className="px-4 py-2 bg-accent/20 border border-accent/30 rounded-xl flex items-center gap-3 animate-pulse">
              <Search size={16} className="text-accent" />
              <span className="text-xs font-bold text-accent uppercase tracking-widest">Locating: {targetBook?.title}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar bg-ink/5 rounded-[40px] border border-ink/10 p-4 lg:p-12 shadow-inner relative">
        {/* The Bookcase Frame */}
        <div className="mx-auto max-w-6xl bg-[#2a1d15] rounded-lg shadow-[0_50px_100px_rgba(0,0,0,0.8)] border-x-[24px] border-t-[24px] border-[#3d2b1f] relative overflow-hidden">
          {/* Wood Grain Overlay */}
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]" />
          
          {/* Shelves Content */}
          <div className="flex flex-col">
            {[...Array(levels)].map((_, levelIndex) => {
              const currentLevel = levelIndex + 1;
              return (
                <div key={currentLevel} className="relative w-full flex items-end border-b-[32px] border-[#1a120d] pb-0 gap-1 h-[340px] bg-[#0f0f0f] shadow-[inset_0_20px_40px_rgba(0,0,0,0.7)] px-6">
                  {/* Shelf Level Label */}
                  <div className="absolute -left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#d4a373]/30 uppercase -rotate-90 tracking-[0.3em] pointer-events-none">
                    Level {currentLevel}
                  </div>

                  {[...Array(positions)].map((_, posIndex) => {
                    const currentPos = posIndex + 1;
                    const book = shelfBooks.find(b => b.location.shelfLevel === currentLevel && b.location.position === currentPos);
                    const isTarget = targetBook?.id === book?.id;

                    if (book) {
                      return (
                        <div 
                          key={currentPos}
                          onClick={() => onBookClick(book)}
                          className={`flex-1 min-w-[30px] h-[92%] rounded-t-sm cursor-pointer transition-all hover:-translate-y-3 relative group overflow-visible ${isTarget ? 'z-20 scale-[1.05]' : 'z-10'}`}
                          title={`${book.title} by ${book.author}`}
                        >
                          {/* Book Spine */}
                          <div 
                            className="w-full h-full rounded-t-sm shadow-[6px_0_15px_rgba(0,0,0,0.6)] relative overflow-hidden border-x border-black/40"
                            style={{ backgroundColor: getSpineColor(book) }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-white/10 to-black/50" />
                            <div className="absolute top-8 left-0 right-0 h-px bg-white/20" />
                            <div className="absolute top-10 left-0 right-0 h-px bg-white/10" />
                            <div className="absolute bottom-12 left-0 right-0 h-px bg-black/50" />
                            <div className="absolute bottom-14 left-0 right-0 h-px bg-black/30" />

                            <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none py-16">
                              <span className="text-[12px] font-black text-white truncate w-[280px] text-center -rotate-90 drop-shadow-[0_3px_6px_rgba(0,0,0,0.9)] uppercase tracking-[0.2em]">
                                {book.title}
                              </span>
                            </div>

                            {book.borrowedBy && (
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full flex justify-center pointer-events-none">
                                <div className="bg-orange-500 p-1 rounded-full shadow-lg border border-black/20">
                                  <HandHelping size={12} className="text-white" />
                                </div>
                              </div>
                            )}

                            <div className="absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none">
                              <span className="text-[9px] font-bold text-white/40 truncate w-[100px] text-center -rotate-90 uppercase tracking-tighter">
                                {book.authors ? book.authors.map(a => `${a.firstName} ${a.lastName}`).join(', ') : book.author}
                              </span>
                            </div>
                          </div>

                          {isTarget && (
                            <div className="absolute -inset-3 border-4 border-white rounded-t-md animate-pulse pointer-events-none shadow-[0_0_40px_rgba(255,255,255,0.9)]" />
                          )}

                          {isTarget && (
                            <div className="absolute -top-36 left-1/2 -translate-x-1/2 bg-surface text-ink p-4 rounded-2xl whitespace-nowrap shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-5 z-50 border-2 border-accent">
                              {book.coverUrl && (
                                <img 
                                  src={book.coverUrl} 
                                  alt="" 
                                  referrerPolicy="no-referrer"
                                  className="w-16 h-24 object-cover rounded-xl shadow-xl"
                                />
                              )}
                              <div className="pr-4">
                                <div className="text-[12px] font-black text-accent uppercase tracking-widest leading-none mb-2">Target Book</div>
                                <div className="text-lg font-bold truncate max-w-[240px]">{book.title}</div>
                                <div className="text-sm text-ink/40 truncate max-w-[240px]">
                                  {book.authors ? book.authors.map(a => `${a.firstName} ${a.lastName}`).join(', ') : book.author}
                                </div>
                              </div>
                              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-surface rotate-45 border-r-2 border-b-2 border-accent" />
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div 
                        key={currentPos}
                        onClick={() => {
                          if (onSlotSelect) {
                            onSlotSelect({
                              room: selectedRoom,
                              bookshelf: selectedShelf,
                              shelfLevel: currentLevel,
                              position: currentPos
                            });
                          }
                        }}
                        className="flex-1 min-w-[30px] h-[92%] rounded-t-sm border border-white/5 transition-all hover:bg-accent/10 hover:border-accent/30 cursor-pointer relative group"
                      >
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus size={18} className="text-accent" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="h-20 bg-[#1a120d] border-t-8 border-black/30 flex items-center justify-center">
            <button 
              onClick={() => setExtraLevels(l => l + 1)}
              className="flex items-center gap-2 px-6 py-2 bg-white/5 hover:bg-white/10 rounded-full text-[#d4a373] text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <Plus size={14} />
              Add Shelf Level
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
