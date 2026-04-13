import React, { useState, useEffect } from 'react';
import { X, MapPin, Book as BookIcon, Calendar, Building, Hash, Navigation, HandHelping, RotateCcw, History, User, Quote, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, BorrowHistory } from '../../types/library';
import { db, updateDoc, doc, serverTimestamp, auth, handleFirestoreError, OperationType, collection, addDoc, query, where, getDocs, orderBy, onSnapshot } from '../../firebase';

interface BookDetailProps {
  book: Book;
  onClose: () => void;
  onLocate: (book: Book) => void;
  onEdit: (book: Book) => void;
}

export default function BookDetail({ book: initialBook, onClose, onLocate, onEdit }: BookDetailProps) {
  const [book, setBook] = useState<Book>(initialBook);
  const [isBorrowing, setIsBorrowing] = useState(false);
  const [history, setHistory] = useState<BorrowHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showBibtex, setShowBibtex] = useState(false);
  const [copied, setCopied] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    setBook(initialBook);
  }, [initialBook]);

  useEffect(() => {
    const bookRef = doc(db, 'books', initialBook.id);
    const unsubscribe = onSnapshot(bookRef, (doc) => {
      if (doc.exists()) {
        setBook({ id: doc.id, ...doc.data() } as Book);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `books/${initialBook.id}`, true));

    return () => unsubscribe();
  }, [initialBook.id]);

  useEffect(() => {
    const q = query(
      collection(db, 'borrow_history'), 
      where('bookId', '==', book.id),
      orderBy('borrowedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BorrowHistory[];
      setHistory(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'borrow_history', true));

    return () => unsubscribe();
  }, [book.id]);

  const handleBorrow = async () => {
    if (!user) return;
    setIsBorrowing(true);
    try {
      await updateDoc(doc(db, 'books', book.id), {
        borrowedBy: user.uid,
        borrowedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'borrow_history'), {
        bookId: book.id,
        userId: user.uid,
        userName: user.displayName || user.email || 'Anonymous',
        borrowedAt: serverTimestamp(),
        returnedAt: null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `books/${book.id}`);
    } finally {
      setIsBorrowing(false);
    }
  };

  const handleReturn = async () => {
    if (!user) return;
    setIsBorrowing(true);
    try {
      await updateDoc(doc(db, 'books', book.id), {
        borrowedBy: null,
        borrowedAt: null
      });

      const q = query(
        collection(db, 'borrow_history'),
        where('bookId', '==', book.id),
        where('userId', '==', user.uid),
        where('returnedAt', '==', null)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const historyDoc = snapshot.docs[0];
        await updateDoc(doc(db, 'borrow_history', historyDoc.id), {
          returnedAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `books/${book.id}`);
    } finally {
      setIsBorrowing(false);
    }
  };

  const generateBibtex = () => {
    const authors = book.authors 
      ? book.authors.map(a => `${a.lastName}, ${a.firstName}`).join(' and ')
      : book.author || 'Unknown';
    
    const year = book.year || 'n.d.';
    const firstAuthor = book.authors?.[0]?.lastName || book.author?.split(' ').pop() || 'unknown';
    const firstWord = book.title.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const citeKey = `${firstAuthor.toLowerCase()}${year}${firstWord}`;

    return `@book{${citeKey},
  title = {${book.title}},
  author = {${authors}},
  year = {${year}},
  publisher = {${book.publisher || 'Unknown'}},
  isbn = {${book.isbn || ''}}
}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isBorrowed = !!book.borrowedBy;
  const isBorrowedByMe = book.borrowedBy === user?.uid;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 md:p-8 overflow-y-auto custom-scrollbar">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-5xl bg-paper rounded-3xl overflow-hidden shadow-2xl border border-ink/10 my-auto"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-10 p-2 rounded-full bg-ink/10 hover:bg-ink/20 transition-colors text-ink"
        >
          <X size={24} />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr]">
          <div className="bg-ink/5 p-8 md:p-12 flex flex-col items-center justify-start border-b md:border-b-0 md:border-r border-ink/10">
            <div className="relative w-full aspect-[2/3] shadow-2xl rounded-xl overflow-hidden group">
              <img 
                src={book.coverUrl || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=800'} 
                alt={book.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              {book.spineColor && (
                <div 
                  className="absolute left-0 top-0 bottom-0 w-2 shadow-[2px_0_10px_rgba(0,0,0,0.5)] z-10"
                  style={{ backgroundColor: book.spineColor }}
                />
              )}
            </div>
            
            {book.spineColor && (
              <div className="mt-6 flex items-center gap-2 px-3 py-1.5 bg-ink/5 rounded-full border border-ink/10">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: book.spineColor }} />
                <span className="text-[10px] font-bold text-ink/40 uppercase tracking-widest">Custom Spine Color</span>
              </div>
            )}

            <button 
              onClick={() => setShowBibtex(!showBibtex)}
              className="mt-8 flex items-center gap-2 text-ink/40 hover:text-accent transition-colors text-[10px] font-black uppercase tracking-[0.2em] group"
            >
              <Quote size={14} className="group-hover:rotate-12 transition-transform" />
              Generate BibTeX
            </button>

            <AnimatePresence>
              {showBibtex && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-4 w-full p-4 bg-ink/5 rounded-xl border border-ink/10 relative group"
                >
                  <pre className="text-[10px] font-mono text-ink/60 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {generateBibtex()}
                  </pre>
                  <button 
                    onClick={() => copyToClipboard(generateBibtex())}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-ink/5 hover:bg-ink/10 text-ink/40 hover:text-ink transition-all"
                    title="Copy to clipboard"
                  >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="p-8 md:p-12 flex flex-col justify-between">
            <div className="space-y-8">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-accent font-bold text-sm uppercase tracking-widest">
                  <BookIcon size={16} />
                  {book.genre || 'General'}
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-ink leading-tight">{book.title}</h2>
                {book.subtitle && <p className="text-xl text-ink/40 font-medium italic">{book.subtitle}</p>}
                <div className="flex items-center gap-3">
                  <p className="text-xl text-ink/60 font-medium">
                    {book.authors ? book.authors.map(a => `${a.firstName} ${a.lastName}`).join(', ') : book.author}
                  </p>
                  {book.readingStatus && (
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      book.readingStatus === 'Currently Reading' ? 'bg-green-500/20 text-green-500' :
                      book.readingStatus === 'Finished' ? 'bg-blue-500/20 text-blue-500' :
                      'bg-orange-500/20 text-orange-500'
                    }`}>
                      {book.readingStatus}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-ink/40 text-xs font-bold uppercase tracking-widest">
                    <Building size={14} />
                    Publisher
                  </div>
                  <div className="text-ink font-medium">{book.publisher || 'Unknown'}</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-ink/40 text-xs font-bold uppercase tracking-widest">
                    <Calendar size={14} />
                    Year
                  </div>
                  <div className="text-ink font-medium">{book.year || 'Unknown'}</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-ink/40 text-xs font-bold uppercase tracking-widest">
                    <Hash size={14} />
                    ISBN
                  </div>
                  <div className="text-ink font-medium">{book.isbn || 'N/A'}</div>
                </div>
                {book.nfcTagId && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-ink/40 text-xs font-bold uppercase tracking-widest">
                      <Navigation size={14} />
                      NFC Tag
                    </div>
                    <div className="text-ink font-medium">{book.nfcTagId}</div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-ink/40 text-xs font-bold uppercase tracking-widest">
                  Description
                </div>
                <p className="text-ink/80 leading-relaxed text-lg line-clamp-6">
                  {book.description || 'No description available for this book.'}
                </p>
              </div>

              <div className="p-6 bg-ink/5 rounded-2xl border border-ink/10 space-y-4">
                <div className="flex items-center gap-2 text-accent font-bold text-xs uppercase tracking-widest">
                  <MapPin size={16} />
                  Physical Location
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <div className="text-[10px] text-ink/40 font-bold uppercase">Room</div>
                    <div className="text-ink font-bold">{book.location.room}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-ink/40 font-bold uppercase">Bookshelf</div>
                    <div className="text-ink font-bold">{book.location.bookshelf}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-ink/40 font-bold uppercase">Shelf</div>
                    <div className="text-ink font-bold">Level {book.location.shelfLevel}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-ink/40 font-bold uppercase">Position</div>
                    <div className="text-ink font-bold">Slot {book.location.position}</div>
                  </div>
                </div>
              </div>

              {isBorrowed && (
                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center gap-3">
                  <HandHelping size={20} className="text-orange-500" />
                  <div className="text-sm">
                    <span className="text-orange-500 font-bold">Currently Borrowed</span>
                    {isBorrowedByMe && <span className="text-ink/40 ml-2">(by you)</span>}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-2 text-ink/40 hover:text-ink transition-colors text-xs font-bold uppercase tracking-widest"
                >
                  <History size={14} />
                  Borrowing History
                </button>
                
                <AnimatePresence>
                  {showHistory && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 p-4 bg-ink/5 rounded-2xl border border-ink/10">
                        {history.length > 0 ? (
                          history.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-sm py-2 border-b border-ink/10 last:border-0">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-ink/10 flex items-center justify-center">
                                  <User size={14} className="text-ink/40" />
                                </div>
                                <div>
                                  <div className="text-ink font-medium">{item.userName}</div>
                                  <div className="text-[10px] text-ink/40 uppercase tracking-wider">
                                    {item.borrowedAt?.toDate().toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                {item.returnedAt ? (
                                  <span className="text-green-500/80 text-[10px] font-bold uppercase tracking-widest">Returned</span>
                                ) : (
                                  <span className="text-orange-500/80 text-[10px] font-bold uppercase tracking-widest animate-pulse">Active</span>
                                )}
                                <div className="text-[10px] text-ink/40 uppercase tracking-wider">
                                  {item.returnedAt ? item.returnedAt.toDate().toLocaleDateString() : 'In Use'}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 text-ink/40 text-xs italic">No borrowing history yet.</div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-12">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button 
                  onClick={() => onLocate(book)}
                  className="flex items-center justify-center gap-3 bg-accent hover:bg-accent/80 text-white py-5 rounded-2xl font-bold text-xl transition-all shadow-xl shadow-accent/20 group"
                >
                  <MapPin size={24} className="group-hover:-translate-y-1 transition-transform" />
                  Locate
                </button>

                {user && (
                  <button 
                    onClick={isBorrowedByMe ? handleReturn : handleBorrow}
                    disabled={isBorrowing || (isBorrowed && !isBorrowedByMe)}
                    className={`flex items-center justify-center gap-3 py-5 rounded-2xl font-bold text-xl transition-all shadow-xl group ${
                      isBorrowedByMe 
                        ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20' 
                        : isBorrowed 
                          ? 'bg-ink/10 text-ink/30 cursor-not-allowed opacity-50'
                          : 'bg-ink text-paper hover:bg-ink/90 shadow-ink/10'
                    }`}
                  >
                    {isBorrowedByMe ? (
                      <>
                        <RotateCcw size={24} className="group-hover:rotate-[-45deg] transition-transform" />
                        Return
                      </>
                    ) : (
                      <>
                        <HandHelping size={24} className="group-hover:-translate-x-1 transition-transform" />
                        {isBorrowed ? 'Borrowed' : 'Borrow'}
                      </>
                    )}
                  </button>
                )}
              </div>

              <button 
                onClick={() => onEdit(book)}
                className="w-full flex items-center justify-center gap-3 bg-ink/5 hover:bg-ink/10 text-ink py-4 rounded-2xl font-bold text-lg transition-all border border-ink/10"
              >
                Edit Book Details
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
