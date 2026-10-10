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
  ChevronUp,
  Play,
  Link2
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
  friendName: 'Amund'
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
  const normalizedType: RecommendationType = RECOMMENDATION_TYPES.includes(docData.type)
    ? docData.type
    : 'Other';
  const recommendedBy: RecommendedByRole =
    docData.recommendedBy === 'friend' ? 'friend' : 'owner';
  const status: RecommendationStatus = RECOMMENDATION_STATUSES.includes(docData.status)
    ? docData.status
    : 'Not Seen';

  const unifiedDate = docData.callDate || docData.dateRecommended || '';
  const link = docData.link || '';
  const rawImageUrl = docData.imageUrl || '';
  const resolvedImageUrl =
    rawImageUrl ||
    (normalizedType === 'YouTube Video' || extractYouTubeVideoId(link)
      ? getYouTubeThumbnailUrl(link, 0)
      : '');

  return {
    id,
    title: docData.title || 'Untitled',
    type: normalizedType,
    recommendedBy,
    dateRecommended: unifiedDate,
    callDate: unifiedDate,
    link,
    description: docData.description || '',
    status,
    review: docData.review || '',
    rating: typeof docData.rating === 'number' && docData.rating >= 1 && docData.rating <= 5 ? docData.rating : null,
    creator: docData.creator || docData.author || '',
    imageUrl: resolvedImageUrl,
    completedAt: docData.completedAt || null,
    createdAt: docData.createdAt,
    updatedAt: docData.updatedAt
  };
}

