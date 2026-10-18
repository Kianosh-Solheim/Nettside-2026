import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { auth, db, doc, onSnapshot, updateDoc, serverTimestamp, handleFirestoreError, OperationType } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Phone, MapPin, User as UserIcon, Save, Plus, Trash2, Edit2, X, Check, XCircle, Mail } from 'lucide-react';
import Button from './ui/Button';
import PrivateRecommendations from './PrivateRecommendations';

interface UserPageData {
  userId: string;
  movieRecommendations?: { title: string; description: string; link: string; imageUrl?: string }[];
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
  const [contactForm, setContactForm] = useState({ email: '', phone: '', address: '', bio: '' });
  const [meetingForm, setMeetingForm] = useState({ title: '', date: '', notes: '' });
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

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
    const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      }
    });

    const pageDocRef = doc(db, 'user_pages', userId);
    const unsubscribePage = onSnapshot(pageDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserPageData;
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

  const handleAddMeeting = async () => {
    if (!userId || !pageData || !currentUser) return;
    
    if (!meetingForm.title || !meetingForm.date) {
      setStatus({ type: 'error', message: 'Please provide at least a title and a date.' });
      setTimeout(() => setStatus(null), 3000);
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

  const friendDisplayName =
    userProfile?.displayName?.trim() ||
    userProfile?.email?.split('@')[0] ||
    'Bruker';

  return (
    <div className="max-w-7xl mx-auto px-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-paper border border-ink/10 rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl"
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

        {/* Shared Recommendations (Same system as /a) */}
        <div className="mt-12 pt-12 border-t border-ink/10">
          {userId && (
            <PrivateRecommendations
              embeddedUserId={userId}
              embeddedFriendName={friendDisplayName}
              embeddedLegacyMovies={pageData?.movieRecommendations}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default UserPage;
