import React, { useState } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import LibraryGrid from './Library/LibraryGrid';
import Library2DShelf from './Library/Library2DShelf';
import BookDetail from './Library/BookDetail';
import BookRegistration from './Library/BookRegistration';
import { Book } from '../types/library';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Box, ArrowLeft, Lock, LogIn } from 'lucide-react';
import { auth, signInWithPopup, googleProvider } from '../firebase';
import Button from './ui/Button';

export default function Library() {
  const { books, loading, unauthorized, addBook, moveBook, updateBook, renameBookshelf } = useLibrary();
  const [view, setView] = useState<'grid' | 'shelves'>('grid');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [locateMode, setLocateMode] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [targetBook, setTargetBook] = useState<Book | undefined>(undefined);
  const [pendingLocation, setPendingLocation] = useState<Book['location'] | null>(null);

  const user = auth.currentUser;

  const handleBookClick = (book: Book) => {
    setSelectedBook(book);
  };

  const handleLocate = (book: Book) => {
    setTargetBook(book);
    setLocateMode(true);
    setView('shelves');
    setSelectedBook(null);
  };

  const handleAddBook = (bookData: Omit<Book, 'id' | 'createdAt' | 'userId'>) => {
    if (editingBook) {
      updateBook(editingBook.id, bookData);
    } else {
      addBook(bookData);
    }
  };

  const handleSlotSelect = (location: Book['location']) => {
    setPendingLocation(location);
    setSelectMode(false);
    setIsRegistering(true);
  };

  const getShelfMode = () => {
    if (locateMode) return 'locate';
    if (selectMode) return 'select';
    return 'explore';
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-paper">
        <div className="text-accent animate-pulse font-bold tracking-widest uppercase">Loading Library...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-paper text-ink px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8 p-12 rounded-[32px] bg-ink/5 border border-ink/10 backdrop-blur-xl"
        >
          <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock size={40} className="text-accent" />
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-black tracking-tight">Private Collection</h2>
            <p className="text-ink/60 leading-relaxed">
              The Library collection is restricted to members. Please log in to explore the interactive catalogue.
            </p>
          </div>
          <Button
            onClick={() => signInWithPopup(auth, googleProvider)}
            variant="primary"
            size="lg"
            icon={LogIn}
            className="w-full py-4 text-lg"
            magnetic={true}
          >
            Log In with Google
          </Button>
        </motion.div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-paper text-ink px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8 p-12 rounded-[32px] bg-ink/5 border border-ink/10 backdrop-blur-xl"
        >
          <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock size={40} className="text-accent" />
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-black tracking-tight">Pending Approval</h2>
            <p className="text-ink/60 leading-relaxed">
              Your account is currently pending approval. Once an administrator approves your access, you'll be able to view and manage the library.
            </p>
          </div>
          <div className="pt-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-xs font-bold uppercase tracking-widest">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              Awaiting Admin Review
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight text-ink">Library</h1>
            <p className="text-ink/60 font-medium">Visual, Interactive Library Management System</p>
          </div>

          <div className="flex items-center bg-ink/5 p-1.5 rounded-2xl border border-ink/10">
            <button 
              onClick={() => {
                setView('grid');
                setLocateMode(false);
              }}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${view === 'grid' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-ink/40 hover:text-ink'}`}
            >
              <LayoutGrid size={20} />
              Catalogue
            </button>
            <button 
              onClick={() => setView('shelves')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${view === 'shelves' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-ink/40 hover:text-ink'}`}
            >
              <Box size={20} />
              Shelves
            </button>
          </div>
        </header>

        <main>
          <AnimatePresence mode="wait">
            {view === 'grid' ? (
              <motion.div
                key="grid"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <LibraryGrid 
                  books={books} 
                  onBookClick={handleBookClick} 
                  onAddClick={() => setIsRegistering(true)} 
                  selectedBookId={selectedBook?.id}
                />
              </motion.div>
            ) : (
              <motion.div
                key="shelves"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="h-[70vh] relative z-0 bg-ink/5 rounded-3xl border border-ink/10"
              >
                <Library2DShelf 
                  books={books} 
                  onBookClick={handleBookClick}
                  mode={getShelfMode()}
                  targetBook={targetBook}
                  onSlotSelect={handleSlotSelect}
                  onRenameShelf={renameBookshelf}
                />
                <div className="absolute bottom-8 right-8 flex flex-col gap-3 z-50 pointer-events-auto">
                  {selectMode && (
                    <button 
                      onClick={() => {
                        setSelectMode(false);
                        setIsRegistering(true);
                      }}
                      className="flex items-center gap-2 bg-surface text-ink px-6 py-3 rounded-xl font-bold hover:bg-ink/5 transition-all shadow-2xl"
                    >
                      <ArrowLeft size={20} />
                      Cancel Placement
                    </button>
                  )}
                  {locateMode && (
                    <button 
                      onClick={() => {
                        setLocateMode(false);
                        setTargetBook(undefined);
                      }}
                      className="flex items-center gap-2 bg-surface text-ink px-6 py-3 rounded-xl font-bold hover:bg-ink/5 transition-all shadow-2xl"
                    >
                      <ArrowLeft size={20} />
                      Exit Locate Mode
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {selectedBook && (
          <BookDetail 
            book={books.find(b => b.id === selectedBook.id) || selectedBook} 
            onClose={() => setSelectedBook(null)} 
            onLocate={handleLocate}
            onEdit={(book) => {
              setEditingBook(book);
              setSelectedBook(null);
            }}
          />
        )}
        {(isRegistering || editingBook) && (
          <div className={selectMode ? "hidden" : "contents"}>
            <BookRegistration 
              onClose={() => {
                setIsRegistering(false);
                setEditingBook(null);
                setPendingLocation(null);
              }}
              onSave={handleAddBook}
              onVisualSelect={() => {
                setSelectMode(true);
                setView('shelves');
              }}
              initialLocation={pendingLocation || undefined}
              existingBooks={books}
              onMoveBook={moveBook}
              editingBook={editingBook ? (books.find(b => b.id === editingBook.id) || editingBook) : undefined}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