function formatReadableDate(isoDate?: string): string {
  if (!isoDate) return '';
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

function extractYouTubeVideoId(input?: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Match standard watch?v=, youtu.be/, shorts/, embed/, live/, or i.ytimg.com/vi/ URLs
  const patterns = [
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    /(?:img\.youtube\.com|i\.ytimg\.com)\/vi(?:_webp)?\/([a-zA-Z0-9_-]{11})/i
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function getYouTubeThumbnailUrl(urlOrId?: string, stage = 0): string {
  if (!urlOrId) return '';
  const videoId =
    /^[a-zA-Z0-9_-]{11}$/.test(urlOrId.trim())
      ? urlOrId.trim()
      : extractYouTubeVideoId(urlOrId);
  if (!videoId) return '';
  if (stage === 0) return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
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
  // If user pasted a YouTube video link directly into imageUrl, convert it to the thumbnail URL
  const ytVideoId = extractYouTubeVideoId(trimmed);
  if (
    ytVideoId &&
    !trimmed.includes('ytimg.com') &&
    !trimmed.includes('img.youtube.com')
  ) {
    return getYouTubeThumbnailUrl(ytVideoId, 0);
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

function getDisplayImageUrl(rawUrl?: string, fallbackStage = 0, fallbackLink?: string): string {
  const clean = normalizeImageUrl(rawUrl) || (fallbackLink ? getYouTubeThumbnailUrl(fallbackLink, 0) : '');
  if (!clean) return '';
  if (clean.startsWith('data:') || clean.startsWith('/')) return clean;

  const ytId = extractYouTubeVideoId(clean) || extractYouTubeVideoId(fallbackLink);
  if (ytId && (clean.includes('ytimg.com') || clean.includes('img.youtube.com'))) {
    if (fallbackStage === 0) return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
    if (fallbackStage === 1) return `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`;
  }

  if (fallbackStage === 1) {
    // Fallback 1: Weserv global image proxy (bypasses hotlink blocks / CORS / mixed content)
    return `https://wsrv.nl/?url=${encodeURIComponent(clean)}`;
  }
  return clean;
}

function extractVimeoVideoId(input?: string): { id: string; hash?: string } | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(
    /(?:vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?|player\.vimeo\.com\/video\/)(\d+)(?:\/([a-zA-Z0-9]+)|\?h=([a-zA-Z0-9]+))?/i
  );
  if (match?.[1]) {
    return { id: match[1], hash: match[2] || match[3] };
  }
  return null;
}

interface EmbedMediaInfo {
  provider: 'youtube' | 'vimeo' | 'video';
  embedUrl: string;
  platformName: string;
  externalUrl: string;
}

function getEmbedMediaInfo(link?: string): EmbedMediaInfo | null {
  if (!link) return null;
  const trimmed = link.trim();
  if (!trimmed) return null;

  const ytId = extractYouTubeVideoId(trimmed);
  if (ytId) {
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`,
      platformName: 'YouTube',
      externalUrl: `https://www.youtube.com/watch?v=${ytId}`
    };
  }

  const vimeo = extractVimeoVideoId(trimmed);
  if (vimeo) {
    const hashParam = vimeo.hash ? `h=${vimeo.hash}&` : '';
    return {
      provider: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeo.id}?${hashParam}autoplay=1`,
      platformName: 'Vimeo',
      externalUrl: trimmed.startsWith('http') ? trimmed : `https://vimeo.com/${vimeo.id}`
    };
  }

  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(trimmed)) {
    const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    return {
      provider: 'video',
      embedUrl: url,
      platformName: 'Video',
      externalUrl: url
    };
  }

  return null;
}

function getMediaPlatformLabel(link?: string): string {
  if (!link) return 'Åpne lenke';
  const lower = link.toLowerCase();
  if (extractYouTubeVideoId(link)) return 'Se på YouTube';
  if (extractVimeoVideoId(link)) return 'Se på Vimeo';
  if (lower.includes('nrk.no')) return 'Se på NRK TV';
  if (lower.includes('netflix.com')) return 'Se på Netflix';
  if (lower.includes('tv2.no')) return 'Se på TV 2 Play';
  if (lower.includes('viaplay.')) return 'Se på Viaplay';
  if (lower.includes('max.com') || lower.includes('hbomax.com')) return 'Se på Max';
  if (lower.includes('disneyplus.com')) return 'Se på Disney+';
  if (lower.includes('tv.apple.com')) return 'Se på Apple TV+';
  if (lower.includes('primevideo.com')) return 'Se på Prime Video';
  if (lower.includes('mubi.com')) return 'Se på MUBI';
  if (lower.includes('filmoteket.no')) return 'Se på Filmoteket';
  if (lower.includes('spotify.com')) return 'Hør på Spotify';
  if (lower.includes('podcasts.apple.com') || lower.includes('music.apple.com')) return 'Åpne i Apple';
  if (lower.includes('imdb.com')) return 'Se på IMDb';
  if (lower.includes('letterboxd.com')) return 'Se på Letterboxd';
  return 'Åpne på plattform';
}

function isSquareAspectType(type: RecommendationType): boolean {
  return type === 'Podcast' || type === 'Music' || type === 'Website' || type === 'Other';
}

function isWidescreenAspectType(type: RecommendationType, imageUrl?: string, link?: string): boolean {
  if (type === 'YouTube Video') return true;
  if (
    extractYouTubeVideoId(imageUrl) ||
    extractYouTubeVideoId(link) ||
    extractVimeoVideoId(link)
  ) {
    return true;
  }
  return false;
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
    dateRecommended: '',
    callDate: '',
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
  const [isPlayingMedia, setIsPlayingMedia] = useState(false);
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
              !data.friendName || data.friendName === 'My Friend' || data.friendName === 'Venn'
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

  // Auto-resolve missing YouTube thumbnails for existing YouTube Video recommendations
  useEffect(() => {
    if (!hasAccess || recommendations.length === 0) return;
    let cancelled = false;

    const missingYtItems = recommendations.filter(
      (r) => r.type === 'YouTube Video' && !r.imageUrl
    );
    if (missingYtItems.length === 0) return;

    (async () => {
      for (const item of missingYtItems) {
        if (cancelled) break;
        const linkVidId = extractYouTubeVideoId(item.link) || extractYouTubeVideoId(item.title);
        if (linkVidId) {
          const thumb = getYouTubeThumbnailUrl(linkVidId, 0);
          try {
            await updateDoc(doc(db, COLLECTION_NAME, item.id), {
              imageUrl: thumb,
              link: item.link || `https://www.youtube.com/watch?v=${linkVidId}`,
              updatedAt: serverTimestamp()
            });
          } catch {
            // ignore
          }
          continue;
        }

        // Lookup by title + creator via server endpoint
        const searchTerm = `${item.title} ${item.creator || ''}`.trim();
        if (!searchTerm) continue;
        try {
          const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(searchTerm)}`);
          if (res.ok) {
            const data = await res.json();
            const first = data?.items?.[0];
            if (first?.imageUrl && !cancelled) {
              await updateDoc(doc(db, COLLECTION_NAME, item.id), {
                imageUrl: first.imageUrl,
                link: item.link || first.link || '',
                creator: item.creator || first.creator || '',
                updatedAt: serverTimestamp()
              });
            }
          }
        } catch {
          // ignore
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasAccess, recommendations]);

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
          friendName: settingsForm.friendName.trim() || 'Amund',
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
    const initialDate = prefillCallDate || '';
    setFormData({
      title: '',
      type: selectedType !== 'All' ? (selectedType as RecommendationType) : 'Movie',
      recommendedBy: activePerson,
      dateRecommended: initialDate,
      callDate: initialDate,
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
    const existingDate = rec.callDate || rec.dateRecommended || '';
    setFormData({
      title: rec.title,
      type: rec.type,
      recommendedBy: rec.recommendedBy,
      dateRecommended: existingDate,
      callDate: existingDate,
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
        const directVideoId = extractYouTubeVideoId(cleanQuery);
        const results: Array<{ title: string; creator: string; description: string; link: string; imageUrl: string }> = [];

        // 1. Query our server-side YouTube search & oEmbed proxy (works for both URLs and title searches without needing a client API key)
        try {
          const srvRes = await fetch(`/api/youtube-search?q=${encodeURIComponent(cleanQuery)}`);
          if (srvRes.ok) {
            const srvData = await srvRes.json();
            (srvData.items || []).forEach((item: any) => {
              const vidId = item.videoId || extractYouTubeVideoId(item.link);
              results.push({
                title: item.title || formData.title || 'YouTube-video',
                creator: item.creator || formData.creator || '',
                description: item.description || '',
                link: item.link || (vidId ? `https://www.youtube.com/watch?v=${vidId}` : ''),
                imageUrl: (vidId ? getYouTubeThumbnailUrl(vidId, 0) : '') || item.imageUrl || ''
              });
            });
          }
        } catch {
          // fallback below
        }

        // 2. If direct video URL was pasted and server lookup was empty, construct directly from ID + noembed
        if (results.length === 0 && directVideoId) {
          const canonicalWatchUrl = `https://www.youtube.com/watch?v=${directVideoId}`;
          const fallbackThumb = getYouTubeThumbnailUrl(directVideoId, 0);
          try {
            const oembedRes = await fetch(
              `https://noembed.com/embed?url=${encodeURIComponent(canonicalWatchUrl)}`
            );
            if (oembedRes.ok) {
              const oembedData = await oembedRes.json();
              results.push({
                title: oembedData.title || formData.title || 'YouTube-video',
                creator: oembedData.author_name || formData.creator || '',
                description: '',
                link: canonicalWatchUrl,
                imageUrl: fallbackThumb
              });
            } else {
              results.push({
                title: formData.title || 'YouTube-video',
                creator: formData.creator || '',
                description: '',
                link: canonicalWatchUrl,
                imageUrl: fallbackThumb
              });
            }
          } catch {
            results.push({
              title: formData.title || 'YouTube-video',
              creator: formData.creator || '',
              description: '',
              link: canonicalWatchUrl,
              imageUrl: fallbackThumb
            });
          }
        }

        // 3. Optional Google YouTube Data API v3 fallback if configured
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_YOUTUBE_API_KEY;
        if (apiKey && results.length === 0) {
          const ytRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&maxResults=6&type=video&key=${apiKey}`
          );
          if (ytRes.ok) {
            const ytData = await ytRes.json();
            (ytData.items || []).forEach((item: any) => {
              const vidId = item.id?.videoId;
              results.push({
                title: item.snippet.title,
                creator: item.snippet.channelTitle,
                description: item.snippet.description || '',
                link: `https://www.youtube.com/watch?v=${vidId}`,
                imageUrl:
                  (vidId ? getYouTubeThumbnailUrl(vidId, 0) : '') ||
                  item.snippet.thumbnails.high?.url ||
                  item.snippet.thumbnails.default?.url ||
                  ''
              });
            });
          }
        }

        // If user pasted a direct YouTube link, auto-fill the form immediately if there's 1 match
        if (directVideoId && results.length === 1) {
          const match = results[0];
          setFormData((prev) => ({
            ...prev,
            title: prev.title || match.title,
            creator: prev.creator || match.creator,
            link: match.link || prev.link,
            imageUrl: match.imageUrl || prev.imageUrl
          }));
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

    const rawTitle = formData.title.trim();
    const titleYtId = extractYouTubeVideoId(rawTitle);

    let normalizedLink = formData.link.trim()
      ? formData.link.trim().startsWith('http://') || formData.link.trim().startsWith('https://')
        ? formData.link.trim()
        : `https://${formData.link.trim()}`
      : titleYtId
      ? `https://www.youtube.com/watch?v=${titleYtId}`
      : '';

    let normalizedImageUrl =
      normalizeImageUrl(formData.imageUrl) ||
      (formData.type === 'YouTube Video' || extractYouTubeVideoId(normalizedLink)
        ? getYouTubeThumbnailUrl(normalizedLink, 0)
        : '');

    let resolvedCreator = formData.creator.trim();
    let resolvedTitle = rawTitle;

    // If saving a YouTube Video without an imageUrl or link, automatically look up the YouTube video thumbnail by title
    if (formData.type === 'YouTube Video' && !normalizedImageUrl) {
      try {
        const searchTerm = `${rawTitle} ${resolvedCreator}`.trim();
        const srvRes = await fetch(`/api/youtube-search?q=${encodeURIComponent(searchTerm)}`);
        if (srvRes.ok) {
          const srvData = await srvRes.json();
          const first = srvData?.items?.[0];
          if (first) {
            normalizedImageUrl = first.imageUrl || getYouTubeThumbnailUrl(first.videoId, 0);
            if (!normalizedLink && first.link) normalizedLink = first.link;
            if (!resolvedCreator && first.creator) resolvedCreator = first.creator;
            if (titleYtId && first.title) resolvedTitle = first.title;
          }
        }
      } catch {
        // ignore lookup error on save
      }
    }

    const unifiedDate = formData.callDate.trim() || formData.dateRecommended.trim() || '';

    const payload: Record<string, any> = {
      title: resolvedTitle,
      type: formData.type,
      recommendedBy: formData.recommendedBy,
      creator: resolvedCreator,
      dateRecommended: unifiedDate,
      callDate: unifiedDate,
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

  // Recommender Counts (respecting selected media type)
  const recommenderCounts = useMemo(() => {
    const base =
      selectedType === 'All'
        ? recommendations
        : recommendations.filter((r) => r.type === selectedType);
    return {
      all: base.length,
      owner: base.filter((r) => r.recommendedBy === 'owner').length,
      friend: base.filter((r) => r.recommendedBy === 'friend').length
    };
  }, [recommendations, selectedType]);

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

    const getSortableTimestamp = (item: PrivateRecommendationItem): string => {
      if (item.callDate) return item.callDate;
      if (item.dateRecommended) return item.dateRecommended;
      if (item.createdAt?.toDate) {
        try {
          return item.createdAt.toDate().toISOString();
        } catch {
          return '';
        }
      }
      return '';
    };

    return filtered.sort((a, b) => {
      if (activeShelf === 'highly-rated' && sortBy === 'newest') {
        return (b.rating || 0) - (a.rating || 0);
      }
      switch (sortBy) {
        case 'newest':
        case 'call-newest':
          return getSortableTimestamp(b).localeCompare(getSortableTimestamp(a));
        case 'oldest':
        case 'call-oldest':
          return getSortableTimestamp(a).localeCompare(getSortableTimestamp(b));
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
    if (selectedStatus !== 'all') count++;
    if (selectedCallDate !== 'all') count++;
    if (sortBy !== 'newest') count++;
    if (activeShelf !== 'all') count++;
    return count;
  }, [searchQuery, selectedStatus, selectedCallDate, sortBy, activeShelf]);

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
    const isWidescreen = isWidescreenAspectType(item.type, item.imageUrl, item.link);
    const isSquare = !isWidescreen && isSquareAspectType(item.type);
    const hasDate = Boolean(item.callDate);
    const subtitle = item.creator
      ? `${item.creator} · Fra ${getPersonName(item.recommendedBy)}`
      : hasDate
      ? `Fra ${getPersonName(item.recommendedBy)} · ${formatReadableDate(item.callDate)}`
      : `Fra ${getPersonName(item.recommendedBy)}`;

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
        onClick={() => {
          setIsPlayingMedia(false);
          setSelectedItem(item);
        }}
        className={`group cursor-pointer flex flex-col ${isWidescreen ? 'col-span-2' : ''}`}
      >
        <div
          className={`relative ${
            isWidescreen
              ? 'aspect-video rounded-2xl'
              : isSquare
              ? 'aspect-square rounded-[2.5rem]'
              : 'aspect-[2/3] rounded-2xl'
          } w-full overflow-hidden bg-surface shadow-sm group-hover:shadow-2xl group-hover:shadow-accent/10 transition-all duration-700 border border-ink/5 group-hover:border-accent/20`}
        >
          {(() => {
            const imgKey = getImageKey(item.id, item.imageUrl || item.link);
            const errorStage = brokenImages[imgKey] || 0;
            const resolvedSrc = getDisplayImageUrl(item.imageUrl, errorStage, item.link);
            return resolvedSrc && errorStage < 2 ? (
              <img
                src={resolvedSrc}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-110"
                referrerPolicy="no-referrer"
                onError={() => handleImageError(item.id, item.imageUrl || item.link)}
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
                {hasDate && (
                  <p className="text-[8px] font-mono text-ink/25 mt-1">
                    {formatReadableDate(item.callDate)}
                  </p>
                )}
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

          {/* Center Play Button Overlay if item has a playable YouTube/Vimeo/video link */}
          {getEmbedMediaInfo(item.link) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/65 backdrop-blur-md border border-white/25 text-white flex items-center justify-center shadow-xl group-hover:scale-110 group-hover:bg-accent group-hover:border-accent transition-all duration-300">
                <Play size={18} className="fill-white ml-0.5" />
              </div>
            </div>
          )}

          {/* Hover Overlay (matches public Recommendations) */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-5">
            <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
              <p className="text-white/60 text-[8px] uppercase tracking-[0.2em] font-black mb-1">
                {hasDate
                  ? `Fra ${getPersonName(item.recommendedBy)} · Samtale ${formatReadableDate(item.callDate)}`
                  : `Fra ${getPersonName(item.recommendedBy)}`}
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
        <div className="mt-2.5 sm:mt-4 px-1 space-y-0.5 sm:space-y-1">
          <h3 className="font-serif text-xs sm:text-sm font-medium text-ink/90 group-hover:text-accent transition-colors truncate leading-tight">
            {item.title}
          </h3>
          <p className="text-[8px] sm:text-[9px] uppercase tracking-widest text-ink/30 font-bold truncate">
            {subtitle}
          </p>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-16 md:py-20">
      {/* Status Toast */}
      <AnimatePresence>
        {statusBanner && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={`fixed top-16 sm:top-20 right-4 sm:right-6 left-4 sm:left-auto z-50 px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl shadow-lg border text-xs font-medium flex items-center gap-2.5 ${
              statusBanner.type === 'success'
                ? 'bg-surface border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-surface border-red-500/30 text-red-600 dark:text-red-400'
            }`}
          >
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{statusBanner.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Section (matching Public Recommendations layout, compact on mobile) */}
      <div className="flex flex-col items-center mb-8 sm:mb-16 md:mb-20 text-center relative">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl sm:text-6xl md:text-8xl font-serif mb-3 sm:mb-6 tracking-tighter leading-[0.95] sm:leading-[0.9]"
        >
          Våre <span className="italic font-light text-accent">Anbefalinger</span>
        </motion.h1>

        {/* Action Buttons & Viewing As Controls */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-5 sm:mt-10 flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-2 sm:gap-3 w-full"
        >
          {/* Top Row on Mobile: Filter Button (Left) + Legg til anbefaling (Right) */}
          <div className="flex items-center justify-center gap-1.5 w-full sm:w-auto">
            {/* Mobile: Media Type Filter Button on Left Side */}
            <button
              type="button"
              onClick={() => setShowMoreFilters((prev) => !prev)}
              className={`sm:hidden px-2.5 py-1.5 rounded-lg text-[8px] uppercase tracking-wider font-black transition-all flex items-center gap-1 border whitespace-nowrap shrink-0 ${
                showMoreFilters || selectedType !== 'All'
                  ? 'bg-ink text-paper border-ink shadow-sm'
                  : 'bg-surface/60 backdrop-blur-md text-ink/70 border-ink/10 hover:text-ink hover:border-ink/25'
              }`}
            >
              <SlidersHorizontal size={11} />
              <span>
                {selectedType === 'All' ? 'Filter: Alle' : getTypeLabelNo(selectedType)}
              </span>
              <span
                className={`px-1 py-0.2 rounded-full text-[7px] ${
                  showMoreFilters || selectedType !== 'All'
                    ? 'bg-accent text-white'
                    : 'bg-ink/5 text-ink/50'
                }`}
              >
                {typeCounts[selectedType] || 0}
              </span>
              {showMoreFilters ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>

            <Button
              onClick={() => openAddModal()}
              variant="primary"
              size="sm"
              icon={Plus}
              magnetic={true}
              className="rounded-lg sm:rounded-2xl !px-3 !py-1.5 sm:!px-8 sm:!py-4 !text-[8px] sm:!text-[13px] shadow-xl shadow-accent/10 whitespace-nowrap"
            >
              Legg til anbefaling
            </Button>
          </div>

          {/* Secondary Controls Row on Mobile (Inline on Desktop) */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {/* Active Person Selector - Only Admin can change Viewing As */}
            {isAdmin ? (
              <div className="flex items-center bg-surface/60 backdrop-blur-md border border-ink/10 rounded-xl sm:rounded-2xl p-1 sm:p-1.5">
                <span className="hidden sm:flex text-[9px] uppercase tracking-widest font-black text-ink/40 px-2.5 items-center gap-1.5 whitespace-nowrap">
                  <UserCheck size={13} className="text-accent" />
                  Viser som:
                </span>
                <button
                  type="button"
                  onClick={() => handleSwitchPerson('owner')}
                  className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] uppercase tracking-wider sm:tracking-widest font-black transition-all whitespace-nowrap ${
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
                  className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] uppercase tracking-wider sm:tracking-widest font-black transition-all whitespace-nowrap ${
                    activePerson === 'friend'
                      ? 'bg-ink text-paper shadow-sm'
                      : 'text-ink/40 hover:text-ink'
                  }`}
                >
                  {config.friendName}
                </button>
              </div>
            ) : (
              <div className="flex items-center bg-surface/60 backdrop-blur-md border border-ink/10 rounded-xl sm:rounded-2xl px-3 py-2 sm:px-4 sm:py-3">
                <span className="text-[8px] sm:text-[9px] uppercase tracking-wider sm:tracking-widest font-black text-ink/50 flex items-center gap-1.5 whitespace-nowrap">
                  <UserCheck size={12} className="text-accent" />
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
                className="px-3 py-2 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl bg-surface/60 border border-ink/10 hover:border-accent/40 text-[8px] sm:text-[9px] uppercase tracking-wider sm:tracking-widest font-black text-ink/70 hover:text-ink flex items-center gap-1.5 transition-colors whitespace-nowrap"
                title="Endre passord og navn"
              >
                <KeyRound size={13} className="text-accent" />
                <span className="hidden xs:inline sm:inline">Passord &amp; navn</span>
                <span className="xs:hidden sm:hidden">Kode</span>
              </button>
            )}

            {!isAdmin && isFriendUnlocked && (
              <button
                type="button"
                onClick={handleLockSpace}
                className="px-3 py-2 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl bg-surface/60 border border-ink/10 hover:border-red-500/40 text-[8px] sm:text-[9px] uppercase tracking-wider sm:tracking-widest font-black text-ink/50 hover:text-red-500 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                title="Lås privat samling"
              >
                <LogOut size={13} />
                <span>Lås</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* Primary Media Type Filter & Recommender Filter */}
        <div className="mt-4 sm:mt-12 md:mt-14 w-full max-w-5xl space-y-2.5 sm:space-y-4">
          {/* Mobile Expandable Panel for Media Type */}
          <AnimatePresence>
            {showMoreFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -6 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="sm:hidden overflow-hidden"
              >
                <div className="p-2.5 bg-surface/50 backdrop-blur-xl rounded-2xl border border-ink/10 space-y-2.5 shadow-sm">
                  {/* Media Type Pills inside Mobile Dropdown */}
                  <div className="flex flex-wrap justify-center gap-1">
                    {visibleCategoryTabs.map((cat) => {
                      const count = typeCounts[cat] || 0;
                      const isSelected = selectedType === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setSelectedType(cat);
                            setShowMoreFilters(false);
                          }}
                          className={`group relative px-2.5 py-1.5 rounded-full text-[8px] uppercase tracking-wider font-black transition-all flex items-center gap-1.5 ${
                            isSelected ? 'bg-accent text-white shadow-sm' : 'bg-paper/70 text-ink/60 hover:text-ink border border-ink/5'
                          }`}
                        >
                          <span className="whitespace-nowrap">{getTypeLabelNo(cat)}</span>
                          <span
                            className={`text-[7px] px-1.5 py-0.5 rounded-full ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-ink/5 text-ink/40'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Desktop Category Pill Bar (Hidden on mobile since it's inside the button above) */}
          <div className="hidden sm:flex flex-wrap justify-center gap-2 p-2 bg-surface/40 backdrop-blur-xl rounded-[2rem] border border-ink/5 shadow-inner">
            {visibleCategoryTabs.map((cat) => {
              const count = typeCounts[cat] || 0;
              const isSelected = selectedType === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedType(cat)}
                  className={`group relative px-5 py-2.5 md:px-6 md:py-3 rounded-full text-[10px] uppercase tracking-[0.15em] font-black transition-all duration-500 flex items-center gap-2 ${
                    isSelected ? 'text-white' : 'text-ink/45 hover:text-ink'
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="activePrivateCategory"
                      className="absolute inset-0 bg-accent rounded-full shadow-lg shadow-accent/20"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap">{getTypeLabelNo(cat)}</span>
                  <span
                    className={`relative z-10 text-[8px] px-1.5 py-0.5 rounded-full transition-colors ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-ink/5 text-ink/35 group-hover:text-ink/60'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Recommender Filter Bar (Alle / Anbefalt av Kianosh / Anbefalt av Amund) */}
          <div className="flex justify-center">
            <div className="inline-flex flex-wrap justify-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 bg-surface/40 backdrop-blur-xl rounded-2xl sm:rounded-full border border-ink/5 shadow-inner max-w-full">
              {(
                [
                  {
                    id: 'all',
                    label: 'Alle',
                    shortLabel: 'Alle',
                    count: recommenderCounts.all
                  },
                  {
                    id: 'owner',
                    label: `Anbefalt av ${config.ownerName}`,
                    shortLabel: `Av ${config.ownerName}`,
                    count: recommenderCounts.owner
                  },
                  {
                    id: 'friend',
                    label: `Anbefalt av ${config.friendName}`,
                    shortLabel: `Av ${config.friendName}`,
                    count: recommenderCounts.friend
                  }
                ] as const
              ).map((item) => {
                const isSelected = selectedRecommender === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedRecommender(item.id)}
                    className={`group relative px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-full text-[8px] sm:text-[10px] uppercase tracking-wider sm:tracking-[0.15em] font-black transition-all duration-500 flex items-center gap-1.5 sm:gap-2 ${
                      isSelected ? 'text-paper' : 'text-ink/45 hover:text-ink'
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="activePrivateRecommender"
                        className="absolute inset-0 bg-ink rounded-full shadow-md"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <span className="relative z-10 sm:hidden whitespace-nowrap">{item.shortLabel}</span>
                    <span className="relative z-10 hidden sm:inline whitespace-nowrap">{item.label}</span>
                    <span
                      className={`relative z-10 text-[7px] sm:text-[8px] px-1.5 py-0.5 rounded-full transition-colors ${
                        isSelected
                          ? 'bg-paper/20 text-paper'
                          : 'bg-ink/5 text-ink/35 group-hover:text-ink/60'
                      }`}
                    >
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
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
        /* Default 6-Column Visual Poster Grid (Exact Public Layout, compact gap on mobile) */
        <motion.div
          layout
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3.5 sm:gap-x-6 gap-y-6 sm:gap-y-12"
        >
          <AnimatePresence mode="popLayout">
            {filteredRecommendations.map((item, idx) => renderPosterCard(item, idx))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Detail Modal (Matching Public Split-View Layout) */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-8">
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
              className="relative w-full max-w-4xl bg-surface border border-ink/10 rounded-[2rem] sm:rounded-[3rem] overflow-hidden shadow-2xl z-10 flex flex-col md:flex-row max-h-[92vh]"
            >
              <button
                type="button"
                onClick={() => {
                  setIsPlayingMedia(false);
                  setSelectedItem(null);
                }}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 p-2.5 sm:p-3 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-all hover:rotate-90"
              >
                <X size={18} />
              </button>

              {/* Left Side: Visual Poster or Embedded Video Player */}
              <div
                className={`w-full ${
                  isPlayingMedia && getEmbedMediaInfo(selectedItem.link)
                    ? 'md:w-1/2 p-4 sm:p-6 md:p-8'
                    : 'md:w-2/5 p-5 sm:p-8 md:p-12'
                } bg-ink/[0.02] relative flex flex-col items-center justify-center overflow-hidden border-b md:border-b-0 md:border-r border-ink/5`}
              >
                {(() => {
                  const imgKey = getImageKey(selectedItem.id, selectedItem.imageUrl || selectedItem.link);
                  const errorStage = brokenImages[imgKey] || 0;
                  const resolvedSrc = getDisplayImageUrl(selectedItem.imageUrl, errorStage, selectedItem.link);
                  const canShowImg = Boolean(resolvedSrc && errorStage < 2);
                  const embedInfo = getEmbedMediaInfo(selectedItem.link);
                  const isWidescreen = isWidescreenAspectType(
                    selectedItem.type,
                    selectedItem.imageUrl,
                    selectedItem.link
                  );

                  if (isPlayingMedia && embedInfo) {
                    return (
                      <div className="w-full space-y-3 relative z-10">
                        <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-ink/10 bg-black">
                          {embedInfo.provider === 'video' ? (
                            <video
                              src={embedInfo.embedUrl}
                              controls
                              autoPlay
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <iframe
                              src={embedInfo.embedUrl}
                              title={selectedItem.title}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            />
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 px-1">
                          <button
                            type="button"
                            onClick={() => setIsPlayingMedia(false)}
                            className="text-[10px] uppercase tracking-widest font-black text-ink/50 hover:text-ink transition-colors"
                          >
                            ← Vis omslag
                          </button>
                          <a
                            href={embedInfo.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-black text-accent hover:underline"
                          >
                            <span>Åpne på {embedInfo.platformName}</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    );
                  }

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
                        onClick={() => {
                          if (embedInfo) setIsPlayingMedia(true);
                        }}
                        className={`relative z-10 group/poster ${
                          embedInfo ? 'cursor-pointer' : ''
                        } ${
                          isWidescreen
                            ? 'w-full max-w-[360px] aspect-video rounded-xl sm:rounded-2xl'
                            : isSquareAspectType(selectedItem.type)
                            ? 'w-32 sm:w-48 md:w-full max-w-[240px] aspect-square rounded-3xl sm:rounded-[2.5rem]'
                            : 'w-32 sm:w-48 md:w-full max-w-[240px] aspect-[2/3] rounded-xl sm:rounded-2xl'
                        } overflow-hidden shadow-2xl border border-white/10`}
                      >
                        {canShowImg ? (
                          <img
                            src={resolvedSrc}
                            alt={selectedItem.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={() => handleImageError(selectedItem.id, selectedItem.imageUrl || selectedItem.link)}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-4 sm:p-8 text-center bg-surface">
                            <div className="text-accent/20 mb-3 sm:mb-4">
                              {getTypeIcon(selectedItem.type, 24)}
                            </div>
                            <h3 className="font-serif text-sm sm:text-lg font-bold text-ink/80">
                              {selectedItem.title}
                            </h3>
                          </div>
                        )}

                        {embedInfo && (
                          <div className="absolute inset-0 bg-black/30 group-hover/poster:bg-black/45 transition-colors flex flex-col items-center justify-center gap-2">
                            <div className="w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center shadow-2xl group-hover/poster:scale-110 transition-transform">
                              <Play size={22} className="fill-white ml-0.5" />
                            </div>
                            <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[9px] uppercase tracking-widest font-black">
                              Spill av her
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Right Side: Content & Conversation Details */}
              <div className="w-full md:w-3/5 p-5 sm:p-8 md:p-14 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-4 sm:space-y-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-accent text-[9px] sm:text-[10px] uppercase tracking-[0.25em] sm:tracking-[0.3em] font-black mb-2 sm:mb-4">
                      {getTypeIcon(selectedItem.type, 14)}
                      <span>{getTypeLabelNo(selectedItem.type)}</span>
                      <span className="text-ink/20">·</span>
                      <span className="text-ink/60">
                        Fra {getPersonName(selectedItem.recommendedBy)}
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl md:text-5xl font-serif leading-[1.1] tracking-tight mb-2 sm:mb-3">
                      {selectedItem.title}
                    </h2>

                    {selectedItem.creator && (
                      <p className="text-sm md:text-base uppercase tracking-[0.2em] text-ink/40 font-black">
                        {selectedItem.creator}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-4 text-[11px] font-mono text-ink/50">
                      {selectedItem.callDate && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ink/5">
                          <PhoneCall size={12} className="text-accent" />
                          Samtale: {formatReadableDate(selectedItem.callDate)}
                        </span>
                      )}
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
                  <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                    {(() => {
                      const embedInfo = getEmbedMediaInfo(selectedItem.link);
                      if (!embedInfo) return null;
                      return (
                        <button
                          type="button"
                          onClick={() => setIsPlayingMedia((prev) => !prev)}
                          className={`inline-flex items-center space-x-2 px-5 py-3.5 rounded-2xl text-[10px] uppercase tracking-widest font-black transition-all ${
                            isPlayingMedia
                              ? 'bg-ink text-paper'
                              : 'bg-accent text-white shadow-lg shadow-accent/20 hover:opacity-90'
                          }`}
                        >
                          <Play size={14} className={isPlayingMedia ? '' : 'fill-white'} />
                          <span>{isPlayingMedia ? 'Skjul avspiller' : 'Se på nettsiden'}</span>
                        </button>
                      );
                    })()}

                    {selectedItem.link && (
                      <a
                        href={
                          selectedItem.link.startsWith('http')
                            ? selectedItem.link
                            : `https://${selectedItem.link}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-2 px-5 py-3.5 rounded-2xl bg-paper border border-ink/10 hover:border-accent text-ink text-[10px] uppercase tracking-widest font-black transition-all"
                      >
                        <span>{getMediaPlatformLabel(selectedItem.link)}</span>
                        <ExternalLink size={14} />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={(e) => openReviewModal(selectedItem, e)}
                      className={`inline-flex items-center space-x-2 px-5 py-3.5 rounded-2xl text-[10px] uppercase tracking-widest font-black transition-all ${
                        getEmbedMediaInfo(selectedItem.link)
                          ? 'bg-paper border border-ink/10 hover:border-accent text-ink'
                          : 'bg-accent text-white shadow-lg shadow-accent/20 hover:opacity-90'
                      }`}
                    >
                      <CheckCircle2 size={15} />
                      <span>
                        {selectedItem.status === 'Seen/Finished'
                          ? 'Oppdater vurdering'
                          : 'Fullfør & vurder'}
                      </span>
                    </button>
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
              className="relative w-full max-w-2xl bg-surface border border-ink/10 rounded-[1.75rem] sm:rounded-[2.5rem] p-5 sm:p-8 md:p-12 overflow-hidden shadow-2xl z-10 my-4 sm:my-8 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-5 sm:mb-8">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-serif">
                    {editingId ? 'Rediger anbefaling' : 'Legg til anbefaling'}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-ink/50 font-serif italic mt-0.5 sm:mt-1">
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
              <div className="mb-6 sm:mb-8 space-y-3 sm:space-y-4">
                <div className="flex flex-wrap gap-1 sm:gap-1.5">
                  {RECOMMENDATION_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, type: t });
                        setMediaResults([]);
                      }}
                      className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] uppercase tracking-wider sm:tracking-widest font-black transition-all ${
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
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/30"
                        size={15}
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
                        placeholder={`Søk etter ${getTypeLabelNo(formData.type).toLowerCase()} for omslag...`}
                        className="w-full pl-10 pr-4 py-2.5 sm:py-3.5 bg-paper border border-ink/10 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-accent"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={() => handleQuickMediaLookup(mediaSearchQuery)}
                      isLoading={isSearchingMedia}
                      className="rounded-xl px-5 py-2.5 sm:py-3"
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
                            className={`${
                              formData.type === 'YouTube Video' ? 'w-20 aspect-video' : 'w-10 h-14'
                            } object-cover rounded-lg shadow-sm shrink-0`}
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

                {/* Media / Platform Link (Always Visible so users can easily add YouTube, Vimeo, Film, Podcast or Article URLs) */}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-black mb-1.5">
                    Lenke til video / film / plattform (YouTube, Vimeo, NRK, Netflix, Spotify m.m.)
                  </label>
                  <div className="relative">
                    <Link2
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/30"
                    />
                    <input
                      type="text"
                      value={formData.link}
                      onChange={async (e) => {
                        const newLink = e.target.value;
                        const ytId = extractYouTubeVideoId(newLink);
                        const vimeo = extractVimeoVideoId(newLink);
                        const ytThumb = ytId ? getYouTubeThumbnailUrl(ytId, 0) : '';

                        setFormData((prev) => ({
                          ...prev,
                          link: newLink,
                          imageUrl: prev.imageUrl || (ytThumb ? ytThumb : prev.imageUrl)
                        }));

                        // Auto-fetch metadata & thumbnail if a YouTube or Vimeo link is pasted
                        if (ytId || vimeo) {
                          try {
                            const srvRes = await fetch(
                              `/api/youtube-search?q=${encodeURIComponent(newLink.trim())}`
                            );
                            if (srvRes.ok) {
                              const srvData = await srvRes.json();
                              const first = srvData?.items?.[0];
                              if (first) {
                                setFormData((prev) => ({
                                  ...prev,
                                  title: prev.title || first.title || prev.title,
                                  creator: prev.creator || first.creator || prev.creator,
                                  imageUrl: prev.imageUrl || first.imageUrl || ytThumb || prev.imageUrl
                                }));
                              }
                            }
                          } catch {
                            // ignore background metadata fetch error
                          }
                        }
                      }}
                      placeholder="Lim inn lenke (f.eks. https://youtube.com/watch?v=... eller https://vimeo.com/...)"
                      className="w-full pl-10 pr-9 py-3 bg-paper border border-ink/10 rounded-xl text-sm text-ink focus:outline-none focus:border-accent"
                    />
                    {formData.link && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, link: '' })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink"
                        title="Fjern lenke"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {getEmbedMediaInfo(formData.link) && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1.5 flex items-center gap-1.5">
                      <Play size={11} className="fill-current" />
                      <span>
                        Videoen kan spilles av direkte på nettsiden eller åpnes på{' '}
                        {getEmbedMediaInfo(formData.link)?.platformName}.
                      </span>
                    </p>
                  )}
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

                {/* Toggle for Optional Fields (Dates, Image URL, Rating, Review) */}
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
                      <span>Valgfrie detaljer (dato, bilde-URL, vurdering)</span>
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
                          {/* Combined Date for Recommendation / Phone Call (Optional, empty by default) */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-black">
                                Dato for anbefaling / telefonsamtale (valgfritt)
                              </label>
                              {formData.callDate && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setFormData({
                                      ...formData,
                                      callDate: '',
                                      dateRecommended: ''
                                    })
                                  }
                                  className="text-[9px] uppercase tracking-widest font-black text-accent hover:underline"
                                >
                                  Fjern dato
                                </button>
                              )}
                            </div>
                            <input
                              type="date"
                              value={formData.callDate}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  callDate: e.target.value,
                                  dateRecommended: e.target.value
                                })
                              }
                              className="w-full px-4 py-3 bg-paper border border-ink/10 rounded-xl text-sm text-ink font-mono focus:outline-none focus:border-accent"
                            />
                          </div>

                           {/* Cover Image URL (Optional) */}
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
                              {(normalizeImageUrl(formData.imageUrl) ||
                                getYouTubeThumbnailUrl(formData.link, 0)) && (
                                <div
                                  className={`${
                                    isWidescreenAspectType(formData.type, formData.imageUrl, formData.link)
                                      ? 'w-20 aspect-video'
                                      : 'w-11 h-14'
                                  } rounded-lg overflow-hidden border border-ink/10 bg-paper shrink-0 flex items-center justify-center`}
                                >
                                  {!formPreviewError ? (
                                    <img
                                      src={getDisplayImageUrl(formData.imageUrl, 0, formData.link)}
                                      alt="Forhåndsvisning"
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        const imgEl = e.currentTarget;
                                        const fallbackUrl = getDisplayImageUrl(
                                          formData.imageUrl,
                                          1,
                                          formData.link
                                        );
                                        if (imgEl.src !== fallbackUrl && fallbackUrl) {
                                          imgEl.src = fallbackUrl;
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
