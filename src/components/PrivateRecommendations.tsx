import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Book,
  Film,
  Tv,
  ExternalLink,
  Video,
  Plus,
  Search,
  X,
  Check,
  Edit2,
  Trash2,
  Save,
  Podcast,
  Music,
  Globe,
  FileText,
  Sparkles,
  PhoneCall,
  Star,
  Unlock,
  KeyRound,
  CheckCircle2,
  Clock,
  Circle,
  MessageSquareQuote,
  Copy,
  Eye,
  EyeOff,
  UserCheck,
  LogOut
} from 'lucide-react';
import {
  db,
  collection,
  onSnapshot,
  query,
  orderBy,
  handleFirestoreError,
  OperationType,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
  auth
} from '../firebase';
import Button from './ui/Button';

export type RecommendationType =
  | 'Movie'
  | 'TV Series'
  | 'YouTube Video'
  | 'Documentary'
  | 'Book'
  | 'Article'
  | 'Podcast'
  | 'Music'
  | 'Website'
  | 'Other';

export type RecommendationStatus =
  | 'Not Seen'
  | 'Planning to Watch/Read/Listen'
  | 'Seen/Finished';

export type RecommendedByRole = 'owner' | 'friend';

export interface PrivateRecommendationItem {
  id: string;
  title: string;
  type: RecommendationType;
  recommendedBy: RecommendedByRole;
  dateRecommended: string; // YYYY-MM-DD
  callDate: string; // YYYY-MM-DD
  link?: string;
  description?: string; // Short description or note from the call
  status: RecommendationStatus;
  review?: string; // Personal comment or review after seeing/reading/listening
  rating?: number | null; // Optional 1-5 rating
  creator?: string; // Optional author / director / channel
  imageUrl?: string; // Optional cover / thumbnail
  completedAt?: string | null;
  createdAt?: any;
  updatedAt?: any;
}

interface RecommendationsConfig {
  password: string;
  ownerName: string;
  friendName: string;
}

export const RECOMMENDATION_TYPES: RecommendationType[] = [
  'Movie',
  'TV Series',
  'YouTube Video',
  'Documentary',
  'Book',
  'Article',
  'Podcast',
  'Music',
  'Website',
  'Other'
];

export const RECOMMENDATION_STATUSES: RecommendationStatus[] = [
  'Not Seen',
  'Planning to Watch/Read/Listen',
  'Seen/Finished'
];

const DEFAULT_CONFIG: RecommendationsConfig = {
  password: 'bergen',
  ownerName: 'Kianosh',
  friendName: 'My Friend'
};

const STORAGE_UNLOCK_KEY = 'private_recommendations_unlocked_v1';
const STORAGE_ROLE_KEY = 'private_recommendations_active_role_v1';
const COLLECTION_NAME = 'private_recommendations';

function getTodayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function normalizeRecommendation(id: string, docData: any): PrivateRecommendationItem {
  let fallbackDate = getTodayIso();
  if (docData.createdAt?.toDate) {
    try {
      fallbackDate = docData.createdAt.toDate().toISOString().split('T')[0];
    } catch {
      // ignore
    }
  }

  const normalizedType: RecommendationType = RECOMMENDATION_TYPES.includes(docData.type)
    ? docData.type
    : 'Other';
  const recommendedBy: RecommendedByRole =
    docData.recommendedBy === 'friend' ? 'friend' : 'owner';
  const status: RecommendationStatus = RECOMMENDATION_STATUSES.includes(docData.status)
    ? docData.status
    : 'Not Seen';

  return {
    id,
    title: docData.title || 'Untitled',
    type: normalizedType,
    recommendedBy,
    dateRecommended: docData.dateRecommended || fallbackDate,
    callDate: docData.callDate || docData.dateRecommended || fallbackDate,
    link: docData.link || '',
    description: docData.description || '',
    status,
    review: docData.review || '',
    rating: typeof docData.rating === 'number' && docData.rating >= 1 && docData.rating <= 5 ? docData.rating : null,
    creator: docData.creator || docData.author || '',
    imageUrl: docData.imageUrl || '',
    completedAt: docData.completedAt || null,
    createdAt: docData.createdAt,
    updatedAt: docData.updatedAt
  };
}

