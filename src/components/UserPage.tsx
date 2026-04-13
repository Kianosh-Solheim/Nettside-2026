import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { auth, db, doc, onSnapshot, updateDoc, serverTimestamp, handleFirestoreError, OperationType, collection, query, where } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Film, Phone, MapPin, User as UserIcon, Save, Plus, Trash2, Edit2, ExternalLink, X, Check, XCircle, Mail, HandHelping, RotateCcw, BookOpen } from 'lucide-react';
import Button from './ui/Button';
import { Book } from '../types/library';

interface UserPageData {
  userId: string;
  movieRecommendations: { title: string; description: string; link: string; imageUrl?: string }[];
  meetings: { 
    id: string;
    title: string; 
    date: string; 
    notes: string;
    status: 'pending' | 'accepted' | 'rejected';
    suggestedBy: string;
    updatedAt?: any;
  }[];
  contactInfo: {
    email: string;
    phone: string;
    address: string;
    bio: string;
  };
  updatedAt: any;
}

interface UserProfile {
  email: string;
  displayName: string;
  role: string;
  approved: boolean;
}

const UserPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [pageData, setPageData] = useState<UserPageData | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [isAddingMeeting, setIsAddingMeeting] = useState(false);
  const [editingMeetingIndex, setEditingMeetingIndex] = useState<number | null>(null);
  const [isAddingMovie, setIsAddingMovie] = useState(false);
  const [editingMovieIndex, setEditingMovieIndex] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({ email: '', phone: '', address: '', bio: '' });
  const [meetingForm, setMeetingForm] = useState({ title: '', date: '', notes: '' });
  const [movieForm, setMovieForm] = useState({ title: '', description: '', link: '', imageUrl: '' });
  const [movieSearchResults, setMovieSearchResults] = useState<any[]>([]);
  const [isSearchingMovies, setIsSearchingMovies] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [borrowedBooks, setBorrowedBooks] = useState<Book[]>([]);
  const [isReturning, setIsReturning] = useState<string | null>(null);

  const isAdmin = currentUser?.email === 'kianoshsolheim@gmail.com' || currentUser?.email === 'kianosh@solheim.online';
  const isOwner = currentUser?.uid === userId;

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const userDocRef = doc(db, 'users', userId);
    const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        setUserProfile(doc.data() as UserProfile);
      }
    });

    const pageDocRef = doc(db, 'user_pages', userId);
    const unsubscribePage = onSnapshot(pageDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as UserPageData;
        setPageData(data);
        setContactForm(data.contactInfo);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `user_pages/${userId}`);
      setLoading(false);
    });

    return () => {
      unsubscribeUser();
      unsubscribePage();
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const q = query(collection(db, 'books'), where('borrowedBy', '==', userId));
    const unsubscribeBorrowed = onSnapshot(q, (snapshot) => {
      const books = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Book[];
      setBorrowedBooks(books);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'books'));

    return () => unsubscribeBorrowed();
  }, [userId]);

  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;
  if (!pageData && !loading) return <div className="flex justify-center items-center h-screen text-red-500">User page not found.</div>;
  if (!isAdmin && !isOwner) return <div className="flex justify-center items-center h-screen text-red-500">Unauthorized access.</div>;

  const handleUpdateContact = async () => {
    if (!userId) return;
    try {
      await updateDoc(doc(db, 'user_pages', userId), {
        contactInfo: contactForm,
        updatedAt: serverTimestamp()
      });
      setIsEditingContact(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `user_pages/${userId}`);
    }
  };

  const handleSearchMovies = async () => {
    if (!movieForm.title) return;
    setIsSearchingMovies(true);
    try {
      const omdbKey = import.meta.env.VITE_OMDB_API_KEY;
      const response = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(movieForm.title)}&type=movie&apikey=${omdbKey || 'b054da29'}`);
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
      setTimeout(() => setStatus(null), 3000);
    } finally {
      setIsSearchingMovies(false);
    }
  };

  const handleAddMovie = async () => {
    if (!userId || !pageData) return;
    
    if (!movieForm.title) {
      alert("Please provide at least a title.");
      return;
    }

    try {
      const newList = editingMovieIndex !== null 
        ? pageData.movieRecommendations.map((m, i) => i === editingMovieIndex ? movieForm : m)
        : [...pageData.movieRecommendations, movieForm];

      await updateDoc(doc(db, 'user_pages', userId), {
        movieRecommendations: newList,
        updatedAt: serverTimestamp()
      });
      setIsAddingMovie(false);
      setEditingMovieIndex(null);
      setMovieForm({ title: '', description: '', link: '', imageUrl: '' });
      setMovieSearchResults([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `user_pages/${userId}`);
    }
  };

  const handleEditMovie = (index: number) => {
    const movie = pageData!.movieRecommendations[index];
    setMovieForm({
      title: movie.title,
      description: movie.description,
      link: movie.link,
      imageUrl: movie.imageUrl || ''
    });
    setEditingMovieIndex(index);
    setIsAddingMovie(true);
  };

  const handleRemoveMovie = async (index: number) => {
    if (!userId || !pageData) return;
    const newList = [...pageData.movieRecommendations];
    newList.splice(index, 1);
    try {
      await updateDoc(doc(db, 'user_pages', userId), {
        movieRecommendations: newList,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `user_pages/${userId}`);
    }
  };

  const handleAddMeeting = async () => {
    if (!userId || !pageData || !currentUser) return;
    
    if (!meetingForm.title || !meetingForm.date) {
      alert("Please provide at least a title and a date.");
      return;
    }

    try {
      const newMeeting = {
        id: editingMeetingIndex !== null ? pageData.meetings[editingMeetingIndex].id : Math.random().toString(36).substr(2, 9),
        title: meetingForm.title,
        date: meetingForm.date,
        notes: meetingForm.notes,
        status: editingMeetingIndex !== null ? pageData.meetings[editingMeetingIndex].status : 'pending',
        suggestedBy: editingMeetingIndex !== null ? pageData.meetings[editingMeetingIndex].suggestedBy : currentUser.uid,
        updatedAt: new Date().toISOString()
      };

      const newList = editingMeetingIndex !== null
        ? pageData.meetings.map((m, i) => i === editingMeetingIndex ? newMeeting : m)
        : [...pageData.meetings, newMeeting];

      await updateDoc(doc(db, 'user_pages', userId), {
        meetings: newList,
        updatedAt: serverTimestamp()
      });
      setIsAddingMeeting(false);
      setEditingMeetingIndex(null);
      setMeetingForm({ title: '', date: '', notes: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `user_pages/${userId}`);
    }
  };

  const handleMeetingStatus = async (index: number, status: 'accepted' | 'rejected') => {
    if (!userId || !pageData || !currentUser) return;
    
    const newList = [...pageData.meetings];
    newList[index] = {
      ...newList[index],
      status,
      updatedAt: new Date().toISOString()
    };

    try {
      await updateDoc(doc(db, 'user_pages', userId), {
        meetings: newList,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `user_pages/${userId}`);
    }
  };

  const handleEditMeeting = (index: number) => {
    setMeetingForm(pageData!.meetings[index]);
    setEditingMeetingIndex(index);
    setIsAddingMeeting(true);
  };

  const handleRemoveMeeting = async (index: number) => {
    if (!userId || !pageData) return;
    const newList = [...pageData.meetings];
    newList.splice(index, 1);
    try {
      await updateDoc(doc(db, 'user_pages', userId), {
        meetings: newList,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `user_pages/${userId}`);
    }
  };

  const handleReturnBook = async (bookId: string) => {
    setIsReturning(bookId);
    try {
      await updateDoc(doc(db, 'books', bookId), {
        borrowedBy: null,
        borrowedAt: null
      });
      setStatus({ type: 'success', message: 'Book returned successfully!' });
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `books/${bookId}`);
    } finally {
      setIsReturning(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-paper border border-ink/10 rounded-3xl p-8 shadow-xl"
      >
        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`mb-6 p-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 ${
                status.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
              }`}
            >
              {status.type === 'success' ? <Check size={14} /> : <X size={14} />}
              {status.message}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-ink/5 flex items-center justify-center">
              <UserIcon className="text-ink/40" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-serif font-bold text-ink">
                {userProfile?.displayName || 'User Page'}
              </h1>
              <p className="text-ink/60">{userProfile?.email}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Contact Info */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-serif font-semibold flex items-center gap-2 text-ink">
                <Phone size={20} className="text-accent" />
                Contact Information
              </h2>
              {(isOwner || isAdmin) && (
                <Button
                  onClick={() => isEditingContact ? handleUpdateContact() : setIsEditingContact(true)}
                  variant="ghost"
                  size="sm"
                  magnetic={true}
                  className="text-accent hover:underline"
                  icon={isEditingContact ? Save : Edit2}
                >
                  {isEditingContact ? 'Save' : 'Edit'}
                </Button>
              )}
            </div>
            
            <div className="space-y-4">
              {isEditingContact ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-ink/40 uppercase tracking-widest">Email</label>
                    <input
                      type="email"
                      placeholder="Email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      className="w-full p-3 rounded-xl border border-ink/10 bg-transparent focus:ring-1 focus:ring-accent outline-none transition-all text-sm text-ink"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-ink/40 uppercase tracking-widest">Phone</label>
                    <input
                      type="text"
                      placeholder="Phone"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                      className="w-full p-3 rounded-xl border border-ink/10 bg-transparent focus:ring-1 focus:ring-accent outline-none transition-all text-sm text-ink"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-ink/40 uppercase tracking-widest">Address</label>
                    <input
                      type="text"
                      placeholder="Address"
                      value={contactForm.address}
                      onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })}
                      className="w-full p-3 rounded-xl border border-ink/10 bg-transparent focus:ring-1 focus:ring-accent outline-none transition-all text-sm text-ink"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-ink/40 uppercase tracking-widest">Bio</label>
                    <textarea
                      placeholder="Bio"
                      value={contactForm.bio}
                      onChange={(e) => setContactForm({ ...contactForm, bio: e.target.value })}
                      className="w-full p-3 rounded-xl border border-ink/10 bg-transparent h-24 focus:ring-1 focus:ring-accent outline-none transition-all resize-none text-sm text-ink"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-ink/60">
                    <Mail size={18} className="text-ink/30" />
                    <span className="text-sm">{pageData?.contactInfo.email || 'No email provided'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-ink/60">
                    <Phone size={18} className="text-ink/30" />
                    <span className="text-sm">{pageData?.contactInfo.phone || 'No phone provided'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-ink/60">
                    <MapPin size={18} className="text-ink/30" />
                    <span className="text-sm">{pageData?.contactInfo.address || 'No address provided'}</span>
                  </div>
                  <div className="p-4 bg-ink/5 rounded-2xl border border-ink/5">
                    <p className="text-sm italic text-ink/50 leading-relaxed">
                      {pageData?.contactInfo.bio || 'No bio provided'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Meetings */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-serif font-semibold flex items-center gap-2 text-ink">
                <Calendar size={20} className="text-accent" />
                Meeting Schedule
              </h2>
              {(isAdmin || isOwner) && (
                <Button
                  onClick={() => {
                    if (isAddingMeeting) {
                      setEditingMeetingIndex(null);
                      setMeetingForm({ title: '', date: '', notes: '' });
                    }
                    setIsAddingMeeting(!isAddingMeeting);
                  }}
                  variant={isAddingMeeting ? "ghost" : "primary"}
                  size="sm"
                  magnetic={true}
                  className={`shadow-lg ${isAddingMeeting ? 'bg-ink/10 text-ink' : 'bg-accent text-paper shadow-accent/20'}`}
                  icon={isAddingMeeting ? X : Plus}
                />
              )}
            </div>

            <AnimatePresence>
              {isAddingMeeting && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 bg-ink/5 rounded-2xl border border-ink/5 space-y-4 mb-6">
                    <h3 className="text-xs font-serif font-bold text-accent uppercase tracking-widest">
                      {editingMeetingIndex !== null ? 'Edit Meeting' : 'Schedule New Meeting'}
                    </h3>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-ink/40 uppercase tracking-widest">Meeting Title</label>
                      <input
                        type="text"
                        placeholder="e.g., Strategy Session"
                        value={meetingForm.title}
                        onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-ink/10 bg-transparent focus:ring-1 focus:ring-accent outline-none transition-all text-sm text-ink"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-ink/40 uppercase tracking-widest">Date & Time</label>
                      <input
                        type="datetime-local"
                        value={meetingForm.date}
                        onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-ink/10 bg-transparent focus:ring-1 focus:ring-accent outline-none transition-all text-sm text-ink"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-ink/40 uppercase tracking-widest">Notes (Optional)</label>
                      <textarea
                        placeholder="Add any details..."
                        value={meetingForm.notes}
                        onChange={(e) => setMeetingForm({ ...meetingForm, notes: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-ink/10 bg-transparent h-20 focus:ring-1 focus:ring-accent outline-none transition-all resize-none text-sm text-ink"
                      />
                    </div>
                    <Button
                      onClick={handleAddMeeting}
                      magnetic={true}
                      className="w-full bg-accent text-paper py-3"
                    >
                      {editingMeetingIndex !== null ? 'Update Meeting' : 'Schedule Meeting'}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              {pageData?.meetings && pageData.meetings.length > 0 ? (
                pageData.meetings.map((meeting, idx) => {
                  const isSuggestedByMe = meeting.suggestedBy === currentUser?.uid;
                  const canRespond = !isSuggestedByMe && meeting.status === 'pending';

                  return (
                    <div key={idx} className="p-4 border border-ink/5 rounded-2xl relative group hover:bg-ink/5 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-ink">{meeting.title}</h3>
                          <p className="text-[10px] uppercase tracking-widest text-accent font-medium mt-1">
                            {new Date(meeting.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </div>
                        <div className={`px-2 py-1 rounded text-[8px] uppercase tracking-widest font-bold ${
                          meeting.status === 'accepted' ? 'bg-green-500/10 text-green-500' :
                          meeting.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                          'bg-yellow-500/10 text-yellow-500'
                        }`}>
                          {meeting.status}
                        </div>
                      </div>
                      
                      {meeting.notes && <p className="text-sm mt-3 text-ink/60 leading-relaxed">{meeting.notes}</p>}
                      
                      {canRespond ? (
                        <div className="mt-4 flex gap-2">
                          <Button
                            onClick={() => handleMeetingStatus(idx, 'accepted')}
                            size="sm"
                            className="bg-green-500 text-white py-1 px-3 text-[10px]"
                            icon={Check}
                          >
                            Accept
                          </Button>
                          <Button
                            onClick={() => handleMeetingStatus(idx, 'rejected')}
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:bg-red-50 py-1 px-3 text-[10px]"
                            icon={XCircle}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : meeting.status === 'pending' && isSuggestedByMe ? (
                        <div className="mt-4">
                          <span className="text-[10px] uppercase tracking-widest text-ink/30 font-bold italic">Awaiting admin response</span>
                        </div>
                      ) : null}

                      {(isAdmin || (isOwner && isSuggestedByMe && meeting.status === 'pending')) && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            onClick={() => handleEditMeeting(idx)}
                            variant="ghost"
                            size="sm"
                            magnetic={true}
                            className="text-accent hover:bg-accent/10"
                            icon={Edit2}
                          />
                          <Button
                            onClick={() => handleRemoveMeeting(idx)}
                            variant="ghost"
                            size="sm"
                            magnetic={true}
                            className="text-red-500 hover:bg-red-500/10"
                            icon={Trash2}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-ink/30 text-xs italic py-4 uppercase tracking-widest">No meetings scheduled yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Borrowed Books */}
        <div className="mt-12 pt-12 border-t border-ink/10">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-serif font-semibold flex items-center gap-2 text-ink">
              <HandHelping size={20} className="text-accent" />
              My Borrowed Books
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {borrowedBooks.length > 0 ? (
              borrowedBooks.map((book) => (
                <div key={book.id} className="bg-ink/5 rounded-3xl border border-ink/5 overflow-hidden flex flex-col group hover:ring-1 hover:ring-accent/20 transition-all">
                  <div className="flex gap-4 p-4">
                    <div className="w-20 h-28 flex-shrink-0 rounded-xl overflow-hidden shadow-md">
                      <img 
                        src={book.coverUrl || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=200'} 
                        alt={book.title} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-grow min-w-0 flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-ink truncate font-serif">{book.title}</h3>
                        <p className="text-xs text-ink/60 truncate">
                          {book.authors ? book.authors.map(a => `${a.firstName} ${a.lastName}`).join(', ') : book.author}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-accent font-bold uppercase tracking-widest mt-2">
                          <MapPin size={10} />
                          {book.location.room}
                        </div>
                      </div>
                      
                      {isOwner && (
                        <Button
                          onClick={() => handleReturnBook(book.id)}
                          isLoading={isReturning === book.id}
                          size="sm"
                          variant="outline"
                          className="mt-2 text-[10px] py-1 border-accent/20 text-accent hover:bg-accent/5"
                          icon={RotateCcw}
                        >
                          Return Book
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full p-8 bg-ink/5 rounded-3xl border border-dashed border-ink/10 flex flex-col items-center justify-center text-center">
                <BookOpen size={32} className="text-ink/20 mb-3" />
                <p className="text-ink/30 text-xs italic uppercase tracking-widest">You haven't borrowed any books yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Movie Recommendations */}
        <div className="mt-12 pt-12 border-t border-ink/10">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-serif font-semibold flex items-center gap-2 text-ink">
              <Film size={20} className="text-accent" />
              Personalized Movie Recommendations
            </h2>
            {isAdmin && (
              <Button
                onClick={() => {
                  if (isAddingMovie) {
                    setEditingMovieIndex(null);
                    setMovieForm({ title: '', description: '', link: '', imageUrl: '' });
                    setMovieSearchResults([]);
                  }
                  setIsAddingMovie(!isAddingMovie);
                }}
                variant={isAddingMovie ? "ghost" : "primary"}
                size="sm"
                magnetic={true}
                className={`shadow-lg ${isAddingMovie ? 'bg-ink/10 text-ink' : 'bg-accent text-paper shadow-accent/20'}`}
                icon={isAddingMovie ? X : Plus}
              />
            )}
          </div>

          <AnimatePresence>
            {isAddingMovie && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 bg-ink/5 rounded-3xl border border-ink/5 space-y-6 mb-8">
                  <h3 className="text-xs font-serif font-bold text-accent uppercase tracking-widest">
                    {editingMovieIndex !== null ? 'Edit Recommendation' : 'Add New Recommendation'}
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <div className="flex-grow space-y-1">
                        <label className="text-[10px] font-medium text-ink/40 uppercase tracking-widest">Movie Title</label>
                        <input
                          type="text"
                          placeholder="e.g., Inception"
                          value={movieForm.title}
                          onChange={(e) => setMovieForm({ ...movieForm, title: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearchMovies()}
                          className="w-full p-2.5 rounded-xl border border-ink/10 bg-transparent focus:ring-1 focus:ring-accent outline-none transition-all text-sm text-ink"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          onClick={handleSearchMovies}
                          variant="outline"
                          className="h-[42px] border-accent/20 text-accent hover:bg-accent/5"
                          isLoading={isSearchingMovies}
                        >
                          Search
                        </Button>
                      </div>
                    </div>

                    {movieSearchResults.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-medium text-ink/40 uppercase tracking-widest">Select a Cover</label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-2 bg-white/50 rounded-2xl border border-ink/5">
                          {movieSearchResults.map((result, idx) => {
                            const posterUrl = result.Poster !== 'N/A' ? result.Poster : '';
                            const isSelected = movieForm.imageUrl === posterUrl;
                            if (!posterUrl) return null;
                            return (
                              <button
                                key={idx}
                                onClick={() => setMovieForm({ 
                                  ...movieForm, 
                                  imageUrl: posterUrl,
                                  title: result.Title || movieForm.title,
                                  link: `https://www.imdb.com/title/${result.imdbID}`
                                })}
                                className={`relative aspect-[2/3] rounded-lg overflow-hidden border-2 transition-all ${
                                  isSelected ? 'border-accent ring-2 ring-accent/20 scale-95' : 'border-transparent hover:border-accent/30'
                                }`}
                              >
                                <img 
                                  src={posterUrl} 
                                  alt={result.Title} 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                                {isSelected && (
                                  <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                                    <Check className="text-white" size={20} />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-ink/40 uppercase tracking-widest">Selected Image URL</label>
                        <input
                          type="text"
                          placeholder="https://..."
                          value={movieForm.imageUrl}
                          onChange={(e) => setMovieForm({ ...movieForm, imageUrl: e.target.value })}
                          className="w-full p-2.5 rounded-xl border border-ink/10 bg-transparent focus:ring-1 focus:ring-accent outline-none transition-all text-sm text-ink"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-ink/40 uppercase tracking-widest">Link (Optional)</label>
                        <input
                          type="text"
                          placeholder="https://..."
                          value={movieForm.link}
                          onChange={(e) => setMovieForm({ ...movieForm, link: e.target.value })}
                          className="w-full p-2.5 rounded-xl border border-ink/10 bg-transparent focus:ring-1 focus:ring-accent outline-none transition-all text-sm text-ink"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-ink/40 uppercase tracking-widest">Description</label>
                      <textarea
                        placeholder="Why do you recommend this?"
                        value={movieForm.description}
                        onChange={(e) => setMovieForm({ ...movieForm, description: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-ink/10 bg-transparent h-24 focus:ring-1 focus:ring-accent outline-none transition-all resize-none text-sm text-ink"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleAddMovie}
                    magnetic={true}
                    className="w-full bg-accent text-paper py-3"
                  >
                    {editingMovieIndex !== null ? 'Update Recommendation' : 'Add Recommendation'}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {pageData?.movieRecommendations && pageData.movieRecommendations.length > 0 ? (
              pageData.movieRecommendations.map((movie, idx) => (
                <div key={idx} className="bg-ink/5 rounded-3xl relative group hover:ring-1 hover:ring-accent/20 transition-all border border-ink/5 overflow-hidden flex flex-col">
                  {movie.imageUrl && (
                    <div className="aspect-video w-full overflow-hidden">
                      <img 
                        src={movie.imageUrl} 
                        alt={movie.title} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <div className="p-6 flex-grow">
                    <h3 className="font-bold text-lg text-ink font-serif">{movie.title}</h3>
                    <p className="text-sm text-ink/60 mt-2 leading-relaxed">{movie.description}</p>
                    {movie.link && (
                      <a
                        href={movie.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] uppercase tracking-widest font-semibold text-accent hover:underline mt-4 inline-flex items-center gap-1 transition-colors"
                      >
                        Watch Trailer / More Info
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        onClick={() => handleEditMovie(idx)}
                        variant="ghost"
                        size="sm"
                        magnetic={true}
                        className="text-accent hover:bg-accent/10"
                        icon={Edit2}
                      />
                      <Button
                        onClick={() => handleRemoveMovie(idx)}
                        variant="ghost"
                        size="sm"
                        magnetic={true}
                        className="text-red-500 hover:bg-red-500/10"
                        icon={Trash2}
                      />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-ink/30 text-xs italic col-span-full py-4 uppercase tracking-widest">No recommendations yet.</p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default UserPage;
