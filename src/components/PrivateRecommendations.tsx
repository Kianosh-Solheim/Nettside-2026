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
  LogOut,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
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
  'Book',
  'Movie',
  'TV Series',
  'Documentary',
  'YouTube Video',
  'Podcast',
  'Music',
  'Article',
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
  friendName: 'Venn'
};

export const TYPE_LABELS_NO: Record<string, string> = {
  All: 'Alle',
  Book: 'Bok',
  Movie: 'Film',
  'TV Series': 'TV-serie',
  Documentary: 'Dokumentar',
  'YouTube Video': 'YouTube-video',
  Podcast: 'Podkast',
  Music: 'Musikk',
  Article: 'Artikkel',
  Website: 'Nettside',
  Other: 'Annet'
};

export const STATUS_LABELS_NO: Record<RecommendationStatus, string> = {
  'Not Seen': 'Ikke sett',
  'Planning to Watch/Read/Listen': 'Planlegger å se/lese/høre',
  'Seen/Finished': 'Sett / Ferdig'
};

export function getTypeLabelNo(type: string): string {
  return TYPE_LABELS_NO[type] || type;
}

export function getStatusLabelNo(status: RecommendationStatus): string {
  return STATUS_LABELS_NO[status] || status;
}

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
  if (!isoDate) return 'Ukjent dato';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(dateObj.getTime())) return isoDate;
  return dateObj.toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function normalizeImageUrl(raw?: string): string {
  if (!raw) return '';
  let trimmed = raw.trim();
  if (!trimmed) return '';
  // Extract src if user pasted an <img src="..."> tag or markdown ![alt](url)
  const imgSrcMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (imgSrcMatch?.[1]) {
    trimmed = imgSrcMatch[1].trim();
  } else {
    const mdMatch = trimmed.match(/!\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/);
    if (mdMatch?.[1]) {
      trimmed = mdMatch[1].trim();
    }
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  if (
    !trimmed.startsWith('http://') &&
    !trimmed.startsWith('https://') &&
    !trimmed.startsWith('data:image/') &&
    !trimmed.startsWith('/')
  ) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function getDisplayImageUrl(rawUrl?: string, fallbackStage = 0): string {
  const clean = normalizeImageUrl(rawUrl);
  if (!clean) return '';
  if (clean.startsWith('data:') || clean.startsWith('/')) return clean;
  if (fallbackStage === 1) {
    // Fallback 1: Weserv global image proxy (bypasses hotlink blocks / CORS / mixed content)
    return `https://wsrv.nl/?url=${encodeURIComponent(clean)}`;
  }
  return clean;
}
function isSquareAspectType(type: RecommendationType): boolean {
  return type === 'Podcast' || type === 'Music' || type === 'Website' || type === 'Other';
}

export default function PrivateRecommendations() {
  const location = useLocation();
  const [recommendations, setRecommendations] = useState<PrivateRecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, number>>({});
  const [formPreviewError, setFormPreviewError] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

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

  // Active identity ('owner' or 'friend') - Only Admin can switch
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

  // Shelf / View Filter: 'all' | 'overview' | 'for-me' | 'for-friend' | 'completed' | 'highly-rated' | 'calls'
  const [activeShelf, setActiveShelf] = useState<
    'all' | 'overview' | 'for-me' | 'for-friend' | 'completed' | 'highly-rated' | 'calls'
  >('all');

  // Search, Filter & Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedRecommender, setSelectedRecommender] = useState<'all' | 'owner' | 'friend'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'unfinished' | RecommendationStatus>('all');
  const [selectedCallDate, setSelectedCallDate] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'call-newest' | 'call-oldest' | 'rating' | 'title'>('newest');
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Add / Edit Form Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showMoreFormFields, setShowMoreFormFields] = useState(false);
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

  // Media Lookup Helpers (Movies/Shows/Books/Podcasts/YouTube/Music)
  const [mediaSearchQuery, setMediaSearchQuery] = useState('');
  const [isSearchingMedia, setIsSearchingMedia] = useState(false);
  const [mediaResults, setMediaResults] = useState<Array<{
    title: string;
    creator: string;
    description: string;
    link: string;
    imageUrl: string;
  }>>([]);

  const getImageKey = (id: string, url?: string) => `${id}::${normalizeImageUrl(url)}`;

  const handleImageError = (id: string, url?: string) => {
    const key = getImageKey(id, url);
    setBrokenImages((prev) => ({
      ...prev,
      [key]: (prev[key] || 0) + 1
    }));
  };

  // Check Auth State
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      const ownerMatch =
        user?.email === 'kianoshsolheim@gmail.com' ||
        user?.email === 'kianosh@solheim.online';
      setIsAdmin(ownerMatch);
      if (ownerMatch) {
        try {
          const saved = localStorage.getItem(STORAGE_ROLE_KEY);
          setActivePerson(saved === 'friend' ? 'friend' : 'owner');
        } catch {
          setActivePerson('owner');
        }
      } else {
        setActivePerson('friend');
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
            friendName:
              !data.friendName || data.friendName === 'My Friend'
                ? DEFAULT_CONFIG.friendName
                : data.friendName
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
      setPasswordError('Feil passord. Spør Kianosh om det delte passordet.');
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
    if (!isAdmin) return;
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
      showToast('error', 'Passordet kan ikke være tomt.');
      return;
    }
    setIsSavingSettings(true);
    try {
      await setDoc(
        doc(db, 'recommendations_settings', 'config'),
        {
          password: settingsForm.password.trim(),
          ownerName: settingsForm.ownerName.trim() || 'Kianosh',
          friendName: settingsForm.friendName.trim() || 'Venn',
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      setIsSettingsOpen(false);
      showToast('success', 'Innstillinger og passord er oppdatert.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'recommendations_settings/config');
      showToast('error', 'Kunne ikke lagre innstillinger.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const getPersonName = (role: RecommendedByRole) =>
    role === 'owner' ? config.ownerName : config.friendName;

  const openAddModal = (prefillCallDate?: string) => {
    setEditingId(null);
    setMediaResults([]);
    setMediaSearchQuery('');
    setShowMoreFormFields(false);
    setFormData({
      title: '',
      type: selectedType !== 'All' ? (selectedType as RecommendationType) : 'Movie',
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
    setMediaSearchQuery('');
    setShowMoreFormFields(false);
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

  const handleQuickMediaLookup = async (customQuery?: string) => {
    const queryToUse = (customQuery ?? mediaSearchQuery) || formData.title;
    if (!queryToUse.trim()) return;
    setIsSearchingMedia(true);
    setMediaResults([]);
    try {
      const cleanQuery = queryToUse.trim();
      const q = encodeURIComponent(cleanQuery);

      if (formData.type === 'Movie' || formData.type === 'TV Series' || formData.type === 'Documentary') {
        const omdbKey = import.meta.env.VITE_OMDB_API_KEY || 'b054da29';
        const actualKey = omdbKey.includes('apikey=')
          ? omdbKey.split('apikey=')[1].split('&')[0]
          : omdbKey;
        const omdbType = formData.type === 'TV Series' ? 'series' : 'movie';
        const res = await fetch(`https://www.omdbapi.com/?s=${q}&type=${omdbType}&apikey=${actualKey}`);
        const data = await res.json();
        if (data.Search && Array.isArray(data.Search)) {
          const detailed = await Promise.all(
            data.Search.slice(0, 6).map(async (item: any) => {
              let plot = '';
              try {
                const detailRes = await fetch(`https://www.omdbapi.com/?i=${item.imdbID}&plot=short&apikey=${actualKey}`);
                if (detailRes.ok) {
                  const detailData = await detailRes.json();
                  if (detailData.Plot && detailData.Plot !== 'N/A') plot = detailData.Plot;
                }
              } catch {
                // ignore
              }
              return {
                title: item.Title || formData.title,
                creator: item.Year || '',
                description: plot,
                link: item.imdbID ? `https://www.imdb.com/title/${item.imdbID}` : '',
                imageUrl: item.Poster && item.Poster !== 'N/A' ? item.Poster.replace('SX300', 'SX1000') : ''
              };
            })
          );
          setMediaResults(detailed);
        }
      } else if (formData.type === 'Book') {
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_YOUTUBE_API_KEY;
        let res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=6${apiKey ? `&key=${apiKey}` : ''}`);
        if (!res.ok && apiKey) {
          res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=6`);
        }
        const data = await res.json();
        if (data.items && Array.isArray(data.items)) {
          setMediaResults(
            data.items.map((item: any) => {
              const info = item.volumeInfo || {};
              const images = info.imageLinks || {};
              const rawImage = images.extraLarge || images.large || images.medium || images.thumbnail || images.smallThumbnail || '';
              const highResImage = rawImage
                ? rawImage.replace('http:', 'https:').replace('&edge=curl', '').replace('zoom=1', 'zoom=2')
                : '';
              return {
                title: info.title || formData.title,
                creator: info.authors ? info.authors.join(', ') : '',
                description: info.description || '',
                link: info.infoLink || '',
                imageUrl: highResImage
              };
            })
          );
        }
      } else if (formData.type === 'Podcast' || formData.type === 'Music') {
        const entity = formData.type === 'Podcast' ? 'podcast' : 'album';
        const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=${entity}&limit=6`);
        const data = await res.json();
        if (data.results && Array.isArray(data.results)) {
          setMediaResults(
            data.results.map((item: any) => ({
              title: item.collectionName || item.trackName || formData.title,
              creator: item.artistName || '',
              description: '',
              link: item.collectionViewUrl || item.trackViewUrl || '',
              imageUrl: (item.artworkUrl600 || item.artworkUrl512 || item.artworkUrl100 || '')
                .replace('600x600bb', '1000x1000bb')
                .replace('512x512bb', '1000x1000bb')
                .replace('100x100bb', '1000x1000bb')
            }))
          );
        }
      } else if (formData.type === 'YouTube Video') {
        const isYtUrl = cleanQuery.includes('youtube.com/') || cleanQuery.includes('youtu.be/');
        const results: Array<{ title: string; creator: string; description: string; link: string; imageUrl: string }> = [];
        if (isYtUrl) {
          try {
            const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${q}&format=json`);
            if (oembedRes.ok) {
              const oembedData = await oembedRes.json();
              results.push({
                title: oembedData.title,
                creator: oembedData.author_name,
                description: '',
                link: cleanQuery,
                imageUrl: oembedData.thumbnail_url
              });
            }
          } catch {
            // ignore
          }
        }
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_YOUTUBE_API_KEY;
        if (apiKey && results.length === 0) {
          const ytRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&maxResults=6&type=video&key=${apiKey}`
          );
          if (ytRes.ok) {
            const ytData = await ytRes.json();
            (ytData.items || []).forEach((item: any) => {
              results.push({
                title: item.snippet.title,
                creator: item.snippet.channelTitle,
                description: item.snippet.description || '',
                link: `https://www.youtube.com/watch?v=${item.id.videoId}`,
                imageUrl:
                  item.snippet.thumbnails.maxres?.url ||
                  item.snippet.thumbnails.high?.url ||
                  item.snippet.thumbnails.default?.url ||
                  ''
              });
            });
          }
        }
        setMediaResults(results);
      }
    } catch (error) {
      console.error('Quick lookup error:', error);
    } finally {
      setIsSearchingMedia(false);
    }
  };

  const syncCoversAndMetadata = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    showToast('success', 'Synkroniserer høyoppløste omslag...');

    let updatedCount = 0;
    const omdbKey = import.meta.env.VITE_OMDB_API_KEY || 'b054da29';
    const actualOmdbKey = omdbKey.includes('apikey=') ? omdbKey.split('apikey=')[1].split('&')[0] : omdbKey;
    const googleKey = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_YOUTUBE_API_KEY;

    try {
      for (const item of recommendations) {
        let newImageUrl = item.imageUrl || '';
        let newCreator = item.creator || '';
        let needsUpdate = false;

        if (item.type === 'Podcast' || item.type === 'Music') {
          const upgraded = newImageUrl
            .replace('100x100bb', '1000x1000bb')
            .replace('512x512bb', '1000x1000bb')
            .replace('600x600bb', '1000x1000bb');
          if (upgraded !== newImageUrl) {
            newImageUrl = upgraded;
            needsUpdate = true;
          }
        }

        const isLowResOrMissing =
          !newImageUrl ||
          newImageUrl.includes('SX300') ||
          newImageUrl.includes('zoom=1') ||
          (brokenImages[getImageKey(item.id, item.imageUrl)] || 0) >= 2;

        if (isLowResOrMissing) {
          const q = encodeURIComponent(item.title);
          if (item.type === 'Movie' || item.type === 'TV Series' || item.type === 'Documentary') {
            const typeParam = item.type === 'TV Series' ? 'series' : 'movie';
            const res = await fetch(`https://www.omdbapi.com/?t=${q}&type=${typeParam}&apikey=${actualOmdbKey}`);
            if (res.ok) {
              const data = await res.json();
              if (data.Response !== 'False' && data.Poster && data.Poster !== 'N/A') {
                newImageUrl = data.Poster.replace('SX300', 'SX1000');
                if (!newCreator && data.Year) newCreator = data.Year;
                needsUpdate = true;
              }
            }
          } else if (item.type === 'Book') {
            const res = await fetch(
              `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`${item.title} ${item.creator || ''}`)}&maxResults=1${googleKey ? `&key=${googleKey}` : ''}`
            );
            if (res.ok) {
              const data = await res.json();
              const info = data.items?.[0]?.volumeInfo;
              if (info) {
                const images = info.imageLinks || {};
                const rawImg = images.extraLarge || images.large || images.medium || images.thumbnail || '';
                if (rawImg) {
                  newImageUrl = rawImg.replace('http:', 'https:').replace('&edge=curl', '').replace('zoom=1', 'zoom=2');
                  if (!newCreator && info.authors?.length) newCreator = info.authors.join(', ');
                  needsUpdate = true;
                }
              }
            }
          } else if (item.type === 'Podcast') {
            const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=podcast&limit=1`);
            if (res.ok) {
              const data = await res.json();
              const pod = data.results?.[0];
              if (pod && (pod.artworkUrl600 || pod.artworkUrl100)) {
                newImageUrl = (pod.artworkUrl600 || pod.artworkUrl100)
                  .replace('600x600bb', '1000x1000bb')
                  .replace('100x100bb', '1000x1000bb');
                if (!newCreator && pod.artistName) newCreator = pod.artistName;
                needsUpdate = true;
              }
            }
          }
        }

        if (needsUpdate) {
          await updateDoc(doc(db, COLLECTION_NAME, item.id), {
            imageUrl: newImageUrl,
            creator: newCreator,
            updatedAt: serverTimestamp()
          });
          updatedCount++;
        }
      }
      showToast('success', `Synkronisering fullført! Oppdaterte ${updatedCount} omslag.`);
    } catch (err) {
      console.error('Sync failed:', err);
      showToast('error', 'Synkronisering feilet delvis.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveRecommendation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    const normalizedImageUrl = normalizeImageUrl(formData.imageUrl);
    const normalizedLink = formData.link.trim()
      ? formData.link.trim().startsWith('http://') || formData.link.trim().startsWith('https://')
        ? formData.link.trim()
        : `https://${formData.link.trim()}`
      : '';

    const payload: Record<string, any> = {
      title: formData.title.trim(),
      type: formData.type,
      recommendedBy: formData.recommendedBy,
      creator: formData.creator.trim(),
      dateRecommended: formData.dateRecommended || getTodayIso(),
      callDate: formData.callDate || formData.dateRecommended || getTodayIso(),
      link: normalizedLink,
      description: formData.description.trim(),
      status: formData.status,
      review: formData.review.trim(),
      rating: formData.rating ?? null,
      imageUrl: normalizedImageUrl,
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
        // Clear any previous broken image state for this item
        setBrokenImages((prev) => {
          const next = { ...prev };
          delete next[getImageKey(editingId, normalizedImageUrl)];
          return next;
        });
        if (selectedItem?.id === editingId) {
          setSelectedItem((prev) => (prev ? { ...prev, ...payload } : null));
        }
        showToast('success', 'Anbefaling oppdatert.');
      } else {
        await addDoc(collection(db, COLLECTION_NAME), {
          ...payload,
          createdAt: serverTimestamp()
        }).catch((err) =>
          handleFirestoreError(err, OperationType.CREATE, COLLECTION_NAME)
        );
        showToast('success', 'Anbefaling lagt til i samlingen.');
      }
      setIsFormOpen(false);
      setEditingId(null);
    } catch (error: any) {
      showToast('error', `Kunne ikke lagre anbefaling: ${error.message || 'Ukjent feil'}`);
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
      showToast('success', 'Status og vurdering er lagret.');
    } catch (error: any) {
      showToast('error', `Kunne ikke lagre vurdering: ${error.message || 'Ukjent feil'}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `${COLLECTION_NAME}/${id}`)
      );
      if (selectedItem?.id === id) setSelectedItem(null);
      setDeleteConfirmation(null);
      showToast('success', 'Anbefaling slettet.');
    } catch {
      showToast('error', 'Kunne ikke slette anbefaling.');
      setDeleteConfirmation(null);
    }
  };

  const otherPerson: RecommendedByRole = activePerson === 'owner' ? 'friend' : 'owner';

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

  // Category Counts (for the Public-style Pill Bar)
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { All: recommendations.length };
    recommendations.forEach((r) => {
      counts[r.type] = (counts[r.type] || 0) + 1;
    });
    return counts;
  }, [recommendations]);

  // Visible category tabs: Always show 'All' + standard types that either have items or are core categories
  const visibleCategoryTabs = useMemo(() => {
    const coreTypes: RecommendationType[] = [
      'Book',
      'Movie',
      'TV Series',
      'Documentary',
      'YouTube Video',
      'Podcast',
      'Article',
      'Music',
      'Website',
      'Other'
    ];
    const activeTypes = coreTypes.filter(
      (t) =>
        (typeCounts[t] || 0) > 0 ||
        ['Book', 'Movie', 'TV Series', 'YouTube Video', 'Podcast', 'Documentary'].includes(t) ||
        selectedType === t
    );
    return ['All', ...activeTypes];
  }, [typeCounts, selectedType]);

  // Filtered & Sorted Recommendations
  const filteredRecommendations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = recommendations.filter((rec) => {
      // Shelf-level quick filters
      if (activeShelf === 'for-me') {
        if (rec.recommendedBy !== otherPerson || rec.status === 'Seen/Finished') return false;
      } else if (activeShelf === 'for-friend') {
        if (rec.recommendedBy !== activePerson || rec.status === 'Seen/Finished') return false;
      } else if (activeShelf === 'completed') {
        if (rec.status !== 'Seen/Finished') return false;
      } else if (activeShelf === 'highly-rated') {
        if ((rec.rating || 0) < 4) return false;
      }

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
        const typeLabelNo = getTypeLabelNo(rec.type).toLowerCase();
        const matches =
          rec.title.toLowerCase().includes(q) ||
          rec.type.toLowerCase().includes(q) ||
          typeLabelNo.includes(q) ||
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
      if (activeShelf === 'highly-rated' && sortBy === 'newest') {
        return (b.rating || 0) - (a.rating || 0);
      }
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
    activeShelf,
    otherPerson,
    activePerson,
    searchQuery,
    selectedType,
    selectedRecommender,
    selectedCallDate,
    selectedStatus,
    sortBy,
    config
  ]);

  // Overview Derived Sections
  const overviewSections = useMemo(() => {
    const sortedByNewest = [...recommendations].sort((a, b) =>
      (b.dateRecommended || '').localeCompare(a.dateRecommended || '')
    );

    const recentlyRecommended = sortedByNewest.slice(0, 6);

    const thingsINeedToCheckOut = sortedByNewest.filter(
      (r) => r.recommendedBy === otherPerson && r.status !== 'Seen/Finished'
    );

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

  const activeExtraFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim() !== '') count++;
    if (selectedRecommender !== 'all') count++;
    if (selectedStatus !== 'all') count++;
    if (selectedCallDate !== 'all') count++;
    if (sortBy !== 'newest') count++;
    if (activeShelf !== 'all') count++;
    return count;
  }, [searchQuery, selectedRecommender, selectedStatus, selectedCallDate, sortBy, activeShelf]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedType('All');
    setSelectedRecommender('all');
    setSelectedStatus('all');
    setSelectedCallDate('all');
    setSortBy('newest');
    setActiveShelf('all');
  };

  const getTypeIcon = (type: RecommendationType, size = 18) => {
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
        return <CheckCircle2 size={size} className="text-emerald-500 shrink-0" />;
      case 'Planning to Watch/Read/Listen':
        return <Clock size={size} className="text-amber-500 shrink-0" />;
      default:
        return <Circle size={size} className="text-ink/30 shrink-0" />;
    }
  };

  // 1. Loading State (matching Public Recommendations)
  if (!authChecked || !configLoaded || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-40 flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-accent animate-pulse" size={20} />
        </div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-ink/40 font-black animate-pulse">
          Henter felles samling
        </p>
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
          className="max-w-md w-full bg-surface border border-ink/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl text-center"
        >
          <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-6">
            <PhoneCall size={22} />
          </div>

          <h1 className="text-4xl md:text-5xl font-serif text-ink mb-3 tracking-tight">
            Våre <span className="italic font-light text-accent">Anbefalinger</span>
          </h1>
          <p className="text-sm text-ink/60 font-serif italic leading-relaxed mb-8">
            Et privat rom for {config.ownerName} og {config.friendName} for å lagre, følge opp og diskutere ting vi anbefaler hverandre i telefonsamtaler.
          </p>

          <form onSubmit={handlePasswordSubmit} className="space-y-5 text-left">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-black text-ink/40 mb-2">
                Passord
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
                  placeholder="Skriv inn passord..."
                  className="w-full pl-11 pr-4 py-4 bg-paper border border-ink/10 rounded-2xl text-sm text-ink focus:outline-none focus:border-accent transition-colors"
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
              className="w-full py-4 rounded-2xl justify-center shadow-xl shadow-accent/10"
            >
              Lås opp samlingen
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-ink/5 text-[10px] uppercase tracking-widest text-ink/30 font-bold flex items-center justify-between">
            <span>Ingen konto kreves</span>
            <span>Passordbeskyttet</span>
          </div>
        </motion.div>
      </div>
    );
  }

  // Public-style Poster / Cover Card
  const renderPosterCard = (item: PrivateRecommendationItem, idx = 0) => {
    const isCompleted = item.status === 'Seen/Finished';
    const isPlanning = item.status === 'Planning to Watch/Read/Listen';
    const isSquare = isSquareAspectType(item.type);
    const subtitle = item.creator
      ? `${item.creator} · Fra ${getPersonName(item.recommendedBy)}`
      : `Fra ${getPersonName(item.recommendedBy)} · ${formatReadableDate(item.callDate)}`;

    return (
      <motion.div
        key={item.id}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{
          duration: 0.4,
          delay: Math.min(idx * 0.03, 0.3),
          ease: [0.215, 0.61, 0.355, 1]
        }}
        onClick={() => setSelectedItem(item)}
        className="group cursor-pointer flex flex-col"
      >
        <div
          className={`relative ${
            isSquare ? 'aspect-square rounded-[2.5rem]' : 'aspect-[2/3] rounded-2xl'
          } w-full overflow-hidden bg-surface shadow-sm group-hover:shadow-2xl group-hover:shadow-accent/10 transition-all duration-700 border border-ink/5 group-hover:border-accent/20`}
        >
          {(() => {
            const imgKey = getImageKey(item.id, item.imageUrl);
            const errorStage = brokenImages[imgKey] || 0;
            const resolvedSrc = getDisplayImageUrl(item.imageUrl, errorStage);
            return resolvedSrc && errorStage < 2 ? (
              <img
                src={resolvedSrc}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-110"
                referrerPolicy="no-referrer"
                onError={() => handleImageError(item.id, item.imageUrl)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-ink/[0.02] to-ink/[0.08]">
                <div className="text-accent/25 mb-4 transform group-hover:scale-110 group-hover:text-accent/50 transition-all duration-500">
                  {getTypeIcon(item.type, 24)}
                </div>
                <h3 className="font-serif text-xs font-bold line-clamp-3 text-ink/70 px-2 leading-relaxed">
                  {item.title}
                </h3>
                <p className="text-[8px] uppercase tracking-[0.2em] text-ink/35 mt-3 font-black">
                  {item.creator || `Fra ${getPersonName(item.recommendedBy)}`}
                </p>
                <p className="text-[8px] font-mono text-ink/25 mt-1">
                  {formatReadableDate(item.callDate)}
                </p>
              </div>
            );
          })()}

          {/* Top Left Hover Badge: Type */}
          <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[7px] uppercase tracking-widest font-black flex items-center gap-1.5">
              {getTypeIcon(item.type, 11)}
              <span>{getTypeLabelNo(item.type)}</span>
            </div>
          </div>

          {/* Top Right Persistent Badge: Completed / Rating / Planning */}
          {(isCompleted || isPlanning || item.rating) && (
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
              {item.rating && (
                <div className="px-2 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/10 text-amber-400 text-[8px] font-mono font-bold flex items-center gap-1">
                  <Star size={9} className="fill-amber-400 text-amber-400" />
                  <span>{item.rating}</span>
                </div>
              )}
              {isCompleted ? (
                <div
                  className="w-6 h-6 rounded-full bg-emerald-500/90 backdrop-blur-md text-white flex items-center justify-center shadow-sm"
                  title="Sett / Ferdig"
                >
                  <Check size={12} />
                </div>
              ) : isPlanning ? (
                <div
                  className="w-6 h-6 rounded-full bg-amber-500/90 backdrop-blur-md text-white flex items-center justify-center shadow-sm"
                  title="Planlegger å se/lese/høre"
                >
                  <Clock size={11} />
                </div>
              ) : null}
            </div>
          )}

          {/* Hover Overlay (matches public Recommendations) */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-5">
            <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
              <p className="text-white/60 text-[8px] uppercase tracking-[0.2em] font-black mb-1">
                Fra {getPersonName(item.recommendedBy)} · Samtale {formatReadableDate(item.callDate)}
              </p>
              <h3 className="text-white font-serif text-sm font-bold leading-snug line-clamp-2">
                {item.title}
              </h3>
              {item.review && (
                <p className="text-white/75 font-serif italic text-[11px] line-clamp-2 mt-1.5">
                  «{item.review}»
                </p>
              )}
              <div className="mt-3 pt-3 border-t border-white/15 flex items-center justify-between gap-2 text-white/60 text-[8px] uppercase tracking-widest font-black">
                <button
                  type="button"
                  onClick={(e) => openReviewModal(item, e)}
                  className="px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-accent text-white transition-colors"
                >
                  {isCompleted ? 'Oppdater vurdering' : 'Fullfør & vurder'}
                </button>
                <span className="flex items-center gap-1">
                  <span>Detaljer</span>
                  <ExternalLink size={10} />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Title & Subtitle below card (exact public style) */}
        <div className="mt-4 px-1 space-y-1">
          <h3 className="font-serif text-sm font-medium text-ink/90 group-hover:text-accent transition-colors truncate leading-tight">
            {item.title}
          </h3>
          <p className="text-[9px] uppercase tracking-widest text-ink/30 font-bold truncate">
            {subtitle}
          </p>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      {/* Status Toast */}
      <AnimatePresence>
        {statusBanner && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={`fixed top-20 right-6 z-50 px-5 py-3 rounded-2xl shadow-lg border text-xs font-medium flex items-center gap-2.5 ${
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

      {/* Header Section (matching Public Recommendations layout) */}
      <div className="flex flex-col items-center mb-20 text-center relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 px-4 py-1.5 rounded-full bg-accent/5 border border-accent/10 text-accent text-[9px] uppercase tracking-[0.3em] font-black flex items-center gap-2"
        >
          <PhoneCall size={12} />
          <span>
            Privat samling · {config.ownerName} &amp; {config.friendName}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-6xl md:text-8xl font-serif mb-6 tracking-tighter leading-[0.9]"
        >
          Våre <span className="italic font-light text-accent">Anbefalinger</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-ink/50 text-sm md:text-base max-w-xl font-serif italic leading-relaxed"
        >
          Vårt felles minne om filmer, bøker, podkaster og samtaler — lagret fra telefonsamtalene våre, fulgt opp og diskutert i etterkant.
        </motion.p>

        {/* Action Buttons & Viewing As Controls */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Button
            onClick={() => openAddModal()}
            variant="primary"
            size="lg"
            icon={Plus}
            magnetic={true}
            className="rounded-2xl px-8 shadow-xl shadow-accent/10"
          >
            Legg til anbefaling
          </Button>

          <Button
            onClick={syncCoversAndMetadata}
            variant="outline"
            size="lg"
            icon={RefreshCw}
            isLoading={isSyncing}
            magnetic={true}
            className="rounded-2xl border-ink/10 hover:bg-ink/5"
            title="Hent automatisk høyoppløste omslag for anbefalingene"
          >
            Synkroniser omslag
          </Button>

          {/* Active Person Selector - Only Admin can change Viewing As */}
          {isAdmin ? (
            <div className="flex items-center bg-surface/60 backdrop-blur-md border border-ink/10 rounded-2xl p-1.5">
              <span className="text-[9px] uppercase tracking-widest font-black text-ink/40 px-3 flex items-center gap-1.5 whitespace-nowrap">
                <UserCheck size={13} className="text-accent" />
                Viser som:
              </span>
              <button
                type="button"
                onClick={() => handleSwitchPerson('owner')}
                className={`px-3.5 py-2 rounded-xl text-[9px] uppercase tracking-widest font-black transition-all whitespace-nowrap ${
                  activePerson === 'owner'
                    ? 'bg-ink text-paper shadow-sm'
                    : 'text-ink/40 hover:text-ink'
                }`}
              >
                {config.ownerName}
              </button>
              <button
                type="button"
                onClick={() => handleSwitchPerson('friend')}
                className={`px-3.5 py-2 rounded-xl text-[9px] uppercase tracking-widest font-black transition-all whitespace-nowrap ${
                  activePerson === 'friend'
                    ? 'bg-ink text-paper shadow-sm'
                    : 'text-ink/40 hover:text-ink'
                }`}
              >
                {config.friendName}
              </button>
            </div>
          ) : (
            <div className="flex items-center bg-surface/60 backdrop-blur-md border border-ink/10 rounded-2xl px-4 py-3">
              <span className="text-[9px] uppercase tracking-widest font-black text-ink/50 flex items-center gap-1.5 whitespace-nowrap">
                <UserCheck size={13} className="text-accent" />
                <span>Viser som {config.friendName}</span>
              </span>
            </div>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setSettingsForm(config);
                setIsSettingsOpen(true);
              }}
              className="px-4 py-3 rounded-2xl bg-surface/60 border border-ink/10 hover:border-accent/40 text-[9px] uppercase tracking-widest font-black text-ink/70 hover:text-ink flex items-center gap-2 transition-colors whitespace-nowrap"
              title="Endre passord og navn"
            >
              <KeyRound size={14} className="text-accent" />
              <span>Passord &amp; navn</span>
            </button>
          )}

          {!isAdmin && isFriendUnlocked && (
            <button
              type="button"
              onClick={handleLockSpace}
              className="px-4 py-3 rounded-2xl bg-surface/60 border border-ink/10 hover:border-red-500/40 text-[9px] uppercase tracking-widest font-black text-ink/50 hover:text-red-500 flex items-center gap-1.5 transition-colors whitespace-nowrap"
              title="Lås privat samling"
            >
              <LogOut size={14} />
              <span>Lås</span>
            </button>
          )}
        </motion.div>

        {/* Primary Media Type Filter (Shown by Default) + Expandable Extra Filters */}
        <div className="mt-14 w-full max-w-5xl space-y-5">
          {/* Category Pill Bar (Default Filter for Media Type) */}
          <div className="flex flex-wrap justify-center gap-2 p-2 bg-surface/40 backdrop-blur-xl rounded-[2rem] border border-ink/5 shadow-inner">
            {visibleCategoryTabs.map((cat) => {
              const count = typeCounts[cat] || 0;
              const isSelected = selectedType === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedType(cat)}
                  className={`group relative px-6 py-3 rounded-full text-[10px] uppercase tracking-[0.15em] font-black transition-all duration-500 flex items-center gap-2.5 ${
                    isSelected ? 'text-white' : 'text-ink/40 hover:text-ink'
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="activePrivateCategory"
                      className="absolute inset-0 bg-accent rounded-full shadow-lg shadow-accent/20"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10">{getTypeLabelNo(cat)}</span>
                  <span
                    className={`relative z-10 text-[8px] px-1.5 py-0.5 rounded-full transition-colors ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-ink/5 text-ink/30 group-hover:text-ink/60'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Toggle button for additional sorting & filtering */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowMoreFilters((prev) => !prev)}
              className={`px-5 py-2.5 rounded-full text-[10px] uppercase tracking-[0.18em] font-black transition-all flex items-center gap-2 border ${
                showMoreFilters || activeExtraFilterCount > 0
                  ? 'bg-ink text-paper border-ink shadow-sm'
                  : 'bg-surface/50 text-ink/60 border-ink/10 hover:text-ink hover:border-ink/25'
              }`}
            >
              <SlidersHorizontal size={13} />
              <span>
                {showMoreFilters ? 'Skjul ekstra filtre og sortering' : 'Flere filtre og sortering'}
              </span>
              {activeExtraFilterCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[8px] bg-accent text-white">
                  {activeExtraFilterCount}
                </span>
              )}
              {showMoreFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {(activeExtraFilterCount > 0 || selectedType !== 'All') && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-4 py-2.5 rounded-full text-[10px] uppercase tracking-[0.15em] font-black text-accent hover:bg-accent/10 transition-colors flex items-center gap-1.5"
              >
                <X size={12} />
                <span>Nullstill filtre</span>
              </button>
            )}
          </div>

          {/* Collapsible Extra Filters & Sorting Panel */}
          <AnimatePresence>
            {showMoreFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="p-6 rounded-[2rem] bg-surface/50 backdrop-blur-xl border border-ink/10 space-y-6 shadow-sm">
                  <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                    {/* Search Input */}
                    <div className="relative w-full lg:w-96 group">
                      <Search
                        className="absolute left-5 top-1/2 -translate-y-1/2 text-ink/30 group-focus-within:text-accent transition-colors"
                        size={17}
                      />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Søk etter tittel, skaper, notat eller dato..."
                        className="w-full pl-12 pr-10 py-3.5 bg-paper border border-ink/10 rounded-2xl text-xs focus:outline-none focus:border-accent/40 transition-all"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink transition-colors"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Call Date, Recommender, Status & Sort Controls */}
                    <div className="flex flex-wrap items-center justify-center gap-2.5">
                      {/* Phone Call Date Filter */}
                      <select
                        value={selectedCallDate}
                        onChange={(e) => setSelectedCallDate(e.target.value)}
                        className="px-3.5 py-2.5 bg-paper border border-ink/10 rounded-2xl text-[10px] uppercase tracking-wider font-black text-ink/70 focus:outline-none focus:border-accent/40"
                      >
                        <option value="all">Alle samtaler ({callDatesSummary.length})</option>
                        {callDatesSummary.map((call) => (
                          <option key={call.date} value={call.date}>
                            Samtale: {formatReadableDate(call.date)} ({call.total})
                          </option>
                        ))}
                      </select>

                      {/* Recommended By Filter */}
                      <select
                        value={selectedRecommender}
                        onChange={(e) => setSelectedRecommender(e.target.value as any)}
                        className="px-3.5 py-2.5 bg-paper border border-ink/10 rounded-2xl text-[10px] uppercase tracking-wider font-black text-ink/70 focus:outline-none focus:border-accent/40"
                      >
                        <option value="all">Anbefalt av begge</option>
                        <option value="owner">Fra {config.ownerName}</option>
                        <option value="friend">Fra {config.friendName}</option>
                      </select>

                      {/* Status Filter */}
                      <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value as any)}
                        className="px-3.5 py-2.5 bg-paper border border-ink/10 rounded-2xl text-[10px] uppercase tracking-wider font-black text-ink/70 focus:outline-none focus:border-accent/40"
                      >
                        <option value="all">Alle statuser</option>
                        <option value="unfinished">Ikke fullført</option>
                        <option value="Not Seen">Ikke sett</option>
                        <option value="Planning to Watch/Read/Listen">Planlegger</option>
                        <option value="Seen/Finished">Fullført</option>
                      </select>

                      {/* Sort Selector */}
                      <div className="flex flex-wrap items-center gap-1.5 bg-paper p-1.5 rounded-2xl border border-ink/10">
                        <span className="text-[9px] uppercase tracking-widest font-black text-ink/40 pl-2.5">
                          Sorter:
                        </span>
                        {(
                          [
                            { id: 'newest', label: 'Nyeste' },
                            { id: 'oldest', label: 'Eldste' },
                            { id: 'call-newest', label: 'Samtaledato' },
                            { id: 'rating', label: 'Vurdering' },
                            { id: 'title', label: 'Tittel' }
                          ] as const
                        ).map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setSortBy(option.id)}
                            className={`px-2.5 py-1.5 rounded-xl text-[9px] uppercase tracking-widest font-black transition-all ${
                              sortBy === option.id
                                ? 'bg-ink text-paper shadow-sm'
                                : 'text-ink/40 hover:text-ink'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Curated Shelves Selector */}
                  <div className="pt-4 border-t border-ink/5 flex flex-wrap items-center justify-center gap-2">
                    <span className="text-[9px] uppercase tracking-widest font-black text-ink/35 mr-1">
                      Visning:
                    </span>
                    {(
                      [
                        { id: 'all', label: 'Alle anbefalinger', count: recommendations.length },
                        {
                          id: 'for-me',
                          label: 'Ting jeg må sjekke ut',
                          count: overviewSections.thingsINeedToCheckOut.length
                        },
                        {
                          id: 'for-friend',
                          label: `Til ${getPersonName(otherPerson)}`,
                          count: overviewSections.thingsOtherNeedsToCheckOut.length
                        },
                        {
                          id: 'completed',
                          label: 'Fullført',
                          count: overviewSections.completed.length
                        },
                        {
                          id: 'highly-rated',
                          label: 'Høyt vurdert',
                          count: overviewSections.highlyRated.length
                        },
                        {
                          id: 'overview',
                          label: 'Oversiktshyller',
                          count: null
                        },
                        {
                          id: 'calls',
                          label: 'Etter telefonsamtale',
                          count: callDatesSummary.length
                        }
                      ] as const
                    ).map((shelf) => {
                      const isSelected = activeShelf === shelf.id;
                      return (
                        <button
                          key={shelf.id}
                          type="button"
                          onClick={() => setActiveShelf(shelf.id)}
                          className={`px-4 py-2 rounded-full text-[9px] uppercase tracking-[0.15em] font-black transition-all flex items-center gap-2 border ${
                            isSelected
                              ? 'bg-ink text-paper border-ink shadow-sm'
                              : 'bg-paper text-ink/55 border-ink/10 hover:text-ink hover:border-ink/25'
                          }`}
                        >
                          <span>{shelf.label}</span>
                          {shelf.count !== null && (
                            <span
                              className={`text-[8px] px-1.5 py-0.5 rounded-full ${
                                isSelected ? 'bg-paper/20 text-paper' : 'bg-ink/5 text-ink/40'
                              }`}
                            >
                              {shelf.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Content Area */}
      {recommendations.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-24 text-center space-y-6 max-w-lg mx-auto"
        >
          <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto text-accent">
            <PhoneCall size={24} />
          </div>
          <h2 className="text-3xl font-serif text-ink">Start deres felles samling</h2>
          <p className="font-serif italic text-ink/50 text-sm leading-relaxed">
            Når du og {config.friendName} nevner en film, bok, podkast eller video i løpet av en telefonsamtale, kan dere legge den til her i det felles arkivet.
          </p>
          <Button
            onClick={() => openAddModal()}
            variant="primary"
            size="lg"
            icon={Plus}
            className="rounded-2xl px-8 shadow-xl shadow-accent/10"
          >
            Legg til første anbefaling
          </Button>
        </motion.div>
      ) : activeShelf === 'overview' && !hasActiveFilters ? (
        /* Curated Overview Shelves using the 6-Column Poster Grid */
        <div className="space-y-20">
          {/* 1. Recently Recommended */}
          <section className="space-y-8">
            <div className="flex items-end justify-between border-b border-ink/10 pb-4">
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-accent font-black mb-1">
                  Siste tilskudd
                </p>
                <h2 className="text-3xl md:text-4xl font-serif text-ink">
                  Nylig anbefalt
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveShelf('all')}
                className="text-[10px] uppercase tracking-widest font-black text-accent hover:underline"
              >
                Se alle ({recommendations.length})
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-12">
              {overviewSections.recentlyRecommended.map((item, idx) => renderPosterCard(item, idx))}
            </div>
          </section>

          {/* 2. Things I Still Need to Check Out */}
          <section className="space-y-8">
            <div className="flex items-end justify-between border-b border-ink/10 pb-4">
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-accent font-black mb-1">
                  Anbefalt av {getPersonName(otherPerson)} til {getPersonName(activePerson)}
                </p>
                <h2 className="text-3xl md:text-4xl font-serif text-ink">
                  Ting jeg fortsatt må sjekke ut
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveShelf('for-me')}
                className="text-[10px] uppercase tracking-widest font-black text-accent hover:underline"
              >
                Se alle ({overviewSections.thingsINeedToCheckOut.length})
              </button>
            </div>
            {overviewSections.thingsINeedToCheckOut.length === 0 ? (
              <p className="font-serif italic text-ink/40 py-6">
                Du har kommet deg gjennom alle anbefalingene fra {getPersonName(otherPerson)}.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-12">
                {overviewSections.thingsINeedToCheckOut.slice(0, 6).map((item, idx) => renderPosterCard(item, idx))}
              </div>
            )}
          </section>

          {/* 3. Things My Friend Still Needs to Check Out */}
          <section className="space-y-8">
            <div className="flex items-end justify-between border-b border-ink/10 pb-4">
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-accent font-black mb-1">
                  Anbefalt av {getPersonName(activePerson)} til {getPersonName(otherPerson)}
                </p>
                <h2 className="text-3xl md:text-4xl font-serif text-ink">
                  Ting {getPersonName(otherPerson)} fortsatt må sjekke ut
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveShelf('for-friend')}
                className="text-[10px] uppercase tracking-widest font-black text-accent hover:underline"
              >
                Se alle ({overviewSections.thingsOtherNeedsToCheckOut.length})
              </button>
            </div>
            {overviewSections.thingsOtherNeedsToCheckOut.length === 0 ? (
              <p className="font-serif italic text-ink/40 py-6">
                Ingen ventende anbefalinger til {getPersonName(otherPerson)}.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-12">
                {overviewSections.thingsOtherNeedsToCheckOut.slice(0, 6).map((item, idx) => renderPosterCard(item, idx))}
              </div>
            )}
          </section>

          {/* 4. Completed */}
          <section className="space-y-8">
            <div className="flex items-end justify-between border-b border-ink/10 pb-4">
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-accent font-black mb-1">
                  Ferdig &amp; diskutert
                </p>
                <h2 className="text-3xl md:text-4xl font-serif text-ink">
                  Fullført
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveShelf('completed')}
                className="text-[10px] uppercase tracking-widest font-black text-accent hover:underline"
              >
                Se alle ({overviewSections.completed.length})
              </button>
            </div>
            {overviewSections.completed.length === 0 ? (
              <p className="font-serif italic text-ink/40 py-6">
                Ingen fullførte anbefalinger ennå.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-12">
                {overviewSections.completed.slice(0, 6).map((item, idx) => renderPosterCard(item, idx))}
              </div>
            )}
          </section>

          {/* 5. Highly Rated */}
          <section className="space-y-8">
            <div className="flex items-end justify-between border-b border-ink/10 pb-4">
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-accent font-black mb-1">
                  4 &amp; 5 stjerners favoritter
                </p>
                <h2 className="text-3xl md:text-4xl font-serif text-ink">
                  Høyt vurdert
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveShelf('highly-rated')}
                className="text-[10px] uppercase tracking-widest font-black text-accent hover:underline"
              >
                Se alle ({overviewSections.highlyRated.length})
              </button>
            </div>
            {overviewSections.highlyRated.length === 0 ? (
              <p className="font-serif italic text-ink/40 py-6">
                Ingen vurderte anbefalinger ennå.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-12">
                {overviewSections.highlyRated.slice(0, 6).map((item, idx) => renderPosterCard(item, idx))}
              </div>
            )}
          </section>
        </div>
      ) : activeShelf === 'calls' && !hasActiveFilters ? (
        /* Chronological Phone Call Archive using the 6-Column Poster Grid */
        <div className="space-y-20">
          {callDatesSummary.map((callGroup) => {
            const itemsForCall = recommendations.filter(
              (r) => (r.callDate || r.dateRecommended) === callGroup.date
            );
            return (
              <section key={callGroup.date} className="space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-ink/10 pb-4">
                  <div>
                    <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.3em] text-accent font-black mb-1">
                      <PhoneCall size={12} />
                      <span>
                        Telefonsamtale · {callGroup.completed} av {callGroup.total} fullført
                      </span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-serif text-ink">
                      {formatReadableDate(callGroup.date)}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAddModal(callGroup.date)}
                    className="self-start sm:self-auto px-4 py-2 rounded-full bg-surface border border-ink/10 hover:border-accent text-[9px] uppercase tracking-widest font-black text-ink/70 hover:text-ink flex items-center gap-1.5 transition-colors"
                  >
                    <Plus size={12} className="text-accent" />
                    <span>Legg til i samtalen</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-12">
                  {itemsForCall.map((item, idx) => renderPosterCard(item, idx))}
                </div>
              </section>
            );
          })}
        </div>
      ) : filteredRecommendations.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-32 text-center space-y-4"
        >
          <div className="w-12 h-12 bg-ink/5 rounded-full flex items-center justify-center mx-auto text-ink/20">
            <Search size={24} />
          </div>
          <p className="font-serif italic text-ink/40">Ingen anbefalinger funnet som passer filtrene dine.</p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-[10px] uppercase tracking-widest font-black text-accent hover:underline"
          >
            Nullstill filtre
          </button>
        </motion.div>
      ) : (
        /* Default 6-Column Visual Poster Grid (Exact Public Layout) */
        <motion.div
          layout
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-12"
        >
          <AnimatePresence mode="popLayout">
            {filteredRecommendations.map((item, idx) => renderPosterCard(item, idx))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Detail Modal (Matching Public Split-View Layout) */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-xl"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-4xl bg-surface border border-ink/10 rounded-[3rem] overflow-hidden shadow-2xl z-10 flex flex-col md:flex-row max-h-[90vh]"
            >
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="absolute top-6 right-6 z-20 p-3 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-all hover:rotate-90"
              >
                <X size={20} />
              </button>

              {/* Left Side: Visual Poster */}
              <div className="w-full md:w-2/5 bg-ink/[0.02] relative flex items-center justify-center p-8 md:p-12 overflow-hidden border-b md:border-b-0 md:border-r border-ink/5">
                {(() => {
                  const imgKey = getImageKey(selectedItem.id, selectedItem.imageUrl);
                  const errorStage = brokenImages[imgKey] || 0;
                  const resolvedSrc = getDisplayImageUrl(selectedItem.imageUrl, errorStage);
                  const canShowImg = Boolean(resolvedSrc && errorStage < 2);
                  return (
                    <>
                      {canShowImg && (
                        <div
                          className="absolute inset-0 opacity-20 blur-3xl scale-150 pointer-events-none"
                          style={{
                            backgroundImage: `url("${resolvedSrc}")`,
                            backgroundPosition: 'center',
                            backgroundSize: 'cover'
                          }}
                        />
                      )}

                      <div
                        className={`relative z-10 w-48 md:w-full max-w-[240px] ${
                          isSquareAspectType(selectedItem.type)
                            ? 'aspect-square rounded-[2.5rem]'
                            : 'aspect-[2/3] rounded-2xl'
                        } overflow-hidden shadow-2xl border border-white/10`}
                      >
                        {canShowImg ? (
                          <img
                            src={resolvedSrc}
                            alt={selectedItem.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={() => handleImageError(selectedItem.id, selectedItem.imageUrl)}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-surface">
                            <div className="text-accent/20 mb-4">
                              {getTypeIcon(selectedItem.type, 28)}
                            </div>
                            <h3 className="font-serif text-lg font-bold text-ink/80">
                              {selectedItem.title}
                            </h3>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Right Side: Content & Conversation Details */}
              <div className="w-full md:w-3/5 p-8 md:p-14 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-accent text-[10px] uppercase tracking-[0.3em] font-black mb-4">
                      {getTypeIcon(selectedItem.type, 16)}
                      <span>{getTypeLabelNo(selectedItem.type)}</span>
                      <span className="text-ink/20">·</span>
                      <span className="text-ink/60">
                        Fra {getPersonName(selectedItem.recommendedBy)}
                      </span>
                    </div>

                    <h2 className="text-3xl md:text-5xl font-serif leading-[1.1] tracking-tight mb-3">
                      {selectedItem.title}
                    </h2>

                    {selectedItem.creator && (
                      <p className="text-sm md:text-base uppercase tracking-[0.2em] text-ink/40 font-black">
                        {selectedItem.creator}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-4 text-[11px] font-mono text-ink/50">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ink/5">
                        <PhoneCall size={12} className="text-accent" />
                        Samtale: {formatReadableDate(selectedItem.callDate)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ink/5">
                        {getStatusIcon(selectedItem.status, 13)}
                        <span>{getStatusLabelNo(selectedItem.status)}</span>
                      </span>
                    </div>
                  </div>

                  <div className="h-px w-16 bg-accent/20" />

                  {selectedItem.description ? (
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-ink/30 font-black mb-2">
                        Notat fra samtalen
                      </p>
                      <p className="text-ink/70 text-sm md:text-base leading-relaxed font-serif italic">
                        «{selectedItem.description}»
                      </p>
                    </div>
                  ) : (
                    <p className="text-ink/30 text-xs italic font-serif">
                      Ingen ekstra notater lagt inn fra telefonsamtalen.
                    </p>
                  )}

                  {/* Personal Comment / Review & Rating */}
                  <div className="p-5 rounded-2xl bg-paper border border-ink/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase tracking-widest text-ink/40 font-black flex items-center gap-1.5">
                        <MessageSquareQuote size={13} className="text-accent" />
                        Personlig vurdering &amp; karakter
                      </span>
                      {selectedItem.rating && (
                        <div className="flex items-center gap-1 text-amber-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={13}
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
                      <p className="text-sm font-serif italic text-ink/85 leading-relaxed">
                        «{selectedItem.review}»
                      </p>
                    ) : (
                      <p className="text-xs font-serif italic text-ink/35">
                        Ikke vurdert ennå. Marker som fullført for å skrive hva du syntes!
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-8 mt-8 border-t border-ink/5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => openReviewModal(selectedItem, e)}
                      className="inline-flex items-center space-x-2 px-6 py-3.5 rounded-2xl bg-accent text-white text-[10px] uppercase tracking-widest font-black shadow-lg shadow-accent/20 hover:opacity-90 transition-all"
                    >
                      <CheckCircle2 size={15} />
                      <span>
                        {selectedItem.status === 'Seen/Finished'
                          ? 'Oppdater vurdering'
                          : 'Fullfør & vurder'}
                      </span>
                    </button>

                    {selectedItem.link && (
                      <a
                        href={selectedItem.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-2 px-5 py-3.5 rounded-2xl bg-paper border border-ink/10 hover:border-accent text-ink text-[10px] uppercase tracking-widest font-black transition-all"
                      >
                        <span>Åpne lenke</span>
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={(e) => {
                        const itemToEdit = selectedItem;
                        setSelectedItem(null);
                        openEditModal(itemToEdit, e);
                      }}
                      icon={Edit2}
                      className="rounded-xl"
                      title="Rediger"
                    />
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => setDeleteConfirmation(selectedItem.id)}
                      icon={Trash2}
                      className="rounded-xl text-red-500 border-red-500/20 hover:bg-red-500/10"
                      title="Slett"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add / Edit Recommendation Modal (Matching Public Modal Style with Auto-Cover Search) */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-surface border border-ink/10 rounded-[2.5rem] p-8 md:p-12 overflow-hidden shadow-2xl z-10 my-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-3xl font-serif">
                    {editingId ? 'Rediger anbefaling' : 'Legg til anbefaling'}
                  </h2>
                  <p className="text-xs text-ink/50 font-serif italic mt-1">
                    Søk for å hente forsidebilde automatisk, eller fyll inn detaljer fra samtalen
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFormOpen(false)}
                  icon={X}
                />
              </div>

              {/* Type Selector Pills + Online Search Auto-Fill */}
              <div className="mb-8 space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  {RECOMMENDATION_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, type: t });
                        setMediaResults([]);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-[9px] uppercase tracking-widest font-black transition-all ${
                        formData.type === t
                          ? 'bg-accent text-white shadow-sm'
                          : 'bg-paper border border-ink/10 text-ink/50 hover:text-ink'
                      }`}
                    >
                      {getTypeLabelNo(t)}
                    </button>
                  ))}
                </div>

                {(['Movie', 'TV Series', 'Documentary', 'Book', 'Podcast', 'Music', 'YouTube Video'] as RecommendationType[]).includes(
                  formData.type
                ) && (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/30"
                        size={16}
                      />
                      <input
                        type="text"
                        value={mediaSearchQuery}
                        onChange={(e) => setMediaSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleQuickMediaLookup(mediaSearchQuery);
                          }
                        }}
                        placeholder={`Søk etter ${getTypeLabelNo(formData.type).toLowerCase()} for å hente omslag og info...`}
                        className="w-full pl-11 pr-4 py-3.5 bg-paper border border-ink/10 rounded-xl text-sm focus:outline-none focus:border-accent"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={() => handleQuickMediaLookup(mediaSearchQuery)}
                      isLoading={isSearchingMedia}
                      className="rounded-xl px-6"
                    >
                      Finn omslag
                    </Button>
                  </div>
                )}

                {/* Search Results Grid */}
                {mediaResults.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-2 bg-paper rounded-2xl border border-ink/5">
                    {mediaResults.map((res, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setFormData({
                            ...formData,
                            title: res.title || formData.title,
                            creator: res.creator || formData.creator,
                            description: formData.description || res.description || '',
                            link: res.link || formData.link,
                            imageUrl: res.imageUrl || formData.imageUrl
                          });
                          setMediaResults([]);
                        }}
                        className="flex items-center space-x-3 p-3 rounded-xl bg-surface hover:bg-accent/5 border border-ink/5 hover:border-accent/20 cursor-pointer transition-all group"
                      >
                        {res.imageUrl && (
                          <img
                            src={res.imageUrl}
                            alt=""
                            className="w-10 h-14 object-cover rounded-lg shadow-sm shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold truncate group-hover:text-accent">
                            {res.title}
                          </h4>
                          <p className="text-[10px] text-ink/40 truncate">{res.creator}</p>
                        </div>
                        <Plus size={14} className="text-ink/20 group-hover:text-accent shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleSaveRecommendation} className="space-y-5">
                {/* Title & Creator */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-black mb-1.5">
                      Tittel *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Tittel på verket..."
                      className="w-full px-4 py-3 bg-paper border border-ink/10 rounded-xl text-sm text-ink focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-black mb-1.5">
                      Forfatter / Skaper / År
                    </label>
                    <input
                      type="text"
                      value={formData.creator}
                      onChange={(e) => setFormData({ ...formData, creator: e.target.value })}
                      placeholder="f.eks. Joachim Trier, NRK..."
                      className="w-full px-4 py-3 bg-paper border border-ink/10 rounded-xl text-sm text-ink focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {/* Recommended By & Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-black mb-1.5">
                      Anbefalt av *
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-paper border border-ink/10 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, recommendedBy: 'owner' })}
                        className={`py-2 px-3 rounded-lg text-[10px] uppercase tracking-widest font-black transition-colors ${
                          formData.recommendedBy === 'owner'
                            ? 'bg-accent text-white'
                            : 'text-ink/50 hover:text-ink'
                        }`}
                      >
                        {config.ownerName}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, recommendedBy: 'friend' })}
                        className={`py-2 px-3 rounded-lg text-[10px] uppercase tracking-widest font-black transition-colors ${
                          formData.recommendedBy === 'friend'
                            ? 'bg-accent text-white'
                            : 'text-ink/50 hover:text-ink'
                        }`}
                      >
                        {config.friendName}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-black mb-1.5">
                      Status *
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value as RecommendationStatus })
                      }
                      className="w-full px-4 py-3 bg-paper border border-ink/10 rounded-xl text-sm text-ink focus:outline-none focus:border-accent"
                    >
                      {RECOMMENDATION_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {getStatusLabelNo(st)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Short Description or Note */}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-black mb-1.5">
                    Kort beskrivelse eller notat fra samtalen (valgfritt)
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Hvorfor ble denne anbefalt under samtalen vår?"
                    className="w-full px-4 py-3 bg-paper border border-ink/10 rounded-xl text-sm text-ink focus:outline-none focus:border-accent resize-none"
                  />
                </div>

                {/* Toggle for Optional Fields (Dates, Image URL, Link, Rating, Review) */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowMoreFormFields((prev) => !prev)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-[10px] uppercase tracking-widest font-black transition-all ${
                      showMoreFormFields
                        ? 'bg-accent/5 border-accent/25 text-accent'
                        : 'bg-paper border-ink/10 text-ink/50 hover:text-ink hover:border-ink/20'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal size={13} />
                      <span>Valgfrie detaljer (datoer, lenke, bilde-URL, vurdering)</span>
                    </span>
                    {showMoreFormFields ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>

                  <AnimatePresence initial={false}>
                    {showMoreFormFields && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 space-y-5">
                          {/* Phone Call Date & Date Recommended (Optional) */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-black mb-1.5">
                                Dato for telefonsamtale (valgfritt)
                              </label>
                              <input
                                type="date"
                                value={formData.callDate}
                                onChange={(e) => setFormData({ ...formData, callDate: e.target.value })}
                                className="w-full px-4 py-3 bg-paper border border-ink/10 rounded-xl text-sm text-ink font-mono focus:outline-none focus:border-accent"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-black mb-1.5">
                                Dato anbefalt (valgfritt)
                              </label>
                              <input
                                type="date"
                                value={formData.dateRecommended}
                                onChange={(e) =>
                                  setFormData({ ...formData, dateRecommended: e.target.value })
                                }
                                className="w-full px-4 py-3 bg-paper border border-ink/10 rounded-xl text-sm text-ink font-mono focus:outline-none focus:border-accent"
                              />
                            </div>
                          </div>

                          {/* Cover Image URL & External Link (Optional) */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-black mb-1.5">
                                Bilde-URL til omslag (valgfritt)
                              </label>
                              <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                  <input
                                    type="text"
                                    value={formData.imageUrl}
                                    onChange={(e) => {
                                      setFormPreviewError(false);
                                      setFormData({ ...formData, imageUrl: e.target.value });
                                    }}
                                    placeholder="Lim inn bilde-URL (https://...)"
                                    className="w-full px-4 py-3 pr-9 bg-paper border border-ink/10 rounded-xl text-sm text-ink focus:outline-none focus:border-accent"
                                  />
                                  {formData.imageUrl && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFormPreviewError(false);
                                        setFormData({ ...formData, imageUrl: '' });
                                      }}
                                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink"
                                      title="Fjern bilde-URL"
                                    >
                                      <X size={14} />
                                    </button>
                                  )}
                                </div>
                                {normalizeImageUrl(formData.imageUrl) && (
                                  <div className="w-11 h-14 rounded-lg overflow-hidden border border-ink/10 bg-paper shrink-0 flex items-center justify-center">
                                    {!formPreviewError ? (
                                      <img
                                        src={getDisplayImageUrl(formData.imageUrl, 0)}
                                        alt="Forhåndsvisning"
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          const imgEl = e.currentTarget;
                                          const proxyUrl = getDisplayImageUrl(formData.imageUrl, 1);
                                          if (imgEl.src !== proxyUrl && proxyUrl) {
                                            imgEl.src = proxyUrl;
                                          } else {
                                            setFormPreviewError(true);
                                          }
                                        }}
                                      />
                                    ) : (
                                      <span className="text-[8px] uppercase font-bold text-red-500 text-center px-1 leading-tight">
                                        Ugyldig bilde
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-black mb-1.5">
                                Lenke (valgfritt)
                              </label>
                              <input
                                type="text"
                                value={formData.link}
                                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                                placeholder="https://..."
                                className="w-full px-4 py-3 bg-paper border border-ink/10 rounded-xl text-sm text-ink focus:outline-none focus:border-accent"
                              />
                            </div>
                          </div>

                          {/* Personal Comment / Review & Optional Rating */}
                          <div className="pt-4 border-t border-ink/10 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <label className="text-[10px] uppercase tracking-widest text-ink/40 font-black">
                                Valgfri vurdering (1–5 stjerner)
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
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-black mb-1.5">
                                Personlig kommentar eller anmeldelse (valgfritt)
                              </label>
                              <textarea
                                rows={2}
                                value={formData.review}
                                onChange={(e) => setFormData({ ...formData, review: e.target.value })}
                                placeholder="Hva syntes du etter å ha sett, lest eller hørt den?"
                                className="w-full px-4 py-3 bg-paper border border-ink/10 rounded-xl text-sm text-ink focus:outline-none focus:border-accent resize-none"
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setIsFormOpen(false)}
                    className="rounded-xl"
                  >
                    Avbryt
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    icon={Save}
                    className="rounded-xl px-8"
                  >
                    {editingId ? 'Oppdater anbefaling' : 'Lagre anbefaling'}
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
              className="relative w-full max-w-lg bg-surface border border-ink/10 rounded-[2.5rem] p-6 md:p-10 shadow-2xl z-10"
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-black text-accent mb-1">
                    {getTypeLabelNo(reviewingItem.type)} · Fra {getPersonName(reviewingItem.recommendedBy)}
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
                  <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-black mb-2">
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
                          <span>{getStatusLabelNo(st)}</span>
                        </span>
                        {reviewFormData.status === st && <Check size={15} className="text-accent" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-black mb-2">
                    Din vurdering (valgfritt)
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
                        className="p-2.5 rounded-xl bg-paper border border-ink/10 hover:border-amber-500/40 transition-colors"
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
                  <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-black mb-1.5">
                    Personlig kommentar eller vurdering
                  </label>
                  <textarea
                    rows={4}
                    value={reviewFormData.review}
                    onChange={(e) =>
                      setReviewFormData({ ...reviewFormData, review: e.target.value })
                    }
                    placeholder="Skriv hva du syntes, så vi kan snakke om det i neste telefonsamtale..."
                    className="w-full px-4 py-3 bg-paper border border-ink/10 rounded-xl text-sm text-ink focus:outline-none focus:border-accent resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setReviewingItem(null)}
                    className="rounded-xl"
                  >
                    Avbryt
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    icon={Check}
                    className="rounded-xl px-6"
                  >
                    Lagre vurdering
                  </Button>
                </div>
              </form>
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
              className="relative w-full max-w-md bg-surface border border-ink/10 rounded-[2.5rem] p-6 md:p-8 shadow-2xl z-10"
            >
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-ink/10">
                <div>
                  <h3 className="text-xl font-serif text-ink">
                    Innstillinger for delt rom
                  </h3>
                  <p className="text-xs text-ink/50 mt-0.5">
                    Endre passordet for vennen din og visningsnavnene deres
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
                  <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-black mb-1.5">
                    Passord for tilgang
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
                        className="w-full pl-3.5 pr-10 py-2.5 bg-paper border border-ink/10 rounded-xl text-sm text-ink font-mono focus:outline-none focus:border-accent"
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
                        showToast('success', 'Passord kopiert til utklippstavlen.');
                      }}
                      className="px-3 py-2.5 rounded-xl bg-paper border border-ink/10 hover:border-accent text-xs font-medium text-ink/70 flex items-center gap-1.5"
                      title="Kopier passord"
                    >
                      <Copy size={14} />
                      <span>Kopier</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-ink/40 mt-1.5">
                    Vennen din trenger kun dette passordet for å logge inn på <span className="font-mono">/a</span>.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-black mb-1.5">
                      Ditt navn
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.ownerName}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, ownerName: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-paper border border-ink/10 rounded-xl text-sm text-ink focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-black mb-1.5">
                      Vennens navn
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.friendName}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, friendName: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-paper border border-ink/10 rounded-xl text-sm text-ink focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setIsSettingsOpen(false)}
                    className="rounded-xl"
                  >
                    Avbryt
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isSavingSettings}
                    icon={Save}
                    className="rounded-xl px-6"
                  >
                    Lagre innstillinger
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
              className="relative bg-surface border border-ink/10 p-8 rounded-[2.5rem] max-w-sm w-full text-center z-10 shadow-2xl"
            >
              <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 size={22} />
              </div>
              <h3 className="text-xl font-serif text-ink mb-2">
                Slette anbefaling?
              </h3>
              <p className="text-xs text-ink/60 mb-6 leading-relaxed">
                Dette vil fjerne anbefalingen permanent fra deres felles samling.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setDeleteConfirmation(null)}
                  className="flex-1 rounded-xl"
                >
                  Avbryt
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleDelete(deleteConfirmation)}
                  className="flex-1 rounded-xl bg-red-500 border-red-500 hover:bg-red-600 text-white"
                >
                  Slett
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