function formatReadableDate(isoDate?: string): string {
  if (!isoDate) return 'Unknown date';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(dateObj.getTime())) return isoDate;
  return dateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export default function PrivateRecommendations() {
  const location = useLocation();
  const [recommendations, setRecommendations] = useState<PrivateRecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Config & Password Gate state
  const [config, setConfig] = useState<RecommendationsConfig>(DEFAULT_CONFIG);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isFriendUnlocked, setIsFriendUnlocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_UNLOCK_KEY) !== null;
    } catch {
      return false;
    }
  });

  // Active identity ('owner' or 'friend') so "Things I Still Need to Check Out" adapts naturally
  const [activePerson, setActivePerson] = useState<RecommendedByRole>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ROLE_KEY);
      if (saved === 'owner' || saved === 'friend') return saved;
    } catch {
      // ignore
    }
    return 'friend';
  });

  // Settings Modal (for Owner to manage password & participant names)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState<RecommendationsConfig>(DEFAULT_CONFIG);
  const [showPasswordInSettings, setShowPasswordInSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // View Mode: 'overview' | 'browse' | 'calls'
  const [viewMode, setViewMode] = useState<'overview' | 'browse' | 'calls'>('overview');

  // Search, Filter & Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedRecommender, setSelectedRecommender] = useState<'all' | 'owner' | 'friend'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'unfinished' | RecommendationStatus>('all');
  const [selectedCallDate, setSelectedCallDate] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'call-newest' | 'call-oldest' | 'rating' | 'title'>('newest');

  // Add / Edit Form Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    title: string;
    type: RecommendationType;
    recommendedBy: RecommendedByRole;
    dateRecommended: string;
    callDate: string;
    link: string;
    description: string;
    status: RecommendationStatus;
    review: string;
    rating: number | null;
    creator: string;
    imageUrl: string;
  }>({
    title: '',
    type: 'Movie',
    recommendedBy: 'owner',
    dateRecommended: getTodayIso(),
    callDate: getTodayIso(),
    link: '',
    description: '',
    status: 'Not Seen',
    review: '',
    rating: null,
    creator: '',
    imageUrl: ''
  });

  // Quick Follow-up / Review Modal state
  const [reviewingItem, setReviewingItem] = useState<PrivateRecommendationItem | null>(null);
  const [reviewFormData, setReviewFormData] = useState<{
    status: RecommendationStatus;
    rating: number | null;
    review: string;
  }>({
    status: 'Seen/Finished',
    rating: null,
    review: ''
  });

  // Detail Modal state
  const [selectedItem, setSelectedItem] = useState<PrivateRecommendationItem | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Optional Media Lookup Helpers (Movies/Shows/Books/Podcasts)
  const [isSearchingMedia, setIsSearchingMedia] = useState(false);
  const [mediaResults, setMediaResults] = useState<Array<{
    title: string;
    creator: string;
    link: string;
    imageUrl: string;
  }>>([]);

  // Check Auth State
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      const ownerMatch =
        user?.email === 'kianoshsolheim@gmail.com' ||
        user?.email === 'kianosh@solheim.online';
      setIsAdmin(ownerMatch);
      if (ownerMatch) {
        setActivePerson('owner');
      }
      setAuthChecked(true);
    });
    return () => unsubscribeAuth();
  }, []);

  // Load Config from Firestore (recommendations_settings/config)
  useEffect(() => {
    const unsubConfig = onSnapshot(
      doc(db, 'recommendations_settings', 'config'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const loaded: RecommendationsConfig = {
            password: data.password || DEFAULT_CONFIG.password,
            ownerName: data.ownerName || DEFAULT_CONFIG.ownerName,
            friendName: data.friendName || DEFAULT_CONFIG.friendName
          };
          setConfig(loaded);
          setSettingsForm(loaded);

          // Verify stored unlock password or URL query parameter
          try {
            const params = new URLSearchParams(location.search);
            const urlKey = params.get('key') || params.get('password');
            const storedPw = localStorage.getItem(STORAGE_UNLOCK_KEY);
            if (urlKey && urlKey.trim() === loaded.password.trim()) {
              localStorage.setItem(STORAGE_UNLOCK_KEY, loaded.password.trim());
              setIsFriendUnlocked(true);
            } else if (storedPw && storedPw === loaded.password) {
              setIsFriendUnlocked(true);
            } else if (storedPw && storedPw !== loaded.password) {
              localStorage.removeItem(STORAGE_UNLOCK_KEY);
              setIsFriendUnlocked(false);
            }
          } catch {
            // ignore storage errors
          }
        } else {
          setConfig(DEFAULT_CONFIG);
          setSettingsForm(DEFAULT_CONFIG);
        }
        setConfigLoaded(true);
      },
      (error) => {
        console.warn('Could not load recommendations config, using defaults:', error);
        setConfigLoaded(true);
      }
    );

    return () => unsubConfig();
  }, [location.search]);

  const hasAccess = isAdmin || isFriendUnlocked;

  // Load Private Recommendations once unlocked or if owner
  useEffect(() => {
    if (!authChecked || !configLoaded) return;
    if (!hasAccess) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const unsubscribeRecs = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) =>
          normalizeRecommendation(docSnap.id, docSnap.data())
        );
        setRecommendations(items);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
        setLoading(false);
      }
    );

    return () => unsubscribeRecs();
  }, [authChecked, configLoaded, hasAccess]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setStatusBanner({ type, message });
    setTimeout(() => setStatusBanner(null), 3500);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.trim() === config.password.trim()) {
      try {
        localStorage.setItem(STORAGE_UNLOCK_KEY, config.password.trim());
        localStorage.setItem(STORAGE_ROLE_KEY, 'friend');
      } catch {
        // ignore
      }
      setIsFriendUnlocked(true);
      setActivePerson('friend');
      setPasswordError('');
      setPasswordInput('');
    } else {
      setPasswordError('Incorrect password. Ask Kianosh for the shared password.');
    }
  };

  const handleLockSpace = () => {
    try {
      localStorage.removeItem(STORAGE_UNLOCK_KEY);
    } catch {
      // ignore
    }
    setIsFriendUnlocked(false);
  };

  const handleSwitchPerson = (role: RecommendedByRole) => {
    setActivePerson(role);
    try {
      localStorage.setItem(STORAGE_ROLE_KEY, role);
    } catch {
      // ignore
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm.password.trim()) {
      showToast('error', 'Password cannot be empty.');
      return;
    }
    setIsSavingSettings(true);
    try {
      await setDoc(
        doc(db, 'recommendations_settings', 'config'),
        {
          password: settingsForm.password.trim(),
          ownerName: settingsForm.ownerName.trim() || 'Kianosh',
          friendName: settingsForm.friendName.trim() || 'My Friend',
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      setIsSettingsOpen(false);
      showToast('success', 'Shared space settings and password updated.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'recommendations_settings/config');
      showToast('error', 'Failed to save settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const getPersonName = (role: RecommendedByRole) =>
    role === 'owner' ? config.ownerName : config.friendName;

  const openAddModal = (prefillCallDate?: string) => {
    setEditingId(null);
    setMediaResults([]);
    setFormData({
      title: '',
      type: 'Movie',
      recommendedBy: activePerson,
      dateRecommended: getTodayIso(),
      callDate: prefillCallDate || getTodayIso(),
      link: '',
      description: '',
      status: 'Not Seen',
      review: '',
      rating: null,
      creator: '',
      imageUrl: ''
    });
    setIsFormOpen(true);
  };

  const openEditModal = (rec: PrivateRecommendationItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingId(rec.id);
    setMediaResults([]);
    setFormData({
      title: rec.title,
      type: rec.type,
      recommendedBy: rec.recommendedBy,
      dateRecommended: rec.dateRecommended || getTodayIso(),
      callDate: rec.callDate || rec.dateRecommended || getTodayIso(),
      link: rec.link || '',
      description: rec.description || '',
      status: rec.status || 'Not Seen',
      review: rec.review || '',
      rating: rec.rating ?? null,
      creator: rec.creator || '',
      imageUrl: rec.imageUrl || ''
    });
    setIsFormOpen(true);
  };

  const openReviewModal = (rec: PrivateRecommendationItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReviewingItem(rec);
    setReviewFormData({
      status: rec.status === 'Not Seen' ? 'Seen/Finished' : rec.status,
      rating: rec.rating ?? null,
      review: rec.review || ''
    });
  };

  const handleQuickMediaLookup = async () => {
    if (!formData.title.trim()) return;
    setIsSearchingMedia(true);
    setMediaResults([]);
    try {
      const q = encodeURIComponent(formData.title.trim());
      if (formData.type === 'Movie' || formData.type === 'TV Series' || formData.type === 'Documentary') {
        const omdbKey = import.meta.env.VITE_OMDB_API_KEY || 'b054da29';
        const actualKey = omdbKey.includes('apikey=')
          ? omdbKey.split('apikey=')[1].split('&')[0]
          : omdbKey;
        const omdbType = formData.type === 'TV Series' ? 'series' : 'movie';
        const res = await fetch(`https://www.omdbapi.com/?s=${q}&type=${omdbType}&apikey=${actualKey}`);
        const data = await res.json();
        if (data.Search && Array.isArray(data.Search)) {
          setMediaResults(
            data.Search.slice(0, 6).map((item: any) => ({
              title: item.Title || formData.title,
              creator: item.Year || '',
              link: item.imdbID ? `https://www.imdb.com/title/${item.imdbID}` : '',
              imageUrl: item.Poster && item.Poster !== 'N/A' ? item.Poster : ''
            }))
          );
        }
      } else if (formData.type === 'Book') {
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=6`);
        const data = await res.json();
        if (data.items && Array.isArray(data.items)) {
          setMediaResults(
            data.items.map((item: any) => {
              const info = item.volumeInfo || {};
              return {
                title: info.title || formData.title,
                creator: info.authors ? info.authors.join(', ') : '',
                link: info.infoLink || '',
                imageUrl: info.imageLinks?.thumbnail?.replace('http:', 'https:') || ''
              };
            })
          );
        }
      } else if (formData.type === 'Podcast') {
        const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=podcast&limit=6`);
        const data = await res.json();
        if (data.results && Array.isArray(data.results)) {
          setMediaResults(
            data.results.map((item: any) => ({
              title: item.collectionName || formData.title,
              creator: item.artistName || '',
              link: item.collectionViewUrl || '',
              imageUrl: item.artworkUrl600 || item.artworkUrl100 || ''
            }))
          );
        }
      }
    } catch (error) {
      console.error('Quick lookup error:', error);
    } finally {
      setIsSearchingMedia(false);
    }
  };

  const handleSaveRecommendation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    const payload: Record<string, any> = {
      title: formData.title.trim(),
      type: formData.type,
      recommendedBy: formData.recommendedBy,
      creator: formData.creator.trim(),
      dateRecommended: formData.dateRecommended || getTodayIso(),
      callDate: formData.callDate || formData.dateRecommended || getTodayIso(),
      link: formData.link.trim(),
      description: formData.description.trim(),
      status: formData.status,
      review: formData.review.trim(),
      rating: formData.rating ?? null,
      imageUrl: formData.imageUrl.trim(),
      completedAt:
        formData.status === 'Seen/Finished'
          ? getTodayIso()
          : null,
      updatedAt: serverTimestamp()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, COLLECTION_NAME, editingId), payload).catch((err) =>
          handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${editingId}`)
        );
        showToast('success', 'Recommendation updated.');
      } else {
        await addDoc(collection(db, COLLECTION_NAME), {
          ...payload,
          createdAt: serverTimestamp()
        }).catch((err) =>
          handleFirestoreError(err, OperationType.CREATE, COLLECTION_NAME)
        );
        showToast('success', 'Recommendation added to your shared list.');
      }
      setIsFormOpen(false);
      setEditingId(null);
    } catch (error: any) {
      showToast('error', `Could not save recommendation: ${error.message || 'Unknown error'}`);
    }
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingItem) return;

    try {
      const updates: Record<string, any> = {
        status: reviewFormData.status,
        rating: reviewFormData.rating ?? null,
        review: reviewFormData.review.trim(),
        completedAt:
          reviewFormData.status === 'Seen/Finished'
            ? reviewingItem.completedAt || getTodayIso()
            : null,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, COLLECTION_NAME, reviewingItem.id), updates).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${reviewingItem.id}`)
      );

      if (selectedItem?.id === reviewingItem.id) {
        setSelectedItem({
          ...selectedItem,
          status: reviewFormData.status,
          rating: reviewFormData.rating ?? null,
          review: reviewFormData.review.trim(),
          completedAt: updates.completedAt
        });
      }

      setReviewingItem(null);
      showToast('success', 'Status & personal review saved.');
    } catch (error: any) {
      showToast('error', `Failed to update review: ${error.message || 'Unknown error'}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `${COLLECTION_NAME}/${id}`)
      );
      if (selectedItem?.id === id) setSelectedItem(null);
      setDeleteConfirmation(null);
      showToast('success', 'Recommendation deleted.');
    } catch {
      showToast('error', 'Failed to delete recommendation.');
      setDeleteConfirmation(null);
    }
  };

  // Unique Phone Call Dates with counts
  const callDatesSummary = useMemo(() => {
    const counts: Record<string, { total: number; completed: number }> = {};
    recommendations.forEach((rec) => {
      const dateKey = rec.callDate || rec.dateRecommended;
      if (!dateKey) return;
      if (!counts[dateKey]) counts[dateKey] = { total: 0, completed: 0 };
      counts[dateKey].total += 1;
      if (rec.status === 'Seen/Finished') counts[dateKey].completed += 1;
    });
    return Object.entries(counts)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, stats]) => ({ date, ...stats }));
  }, [recommendations]);

  // Filtered & Sorted Recommendations
  const filteredRecommendations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = recommendations.filter((rec) => {
      if (selectedType !== 'All' && rec.type !== selectedType) return false;
      if (selectedRecommender !== 'all' && rec.recommendedBy !== selectedRecommender) return false;
      if (selectedCallDate !== 'all' && rec.callDate !== selectedCallDate) return false;

      if (selectedStatus === 'unfinished') {
        if (rec.status === 'Seen/Finished') return false;
      } else if (selectedStatus !== 'all') {
        if (rec.status !== selectedStatus) return false;
      }

      if (q) {
        const recommenderName = getPersonName(rec.recommendedBy).toLowerCase();
        const matches =
          rec.title.toLowerCase().includes(q) ||
          rec.type.toLowerCase().includes(q) ||
          (rec.description && rec.description.toLowerCase().includes(q)) ||
          (rec.review && rec.review.toLowerCase().includes(q)) ||
          (rec.creator && rec.creator.toLowerCase().includes(q)) ||
          rec.callDate.includes(q) ||
          recommenderName.includes(q);
        if (!matches) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return (b.dateRecommended || '').localeCompare(a.dateRecommended || '');
        case 'oldest':
          return (a.dateRecommended || '').localeCompare(b.dateRecommended || '');
        case 'call-newest':
          return (b.callDate || '').localeCompare(a.callDate || '');
        case 'call-oldest':
          return (a.callDate || '').localeCompare(b.callDate || '');
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
  }, [
    recommendations,
    searchQuery,
    selectedType,
    selectedRecommender,
    selectedCallDate,
    selectedStatus,
    sortBy,
    config
  ]);

  // Overview Derived Sections
  const otherPerson: RecommendedByRole = activePerson === 'owner' ? 'friend' : 'owner';

  const overviewSections = useMemo(() => {
    const sortedByNewest = [...recommendations].sort((a, b) =>
      (b.dateRecommended || '').localeCompare(a.dateRecommended || '')
    );

    const recentlyRecommended = sortedByNewest.slice(0, 6);

    // Things I Still Need to Check Out = Recommended BY the other person TO me, not yet Seen/Finished
    const thingsINeedToCheckOut = sortedByNewest.filter(
      (r) => r.recommendedBy === otherPerson && r.status !== 'Seen/Finished'
    );

    // Things My Friend (the other person) Still Needs to Check Out = Recommended BY me TO them, not yet Seen/Finished
    const thingsOtherNeedsToCheckOut = sortedByNewest.filter(
      (r) => r.recommendedBy === activePerson && r.status !== 'Seen/Finished'
    );

    const completed = sortedByNewest.filter((r) => r.status === 'Seen/Finished');

    const highlyRated = [...recommendations]
      .filter((r) => (r.rating || 0) >= 4)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));

    return {
      recentlyRecommended,
      thingsINeedToCheckOut,
      thingsOtherNeedsToCheckOut,
      completed,
      highlyRated
    };
  }, [recommendations, activePerson, otherPerson]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedType !== 'All' ||
    selectedRecommender !== 'all' ||
    selectedStatus !== 'all' ||
    selectedCallDate !== 'all';

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedType('All');
    setSelectedRecommender('all');
    setSelectedStatus('all');
    setSelectedCallDate('all');
    setSortBy('newest');
  };

  const getTypeIcon = (type: RecommendationType, size = 16) => {
    switch (type) {
      case 'Movie':
      case 'Documentary':
        return <Film size={size} />;
      case 'TV Series':
        return <Tv size={size} />;
      case 'YouTube Video':
        return <Video size={size} />;
      case 'Book':
        return <Book size={size} />;
      case 'Article':
        return <FileText size={size} />;
      case 'Podcast':
        return <Podcast size={size} />;
      case 'Music':
        return <Music size={size} />;
      case 'Website':
        return <Globe size={size} />;
      default:
        return <Sparkles size={size} />;
    }
  };

  const getStatusIcon = (status: RecommendationStatus, size = 14) => {
    switch (status) {
      case 'Seen/Finished':
        return <CheckCircle2 size={size} className="text-emerald-600 dark:text-emerald-400 shrink-0" />;
      case 'Planning to Watch/Read/Listen':
        return <Clock size={size} className="text-amber-600 dark:text-amber-400 shrink-0" />;
      default:
        return <Circle size={size} className="text-ink/30 shrink-0" />;
    }
  };

  // 1. Loading State
  if (!authChecked || !configLoaded || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-40 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-2 border-accent/20 border-t-accent rounded-full animate-spin mb-6" />
        <p className="text-xs text-ink/50 font-serif italic">Opening shared conversation archive...</p>
      </div>
    );
  }

  // 2. Password Gate for Friend (when not logged in as Owner and not yet unlocked)
  if (!hasAccess) {
    return (
      <div className="min-h-[82vh] flex items-center justify-center px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-md w-full bg-surface border border-ink/10 rounded-3xl p-8 md:p-12 shadow-xl"
        >
          <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-6">
            <PhoneCall size={22} />
          </div>

          <h1 className="text-3xl md:text-4xl font-serif text-ink mb-3 leading-tight">
            Private Recommendations
          </h1>
          <p className="text-sm text-ink/60 leading-relaxed mb-8">
            A private shared space for {config.ownerName} and {config.friendName} to save, follow up on, and discuss things recommended during phone calls.
          </p>

          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-ink/70 mb-2">
                Enter Shared Password
              </label>
              <div className="relative">
                <KeyRound
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/30"
                />
                <input
                  type="password"
                  required
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  placeholder="Password..."
                  className="w-full pl-11 pr-4 py-3.5 bg-paper border border-ink/15 rounded-xl text-sm text-ink focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              {passwordError && (
                <p className="text-xs text-red-500 mt-2">{passwordError}</p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              icon={Unlock}
              className="w-full py-3.5 rounded-xl justify-center"
            >
              Unlock Shared Archive
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-ink/5 text-xs text-ink/40 flex items-center justify-between">
            <span>No account or username required</span>
            <span>Password protected</span>
          </div>
        </motion.div>
      </div>
    );
  }

  // Reusable Recommendation Card component adhering to clean typographic rules
  const renderRecommendationCard = (item: PrivateRecommendationItem) => {
    const isCompleted = item.status === 'Seen/Finished';
    const isForMe = item.recommendedBy !== activePerson;

    return (
      <motion.article
        key={item.id}
        layout
        onClick={() => setSelectedItem(item)}
        className="group bg-surface border border-ink/10 hover:border-accent/40 rounded-2xl p-6 flex flex-col justify-between transition-colors cursor-pointer"
      >
        <div>
          {/* Top unboxed metadata line */}
          <div className="flex items-center justify-between gap-2 text-xs text-ink/50 mb-3">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <span className="text-accent shrink-0">{getTypeIcon(item.type, 14)}</span>
              <span className="font-medium text-ink/80 truncate">{item.type}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">From {getPersonName(item.recommendedBy)}</span>
            </div>
            <span className="font-mono text-[11px] tabular-nums text-ink/40 shrink-0">
              Call: {formatReadableDate(item.callDate)}
            </span>
          </div>

          {/* Title & optional thumbnail */}
          <div className="flex items-start gap-4 mb-3">
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt={item.title}
                referrerPolicy="no-referrer"
                className="w-12 h-16 object-cover rounded-lg border border-ink/10 shrink-0 bg-ink/5"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-serif font-medium text-ink group-hover:text-accent transition-colors leading-snug line-clamp-2">
                {item.title}
              </h3>
              {item.creator && (
                <p className="text-xs text-ink/50 mt-0.5 truncate">{item.creator}</p>
              )}
            </div>
          </div>

          {/* Short Description / Note from Call */}
          {item.description && (
            <p className="text-sm text-ink/70 leading-relaxed line-clamp-3 mb-4">
              {item.description}
            </p>
          )}

          {/* Personal Review & Rating if present */}
          {(item.review || item.rating) && (
            <div className="mt-3 pt-3 border-t border-ink/5 bg-paper/60 -mx-2 px-3 py-2.5 rounded-xl">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-medium text-ink/50 flex items-center gap-1.5">
                  <MessageSquareQuote size={12} className="text-accent" />
                  Personal Review
                </span>
                {item.rating && (
                  <div className="flex items-center gap-0.5 text-amber-500 font-mono text-xs tabular-nums">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={12}
                        className={i < (item.rating || 0) ? 'fill-amber-500 text-amber-500' : 'text-ink/15'}
                      />
                    ))}
                  </div>
                )}
              </div>
              {item.review && (
                <p className="text-xs text-ink/80 italic font-serif line-clamp-2">
                  “{item.review}”
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer: Status & Quick Follow-Up Actions */}
        <div className="mt-5 pt-4 border-t border-ink/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-ink/70 min-w-0">
            {getStatusIcon(item.status, 15)}
            <span className="truncate">{item.status}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                title="Open link"
                className="p-2 text-ink/50 hover:text-accent hover:bg-ink/5 rounded-lg transition-colors"
              >
                <ExternalLink size={14} />
              </a>
            )}
            <button
              type="button"
              onClick={(e) => openReviewModal(item, e)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                !isCompleted && isForMe
                  ? 'bg-accent text-white hover:opacity-90'
                  : 'bg-ink/5 text-ink/80 hover:bg-ink/10'
              }`}
            >
              {isCompleted ? 'Edit Review' : 'Complete & Review'}
            </button>
          </div>
        </div>
      </motion.article>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      {/* Status Toast */}
      <AnimatePresence>
        {statusBanner && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={`fixed top-20 right-6 z-50 px-5 py-3 rounded-xl shadow-lg border text-xs font-medium flex items-center gap-2.5 ${
              statusBanner.type === 'success'
                ? 'bg-surface border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-surface border-red-500/30 text-red-600 dark:text-red-400'
            }`}
          >
            <CheckCircle2 size={16} />
            <span>{statusBanner.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Area */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-ink/10">
        <div>
          <div className="flex items-center gap-2 text-xs text-ink/50 mb-2">
            <PhoneCall size={14} className="text-accent" />
            <span>Private Shared Archive</span>
            <span aria-hidden="true">·</span>
            <span>{config.ownerName} &amp; {config.friendName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{recommendations.length} recommendations</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-ink tracking-tight">
            Phone Call Recommendations
          </h1>
          <p className="text-sm text-ink/60 mt-2 max-w-2xl">
            Our shared memory of movies, books, videos, podcasts, and articles we recommend to each other during our conversations.
          </p>
        </div>

        {/* Identity Switcher & Primary Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Active Person Selector */}
          <div className="flex items-center bg-surface border border-ink/10 rounded-xl p-1">
            <span className="text-[11px] text-ink/40 px-2.5 flex items-center gap-1 whitespace-nowrap">
              <UserCheck size={13} />
              Viewing as:
            </span>
            <button
              type="button"
              onClick={() => handleSwitchPerson('owner')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activePerson === 'owner'
                  ? 'bg-ink text-paper shadow-sm'
                  : 'text-ink/60 hover:text-ink'
              }`}
            >
              {config.ownerName}
            </button>
            <button
              type="button"
              onClick={() => handleSwitchPerson('friend')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activePerson === 'friend'
                  ? 'bg-ink text-paper shadow-sm'
                  : 'text-ink/60 hover:text-ink'
              }`}
            >
              {config.friendName}
            </button>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setSettingsForm(config);
                setIsSettingsOpen(true);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-surface border border-ink/10 hover:border-accent/40 text-xs font-medium text-ink/80 flex items-center gap-2 transition-colors whitespace-nowrap"
              title="Configure Friend Password & Names"
            >
              <KeyRound size={14} className="text-accent" />
              <span>Password &amp; Names</span>
            </button>
          )}

          {!isAdmin && isFriendUnlocked && (
            <button
              type="button"
              onClick={handleLockSpace}
              className="px-3.5 py-2.5 rounded-xl bg-surface border border-ink/10 hover:border-red-500/40 text-xs font-medium text-ink/60 hover:text-red-500 flex items-center gap-1.5 transition-colors whitespace-nowrap"
              title="Lock private space"
            >
              <LogOut size={14} />
              <span>Lock</span>
            </button>
          )}

          <Button
            onClick={() => openAddModal()}
            variant="primary"
            size="md"
            icon={Plus}
            className="rounded-xl px-5 py-2.5 whitespace-nowrap"
          >
            Add Recommendation
          </Button>
        </div>
      </div>

      {/* Navigation Tabs + Quick Search & Filters Bar */}
      <div className="mt-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* View Mode Segmented Control */}
          <div className="inline-flex items-center p-1 bg-surface border border-ink/10 rounded-xl self-start">
            <button
              type="button"
              onClick={() => setViewMode('overview')}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                viewMode === 'overview' && !hasActiveFilters
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-ink/60 hover:text-ink'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setViewMode('browse')}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                viewMode === 'browse' || hasActiveFilters
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-ink/60 hover:text-ink'
              }`}
            >
              All &amp; Filter ({filteredRecommendations.length})
            </button>
            <button
              type="button"
              onClick={() => {
                clearAllFilters();
                setViewMode('calls');
              }}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                viewMode === 'calls' && !hasActiveFilters
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-ink/60 hover:text-ink'
              }`}
            >
              <PhoneCall size={13} />
              <span>By Phone Call ({callDatesSummary.length})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, notes, reviews, or date..."
              className="w-full pl-10 pr-8 py-2.5 bg-surface border border-ink/10 rounded-xl text-xs text-ink focus:outline-none focus:border-accent transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Comprehensive Filter & Sort Controls */}
        <div className="bg-surface border border-ink/10 rounded-2xl p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* 1. Filter by Phone Call Date */}
            <div>
              <label className="block text-[11px] text-ink/50 mb-1">
                Phone Call / Conversation Date
              </label>
              <select
                value={selectedCallDate}
                onChange={(e) => setSelectedCallDate(e.target.value)}
                className="w-full px-3 py-2 bg-paper border border-ink/10 rounded-lg text-xs text-ink focus:outline-none focus:border-accent"
              >
                <option value="all">All Phone Calls ({callDatesSummary.length})</option>
                {callDatesSummary.map((call) => (
                  <option key={call.date} value={call.date}>
                    {formatReadableDate(call.date)} ({call.total} rec{call.total === 1 ? '' : 's'})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Filter by Type */}
            <div>
              <label className="block text-[11px] text-ink/50 mb-1">
                Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 bg-paper border border-ink/10 rounded-lg text-xs text-ink focus:outline-none focus:border-accent"
              >
                <option value="All">All Types</option>
                {RECOMMENDATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Filter by Who Recommended It */}
            <div>
              <label className="block text-[11px] text-ink/50 mb-1">
                Recommended By
              </label>
              <select
                value={selectedRecommender}
                onChange={(e) => setSelectedRecommender(e.target.value as any)}
                className="w-full px-3 py-2 bg-paper border border-ink/10 rounded-lg text-xs text-ink focus:outline-none focus:border-accent"
              >
                <option value="all">Both ({config.ownerName} &amp; {config.friendName})</option>
                <option value="owner">Recommended by {config.ownerName}</option>
                <option value="friend">Recommended by {config.friendName}</option>
              </select>
            </div>

            {/* 4. Filter by Status */}
            <div>
              <label className="block text-[11px] text-ink/50 mb-1">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-paper border border-ink/10 rounded-lg text-xs text-ink focus:outline-none focus:border-accent"
              >
                <option value="all">All Statuses</option>
                <option value="unfinished">Not Yet Checked Out (Unfinished)</option>
                <option value="Not Seen">Not Seen</option>
                <option value="Planning to Watch/Read/Listen">Planning to Watch/Read/Listen</option>
                <option value="Seen/Finished">Completed (Seen/Finished)</option>
              </select>
            </div>

            {/* 5. Sort Order */}
            <div>
              <label className="block text-[11px] text-ink/50 mb-1">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 bg-paper border border-ink/10 rounded-lg text-xs text-ink focus:outline-none focus:border-accent"
              >
                <option value="newest">Newest Recommendation</option>
                <option value="oldest">Oldest Recommendation</option>
                <option value="call-newest">Phone Call Date (Newest)</option>
                <option value="call-oldest">Phone Call Date (Oldest)</option>
                <option value="rating">Highest Rated</option>
                <option value="title">Title (A–Z)</option>
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center justify-between pt-2 border-t border-ink/5 text-xs">
              <span className="text-ink/60">
                Showing <strong className="font-mono tabular-nums text-ink">{filteredRecommendations.length}</strong> matching recommendation{filteredRecommendations.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-accent hover:underline font-medium flex items-center gap-1"
              >
                <X size={13} />
                <span>Reset all filters</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mt-12">
        {recommendations.length === 0 ? (
          <div className="bg-surface border border-ink/10 rounded-3xl p-12 text-center max-w-xl mx-auto my-8">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-4">
              <PhoneCall size={22} />
            </div>
            <h2 className="text-2xl font-serif text-ink mb-2">
              Start Your Conversation Memory
            </h2>
            <p className="text-sm text-ink/60 mb-6 leading-relaxed">
              Whenever you and {config.friendName} mention a movie, book, YouTube video, podcast, or article on a phone call, save it here so neither of you forgets.
            </p>
            <Button
              onClick={() => openAddModal()}
              variant="primary"
              size="md"
              icon={Plus}
              className="rounded-xl px-6 py-3"
            >
              Add First Recommendation
            </Button>
          </div>
        ) : hasActiveFilters || viewMode === 'browse' ? (
          /* Filtered / Full Browse Collection View */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-serif text-ink">
                {selectedCallDate !== 'all'
                  ? `Phone Call on ${formatReadableDate(selectedCallDate)}`
                  : 'All Recommendations'}
              </h2>
              {selectedCallDate !== 'all' && (
                <Button
                  onClick={() => openAddModal(selectedCallDate)}
                  variant="outline"
                  size="sm"
                  icon={Plus}
                  className="rounded-xl"
                >
                  Add to This Call
                </Button>
              )}
            </div>

            {filteredRecommendations.length === 0 ? (
              <div className="bg-surface border border-ink/10 rounded-2xl p-12 text-center">
                <p className="text-base font-serif text-ink mb-2">
                  No recommendations match your current filters
                </p>
                <p className="text-xs text-ink/50 mb-4">
                  Try clearing some filters or searching for a different keyword.
                </p>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-medium"
                >
                  Show All Recommendations
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRecommendations.map(renderRecommendationCard)}
              </div>
            )}
          </div>
        ) : viewMode === 'calls' ? (
          /* Chronological Phone Call Archive View */
          <div className="space-y-12">
            {callDatesSummary.map((callGroup) => {
              const itemsForCall = recommendations.filter(
                (r) => (r.callDate || r.dateRecommended) === callGroup.date
              );
              return (
                <section
                  key={callGroup.date}
                  className="border-b border-ink/10 pb-12 last:border-b-0"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-ink/50 mb-1">
                        <PhoneCall size={13} className="text-accent" />
                        <span>Phone Call Conversation</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {callGroup.completed} of {callGroup.total} completed
                        </span>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-serif text-ink">
                        {formatReadableDate(callGroup.date)}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => openAddModal(callGroup.date)}
                      className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-surface border border-ink/10 hover:border-accent text-xs font-medium text-ink/80 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <Plus size={14} className="text-accent" />
                      <span>Add to this call</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {itemsForCall.map(renderRecommendationCard)}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          /* Overview Mode with the 5 Curated Sections */
          <div className="space-y-16">
            {/* Quick Conversation Timeline Strip */}
            {callDatesSummary.length > 0 && (
              <section className="bg-surface border border-ink/10 rounded-2xl p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-serif text-ink">
                      Phone Call History
                    </h2>
                    <p className="text-xs text-ink/50">
                      Select a conversation date to view everything recommended during that call
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewMode('calls')}
                    className="text-xs text-accent hover:underline font-medium whitespace-nowrap"
                  >
                    View full call log
                  </button>
                </div>
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                  {callDatesSummary.map((call) => (
                    <button
                      key={call.date}
                      type="button"
                      onClick={() => {
                        setSelectedCallDate(call.date);
                        setViewMode('browse');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-paper border border-ink/10 hover:border-accent text-left shrink-0 transition-colors"
                    >
                      <div className="text-xs font-medium text-ink whitespace-nowrap">
                        {formatReadableDate(call.date)}
                      </div>
                      <div className="text-[11px] text-ink/50 font-mono tabular-nums mt-0.5 whitespace-nowrap">
                        {call.total} rec{call.total === 1 ? '' : 's'} · {call.completed} done
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Section 1: Things I Still Need to Check Out */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6 pb-3 border-b border-ink/10">
                <div>
                  <div className="text-xs text-ink/50 mb-1">
                    Recommended by {getPersonName(otherPerson)} for {getPersonName(activePerson)}
                  </div>
                  <h2 className="text-2xl md:text-3xl font-serif text-ink">
                    Things I Still Need to Check Out
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRecommender(otherPerson);
                    setSelectedStatus('unfinished');
                    setViewMode('browse');
                  }}
                  className="text-xs text-accent hover:underline font-medium self-start sm:self-auto whitespace-nowrap"
                >
                  View all ({overviewSections.thingsINeedToCheckOut.length})
                </button>
              </div>

              {overviewSections.thingsINeedToCheckOut.length === 0 ? (
                <div className="bg-surface/60 border border-ink/5 rounded-2xl p-8 text-center text-sm text-ink/50">
                  You’re all caught up on recommendations from {getPersonName(otherPerson)}!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {overviewSections.thingsINeedToCheckOut.slice(0, 6).map(renderRecommendationCard)}
                </div>
              )}
            </section>

            {/* Section 2: Things My Friend Still Needs to Check Out */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6 pb-3 border-b border-ink/10">
                <div>
                  <div className="text-xs text-ink/50 mb-1">
                    Recommended by {getPersonName(activePerson)} for {getPersonName(otherPerson)}
                  </div>
                  <h2 className="text-2xl md:text-3xl font-serif text-ink">
                    Things {getPersonName(otherPerson)} Still Needs to Check Out
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRecommender(activePerson);
                    setSelectedStatus('unfinished');
                    setViewMode('browse');
                  }}
                  className="text-xs text-accent hover:underline font-medium self-start sm:self-auto whitespace-nowrap"
                >
                  View all ({overviewSections.thingsOtherNeedsToCheckOut.length})
                </button>
              </div>

              {overviewSections.thingsOtherNeedsToCheckOut.length === 0 ? (
                <div className="bg-surface/60 border border-ink/5 rounded-2xl p-8 text-center text-sm text-ink/50">
                  No pending recommendations waiting for {getPersonName(otherPerson)}.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {overviewSections.thingsOtherNeedsToCheckOut.slice(0, 6).map(renderRecommendationCard)}
                </div>
              )}
            </section>

            {/* Section 3: Recently Recommended */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6 pb-3 border-b border-ink/10">
                <div>
                  <div className="text-xs text-ink/50 mb-1">
                    Latest additions from our calls
                  </div>
                  <h2 className="text-2xl md:text-3xl font-serif text-ink">
                    Recently Recommended
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearAllFilters();
                    setSortBy('newest');
                    setViewMode('browse');
                  }}
                  className="text-xs text-accent hover:underline font-medium self-start sm:self-auto whitespace-nowrap"
                >
                  Browse all ({recommendations.length})
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {overviewSections.recentlyRecommended.map(renderRecommendationCard)}
              </div>
            </section>

            {/* Section 4: Completed */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6 pb-3 border-b border-ink/10">
                <div>
                  <div className="text-xs text-ink/50 mb-1">
                    Watched, read, or listened to — with our thoughts
                  </div>
                  <h2 className="text-2xl md:text-3xl font-serif text-ink">
                    Completed
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearAllFilters();
                    setSelectedStatus('Seen/Finished');
                    setViewMode('browse');
                  }}
                  className="text-xs text-accent hover:underline font-medium self-start sm:self-auto whitespace-nowrap"
                >
                  View all completed ({overviewSections.completed.length})
                </button>
              </div>

              {overviewSections.completed.length === 0 ? (
                <div className="bg-surface/60 border border-ink/5 rounded-2xl p-8 text-center text-sm text-ink/50">
                  Nothing marked as Seen/Finished yet. Click “Complete &amp; Review” on any item after checking it out!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {overviewSections.completed.slice(0, 6).map(renderRecommendationCard)}
                </div>
              )}
            </section>

            {/* Section 5: Highly Rated */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6 pb-3 border-b border-ink/10">
                <div>
                  <div className="text-xs text-ink/50 mb-1">
                    Favorites rated 4 or 5 stars
                  </div>
                  <h2 className="text-2xl md:text-3xl font-serif text-ink">
                    Highly Rated
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearAllFilters();
                    setSortBy('rating');
                    setViewMode('browse');
                  }}
                  className="text-xs text-accent hover:underline font-medium self-start sm:self-auto whitespace-nowrap"
                >
                  Sort all by rating ({overviewSections.highlyRated.length})
                </button>
              </div>

              {overviewSections.highlyRated.length === 0 ? (
                <div className="bg-surface/60 border border-ink/5 rounded-2xl p-8 text-center text-sm text-ink/50">
                  No rated recommendations yet. Add a star rating when reviewing a completed item!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {overviewSections.highlyRated.slice(0, 6).map(renderRecommendationCard)}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Add / Edit Recommendation Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative w-full max-w-2xl bg-surface border border-ink/10 rounded-3xl p-6 md:p-10 shadow-2xl z-10 my-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-ink/10">
                <div>
                  <h2 className="text-2xl font-serif text-ink">
                    {editingId ? 'Edit Recommendation' : 'New Recommendation'}
                  </h2>
                  <p className="text-xs text-ink/50 mt-0.5">
                    Save something mentioned during a phone call
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 rounded-lg text-ink/40 hover:text-ink hover:bg-ink/5"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveRecommendation} className="space-y-5">
                {/* Title & Type */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-ink/70 mb-1.5">
                      Title *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g. Anatomy of a Fall, Hardcore History..."
                        className="flex-1 px-4 py-2.5 bg-paper border border-ink/15 rounded-xl text-sm text-ink focus:outline-none focus:border-accent"
                      />
                      {(['Movie', 'TV Series', 'Documentary', 'Book', 'Podcast'] as RecommendationType[]).includes(
                        formData.type
                      ) && (
                        <button
                          type="button"
                          onClick={handleQuickMediaLookup}
                          disabled={isSearchingMedia || !formData.title.trim()}
                          className="px-3.5 py-2.5 rounded-xl bg-paper border border-ink/15 hover:border-accent text-xs font-medium text-ink/80 disabled:opacity-40 whitespace-nowrap"
                          title="Auto-fill details from online database"
                        >
                          {isSearchingMedia ? 'Searching...' : 'Auto-fill'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ink/70 mb-1.5">
                      Type *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => {
                        setFormData({ ...formData, type: e.target.value as RecommendationType });
                        setMediaResults([]);
                      }}
                      className="w-full px-3.5 py-2.5 bg-paper border border-ink/15 rounded-xl text-sm text-ink focus:outline-none focus:border-accent"
                    >
                      {RECOMMENDATION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quick Media Lookup Results if triggered */}
                {mediaResults.length > 0 && (
                  <div className="p-3.5 bg-paper border border-ink/10 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between text-xs text-ink/50">
                      <span>Select a match to auto-fill link &amp; cover</span>
                      <button
                        type="button"
                        onClick={() => setMediaResults([])}
                        className="text-ink/40 hover:text-ink"
                      >
                        Close
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {mediaResults.map((res, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              title: res.title || formData.title,
                              creator: res.creator || formData.creator,
                              link: res.link || formData.link,
                              imageUrl: res.imageUrl || formData.imageUrl
                            });
                            setMediaResults([]);
                          }}
                          className="flex items-center gap-2.5 p-2 rounded-xl border border-ink/10 hover:border-accent text-left bg-surface transition-colors"
                        >
                          {res.imageUrl && (
                            <img
                              src={res.imageUrl}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="w-8 h-11 object-cover rounded shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-ink truncate">{res.title}</div>
                            <div className="text-[10px] text-ink/50 truncate">{res.creator}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended By & Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-ink/70 mb-1.5">
                      Recommended By *
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-paper border border-ink/15 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, recommendedBy: 'owner' })}
                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                          formData.recommendedBy === 'owner'
                            ? 'bg-accent text-white'
                            : 'text-ink/60 hover:text-ink'
                        }`}
                      >
                        {config.ownerName}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, recommendedBy: 'friend' })}
                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                          formData.recommendedBy === 'friend'
                            ? 'bg-accent text-white'
                            : 'text-ink/60 hover:text-ink'
                        }`}
                      >
                        {config.friendName}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ink/70 mb-1.5">
                      Status *
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value as RecommendationStatus })
                      }
                      className="w-full px-3.5 py-2.5 bg-paper border border-ink/15 rounded-xl text-sm text-ink focus:outline-none focus:border-accent"
                    >
                      {RECOMMENDATION_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Phone Call Date & Date Recommended */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-ink/70 mb-1.5">
                      Phone Call / Conversation Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.callDate}
                      onChange={(e) => setFormData({ ...formData, callDate: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-paper border border-ink/15 rounded-xl text-sm text-ink font-mono focus:outline-none focus:border-accent"
                    />
                    {callDatesSummary.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[10px] text-ink/40">Recent calls:</span>
                        {callDatesSummary.slice(0, 3).map((c) => (
                          <button
                            key={c.date}
                            type="button"
                            onClick={() => setFormData({ ...formData, callDate: c.date })}
                            className="text-[10px] font-mono text-accent hover:underline"
                          >
                            {c.date}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ink/70 mb-1.5">
                      Date Recommended *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.dateRecommended}
                      onChange={(e) =>
                        setFormData({ ...formData, dateRecommended: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-paper border border-ink/15 rounded-xl text-sm text-ink font-mono focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {/* Short Description or Note */}
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1.5">
                    Short Description or Note from the Call
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Why was it recommended? Any context or timestamp from our conversation..."
                    className="w-full px-4 py-2.5 bg-paper border border-ink/15 rounded-xl text-sm text-ink focus:outline-none focus:border-accent resize-none"
                  />
                </div>

                {/* Link & Creator */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-ink/70 mb-1.5">
                      Link (Optional)
                    </label>
                    <input
                      type="url"
                      value={formData.link}
                      onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-4 py-2.5 bg-paper border border-ink/15 rounded-xl text-sm text-ink focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ink/70 mb-1.5">
                      Creator / Director / Author (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.creator}
                      onChange={(e) => setFormData({ ...formData, creator: e.target.value })}
                      placeholder="e.g. Denis Villeneuve, Dan Carlin..."
                      className="w-full px-4 py-2.5 bg-paper border border-ink/15 rounded-xl text-sm text-ink focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {/* Personal Comment / Review & Optional Rating */}
                <div className="pt-4 border-t border-ink/10 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-medium text-ink/70">
                      Optional Rating (After Watching / Reading / Listening)
                    </label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              rating: formData.rating === star ? null : star
                            })
                          }
                          className="p-1 text-amber-500 hover:scale-110 transition-transform"
                        >
                          <Star
                            size={18}
                            className={
                              (formData.rating || 0) >= star
                                ? 'fill-amber-500 text-amber-500'
                                : 'text-ink/20'
                            }
                          />
                        </button>
                      ))}
                      {formData.rating && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, rating: null })}
                          className="text-[11px] text-ink/40 hover:text-ink ml-2"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ink/70 mb-1.5">
                      Personal Comment or Review (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={formData.review}
                      onChange={(e) => setFormData({ ...formData, review: e.target.value })}
                      placeholder="What did you think about it after checking it out?"
                      className="w-full px-4 py-2.5 bg-paper border border-ink/15 rounded-xl text-sm text-ink focus:outline-none focus:border-accent resize-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-ink/15 text-xs font-medium text-ink/70 hover:text-ink"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    icon={Save}
                    className="rounded-xl px-6 py-2.5"
                  >
                    {editingId ? 'Save Changes' : 'Save Recommendation'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Follow-Up / Mark Completed & Review Modal */}
      <AnimatePresence>
        {reviewingItem && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReviewingItem(null)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative w-full max-w-lg bg-surface border border-ink/10 rounded-3xl p-6 md:p-8 shadow-2xl z-10"
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <div className="text-xs text-ink/50 mb-1">
                    {reviewingItem.type} · Recommended by {getPersonName(reviewingItem.recommendedBy)}
                  </div>
                  <h3 className="text-2xl font-serif text-ink">
                    {reviewingItem.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewingItem(null)}
                  className="p-2 rounded-lg text-ink/40 hover:text-ink"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveReview} className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-2">
                    Status
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {RECOMMENDATION_STATUSES.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setReviewFormData({ ...reviewFormData, status: st })}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-medium transition-colors ${
                          reviewFormData.status === st
                            ? 'border-accent bg-accent/10 text-ink'
                            : 'border-ink/10 bg-paper text-ink/60 hover:text-ink'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {getStatusIcon(st, 15)}
                          <span>{st}</span>
                        </span>
                        {reviewFormData.status === st && <Check size={15} className="text-accent" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-2">
                    Your Rating (Optional)
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() =>
                          setReviewFormData({
                            ...reviewFormData,
                            rating: reviewFormData.rating === star ? null : star
                          })
                        }
                        className="p-2 rounded-lg bg-paper border border-ink/10 hover:border-amber-500/40 transition-colors"
                      >
                        <Star
                          size={20}
                          className={
                            (reviewFormData.rating || 0) >= star
                              ? 'fill-amber-500 text-amber-500'
                              : 'text-ink/20'
                          }
                        />
                      </button>
                    ))}
                    {reviewFormData.rating && (
                      <span className="text-xs font-mono text-ink/60 ml-2">
                        {reviewFormData.rating} / 5
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1.5">
                    Personal Comment or Review
                  </label>
                  <textarea
                    rows={4}
                    value={reviewFormData.review}
                    onChange={(e) =>
                      setReviewFormData({ ...reviewFormData, review: e.target.value })
                    }
                    placeholder="Write what you thought about it so we can discuss it on our next call..."
                    className="w-full px-4 py-3 bg-paper border border-ink/15 rounded-xl text-sm text-ink focus:outline-none focus:border-accent resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setReviewingItem(null)}
                    className="px-4 py-2.5 rounded-xl border border-ink/15 text-xs font-medium text-ink/70"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    icon={Check}
                    className="rounded-xl px-6 py-2.5"
                  >
                    Save Follow-Up
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Recommendation Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative w-full max-w-2xl bg-surface border border-ink/10 rounded-3xl p-6 md:p-10 shadow-2xl z-10 max-h-[88vh] overflow-y-auto"
            >
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="absolute top-6 right-6 p-2 rounded-lg text-ink/40 hover:text-ink hover:bg-ink/5"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-2 text-xs text-ink/50 mb-3">
                <span className="text-accent">{getTypeIcon(selectedItem.type, 15)}</span>
                <span className="font-medium text-ink/80">{selectedItem.type}</span>
                <span aria-hidden="true">·</span>
                <span>Recommended by {getPersonName(selectedItem.recommendedBy)}</span>
                <span aria-hidden="true">·</span>
                {getStatusIcon(selectedItem.status, 14)}
                <span>{selectedItem.status}</span>
              </div>

              <div className="flex items-start gap-5 mb-6">
                {selectedItem.imageUrl && (
                  <img
                    src={selectedItem.imageUrl}
                    alt={selectedItem.title}
                    referrerPolicy="no-referrer"
                    className="w-20 h-28 object-cover rounded-xl border border-ink/10 shrink-0"
                  />
                )}
                <div>
                  <h2 className="text-3xl md:text-4xl font-serif text-ink leading-tight">
                    {selectedItem.title}
                  </h2>
                  {selectedItem.creator && (
                    <p className="text-sm text-ink/60 font-serif italic mt-1">
                      {selectedItem.creator}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/50 font-mono tabular-nums mt-3">
                    <span>Phone Call: {formatReadableDate(selectedItem.callDate)}</span>
                    <span aria-hidden="true">·</span>
                    <span>Added: {formatReadableDate(selectedItem.dateRecommended)}</span>
                  </div>
                </div>
              </div>

              {selectedItem.description && (
                <div className="mb-6">
                  <h4 className="text-xs font-medium text-ink/50 mb-2">
                    Note from Phone Call
                  </h4>
                  <p className="text-sm md:text-base text-ink/80 leading-relaxed bg-paper p-4 rounded-2xl border border-ink/5">
                    {selectedItem.description}
                  </p>
                </div>
              )}

              <div className="mb-8 p-5 rounded-2xl bg-paper border border-ink/10">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-ink/60 flex items-center gap-1.5">
                    <MessageSquareQuote size={14} className="text-accent" />
                    <span>Personal Comment / Review After Checking Out</span>
                  </h4>
                  {selectedItem.rating && (
                    <div className="flex items-center gap-1 text-amber-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          className={
                            i < (selectedItem.rating || 0)
                              ? 'fill-amber-500 text-amber-500'
                              : 'text-ink/15'
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>

                {selectedItem.review ? (
                  <p className="text-sm md:text-base font-serif italic text-ink/90 leading-relaxed">
                    “{selectedItem.review}”
                  </p>
                ) : (
                  <p className="text-xs text-ink/40 italic">
                    No personal comment or review added yet.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-ink/10">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    onClick={(e) => openReviewModal(selectedItem, e)}
                    variant="primary"
                    size="md"
                    icon={CheckCircle2}
                    className="rounded-xl px-5 py-2.5"
                  >
                    {selectedItem.status === 'Seen/Finished'
                      ? 'Update Review / Status'
                      : 'Mark Completed & Write Review'}
                  </Button>

                  {selectedItem.link && (
                    <a
                      href={selectedItem.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 rounded-xl bg-paper border border-ink/15 hover:border-accent text-xs font-medium text-ink flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink size={14} />
                      <span>Open Link</span>
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      const itemToEdit = selectedItem;
                      setSelectedItem(null);
                      openEditModal(itemToEdit, e);
                    }}
                    className="p-2.5 rounded-xl bg-paper border border-ink/10 hover:border-accent text-ink/60 hover:text-ink transition-colors"
                    title="Edit details"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmation(selectedItem.id)}
                    className="p-2.5 rounded-xl bg-paper border border-ink/10 hover:border-red-500/40 text-ink/60 hover:text-red-500 transition-colors"
                    title="Delete recommendation"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Owner Space Settings & Password Modal */}
      <AnimatePresence>
        {isSettingsOpen && isAdmin && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative w-full max-w-md bg-surface border border-ink/10 rounded-3xl p-6 md:p-8 shadow-2xl z-10"
            >
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-ink/10">
                <div>
                  <h3 className="text-xl font-serif text-ink">
                    Shared Space Settings
                  </h3>
                  <p className="text-xs text-ink/50 mt-0.5">
                    Configure the password for your friend and your display names
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 rounded-lg text-ink/40 hover:text-ink"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1.5">
                    Friend Access Password
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showPasswordInSettings ? 'text' : 'password'}
                        required
                        value={settingsForm.password}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, password: e.target.value })
                        }
                        className="w-full pl-3.5 pr-10 py-2.5 bg-paper border border-ink/15 rounded-xl text-sm text-ink font-mono focus:outline-none focus:border-accent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordInSettings(!showPasswordInSettings)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink"
                      >
                        {showPasswordInSettings ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(settingsForm.password);
                        showToast('success', 'Password copied to clipboard.');
                      }}
                      className="px-3 py-2.5 rounded-xl bg-paper border border-ink/15 hover:border-accent text-xs font-medium text-ink/70 flex items-center gap-1.5"
                      title="Copy password"
                    >
                      <Copy size={14} />
                      <span>Copy</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-ink/40 mt-1.5">
                    Your friend only needs this password to log in at <span className="font-mono">/a</span>.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-ink/70 mb-1.5">
                      Your Name
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.ownerName}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, ownerName: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-paper border border-ink/15 rounded-xl text-sm text-ink focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink/70 mb-1.5">
                      Friend’s Name
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.friendName}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, friendName: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-paper border border-ink/15 rounded-xl text-sm text-ink focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-ink/15 text-xs font-medium text-ink/70"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isSavingSettings}
                    icon={Save}
                    className="rounded-xl px-5 py-2.5"
                  >
                    Save Settings
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmation && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmation(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-surface border border-ink/10 p-8 rounded-3xl max-w-sm w-full text-center z-10 shadow-2xl"
            >
              <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 size={22} />
              </div>
              <h3 className="text-xl font-serif text-ink mb-2">
                Remove Recommendation?
              </h3>
              <p className="text-xs text-ink/60 mb-6 leading-relaxed">
                This will permanently remove this item from your shared conversation log.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmation(null)}
                  className="flex-1 py-2.5 rounded-xl border border-ink/15 text-xs font-medium text-ink/70"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(deleteConfirmation)}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-medium"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
