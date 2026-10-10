import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, Film, Tv, ExternalLink, Video, Plus, Search, X, Check, Loader2, Edit2, Trash2, Save, RefreshCw, Sparkles, Podcast, Play } from 'lucide-react';
import { db, collection, query, orderBy, handleFirestoreError, OperationType, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, auth, getDocs } from '../firebase';
import Magnetic from './Magnetic';
import Button from './ui/Button';

interface Recommendation {
  id: string;
  title: string;
  author: string;
  category: 'Books' | 'Movies' | 'Shows' | 'Video & Media' | 'Apps' | 'Podcasts';
  description?: string;
  link?: string;
  imageUrl?: string;
  createdAt?: any;
}

interface SearchResult {
  title: string;
  author: string;
  description: string;
  link: string;
  imageUrl: string;
  category: 'Books' | 'Movies' | 'Shows' | 'Video & Media' | 'Apps' | 'Podcasts';
}

function extractYouTubeVideoId(input?: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
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
  const imgSrcMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (imgSrcMatch?.[1]) {
    trimmed = imgSrcMatch[1].trim();
  } else {
    const mdMatch = trimmed.match(/!\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/);
    if (mdMatch?.[1]) {
      trimmed = mdMatch[1].trim();
    }
  }
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

function getEmbedMediaInfo(link?: string): {
  provider: 'youtube' | 'vimeo' | 'video';
  embedUrl: string;
  platformName: string;
  externalUrl: string;
} | null {
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

export default function Recommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedItem, setSelectedItem] = useState<Recommendation | null>(null);
  const [isPlayingMedia, setIsPlayingMedia] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Add/Edit Modal State
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchType, setSearchType] = useState<'Books' | 'Movies' | 'Shows' | 'Video & Media' | 'Apps' | 'Podcasts'>('Books');
  const [formData, setFormData] = useState<Partial<Recommendation>>({
    title: '',
    author: '',
    category: 'Books',
    description: '',
    link: '',
    imageUrl: ''
  });
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, number>>({});
  const [filterSearch, setFilterSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'title' | 'author'>('newest');

  const getImageKey = (id: string, url?: string) => `${id}::${normalizeImageUrl(url)}`;

  const handleImageError = (id: string, url?: string) => {
    const key = getImageKey(id, url);
    setBrokenImages(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
  };

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      setIsAdmin(user?.email === 'kianoshsolheim@gmail.com' || user?.email === 'kianosh@solheim.online');
    });

    const fetchRecs = async () => {
      try {
        const q = query(collection(db, 'recommendations'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => {
          const docData = doc.data();
          let category = docData.category;
          // Normalization logic
          if (category === 'Movies & Shows') category = 'Movies';
          if (category === 'YouTube') category = 'Video & Media';
          const resolvedCategory = category || 'Books';
          const link = docData.link || '';
          const imageUrl =
            docData.imageUrl ||
            (resolvedCategory === 'Video & Media' || extractYouTubeVideoId(link)
              ? getYouTubeThumbnailUrl(link, 0)
              : '');
          return {
            ...docData,
            id: doc.id,
            category: resolvedCategory,
            imageUrl
          };
        }) as Recommendation[];
        setRecommendations(data);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'recommendations');
      } finally {
        setLoading(false);
      }
    };
    fetchRecs();

    return () => {
      unsubscribeAuth();
    };
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      const cleanQuery = searchQuery.trim();
      const encodedQuery = encodeURIComponent(cleanQuery);

      if (searchType === 'Books') {
        const cleanIsbn = cleanQuery.replace(/[-\s]/g, '');
        const isIsbn = /^\d{9,13}[\dX]?$/i.test(cleanIsbn);
        const finalQuery = isIsbn ? `isbn:${cleanIsbn}` : encodedQuery;
        
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_YOUTUBE_API_KEY;
        const url = `https://www.googleapis.com/books/v1/volumes?q=${finalQuery}&maxResults=10${apiKey ? `&key=${apiKey}` : ''}`;
        
        let response = await fetch(url);
        
        // Fallback: If API key fails (e.g., restricted or quota), try without key
        if (!response.ok && apiKey) {
          console.warn('Google Books search with API key failed, retrying without key...');
          response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${finalQuery}&maxResults=10`);
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `Books API failed (${response.status})`);
        }
        
        const data = await response.json();
        const results: SearchResult[] = (data.items || []).map((item: any) => {
          const info = item.volumeInfo || {};
          const images = info.imageLinks || {};
          const rawImage = images.extraLarge || images.large || images.medium || images.thumbnail || images.smallThumbnail || '';
          const highResImage = rawImage ? rawImage.replace('http:', 'https:').replace('&edge=curl', '').replace('zoom=1', 'zoom=2') : '';
          return {
            title: info.title || 'Untitled',
            author: info.authors?.join(', ') || 'Unknown Author',
            description: info.description || '',
            link: info.infoLink || '',
            imageUrl: highResImage,
            category: 'Books'
          };
        });
        setSearchResults(results);
        if (results.length === 0) setStatus({ type: 'error', message: isIsbn ? 'No book found for this ISBN.' : 'No books found.' });
      } else if (searchType === 'Movies' || searchType === 'Shows') {
        let omdbKey = import.meta.env.VITE_OMDB_API_KEY || 'b054da29';
        // Extract key if user pasted a full URL
        if (omdbKey.includes('apikey=')) {
          const match = omdbKey.match(/apikey=([^&]+)/);
          if (match) omdbKey = match[1];
        }
        
        const typeParam = searchType === 'Movies' ? 'movie' : 'series';
        const response = await fetch(`https://www.omdbapi.com/?s=${encodedQuery}&type=${typeParam}&apikey=${omdbKey}`);
        if (!response.ok) throw new Error(`OMDb API failed (${response.status})`);
        const data = await response.json();
        
        if (data.Response === 'False') {
          if (data.Error === 'Movie not found!' || data.Error === 'Series not found!') {
            setSearchResults([]);
            setStatus({ type: 'error', message: `No ${searchType.toLowerCase()} found.` });
            return;
          }
          throw new Error(data.Error || `No ${searchType.toLowerCase()} found`);
        }

        const results: SearchResult[] = await Promise.all((data.Search || []).slice(0, 6).map(async (item: any) => {
          let plot = `Released: ${item.Year}`;
          try {
            const detailRes = await fetch(`https://www.omdbapi.com/?i=${item.imdbID}&plot=short&apikey=${omdbKey}`);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              if (detailData.Plot && detailData.Plot !== 'N/A') {
                plot = detailData.Plot;
              }
            }
          } catch (e) {
            console.warn('Failed to fetch plot for', item.imdbID);
          }

          return {
            title: item.Title,
            author: item.Year || 'Unknown Year',
            description: plot,
            link: `https://www.imdb.com/title/${item.imdbID}`,
            imageUrl: item.Poster !== 'N/A' ? item.Poster.replaceSX300?.() || item.Poster.replace('SX300', 'SX1000') : '',
            category: searchType
          };
        }));
        setSearchResults(results);
      } else if (searchType === 'Video & Media') {
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_YOUTUBE_API_KEY;
        let results: SearchResult[] = [];

        // 1. Server-side YouTube search & oEmbed proxy (works for URLs and title queries without requiring a client API key)
        try {
          const srvRes = await fetch(`/api/youtube-search?q=${encodedQuery}`);
          if (srvRes.ok) {
            const srvData = await srvRes.json();
            results = (srvData.items || []).map((item: any) => ({
              title: item.title || 'YouTube Video',
              author: item.creator || 'YouTube',
              description: item.description || '',
              link: item.link || '',
              imageUrl: item.imageUrl || getYouTubeThumbnailUrl(item.videoId, 0),
              category: 'Video & Media' as const
            }));
          }
        } catch (e) {
          console.error('Server YouTube search failed:', e);
        }

        if (apiKey && results.length === 0) {
          try {
            const ytResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodedQuery}&maxResults=6&type=video&key=${apiKey}`);
            if (ytResponse.ok) {
              const ytData = await ytResponse.json();
              results = [...results, ...(ytData.items || []).map((item: any) => ({
                title: item.snippet.title,
                author: item.snippet.channelTitle,
                description: item.snippet.description || '',
                link: `https://www.youtube.com/watch?v=${item.id.videoId}`,
                imageUrl: getYouTubeThumbnailUrl(item.id.videoId, 0) || item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
                category: 'Video & Media' as const
              }))];
            }
          } catch (e) {
            console.error('YouTube search error:', e);
          }
        }

        setSearchResults(results);
        if (results.length === 0 && !status) {
          setStatus({ 
            type: 'error', 
            message: 'No videos found. Try another search or paste a direct YouTube link!' 
          });
        }
      } else if (searchType === 'Apps') {
        const response = await fetch(`https://itunes.apple.com/search?term=${encodedQuery}&entity=software&limit=10`);
        if (!response.ok) throw new Error(`iTunes API failed (${response.status})`);
        const data = await response.json();
        
        const results: SearchResult[] = (data.results || []).map((item: any) => ({
          title: item.trackName,
          author: item.artistName || 'Unknown Developer',
          description: item.description || '',
          link: item.trackViewUrl,
          imageUrl: (item.artworkUrl512 || item.artworkUrl100 || '').replace('100x100bb', '1000x1000bb').replace('512x512bb', '1000x1000bb'),
          category: 'Apps'
        }));
        setSearchResults(results);
        if (results.length === 0) setStatus({ type: 'error', message: 'No apps found.' });
      } else if (searchType === 'Podcasts') {
        const response = await fetch(`https://itunes.apple.com/search?term=${encodedQuery}&entity=podcast&limit=10`);
        if (!response.ok) throw new Error(`Podcasts API failed (${response.status})`);
        const data = await response.json();
        
        const results: SearchResult[] = await Promise.all((data.results || []).slice(0, 6).map(async (item: any) => {
          let description = item.collectionName;
          if (item.feedUrl) {
            try {
              // Try to fetch feed via allorigins proxy to get real description
              const proxyRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(item.feedUrl)}`);
              if (proxyRes.ok) {
                const proxyData = await proxyRes.json();
                const xmlText = proxyData.contents;
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");
                const channelDesc = xmlDoc.querySelector("channel > description")?.textContent || 
                                   xmlDoc.querySelector("channel > summary")?.textContent ||
                                   xmlDoc.getElementsByTagName("itunes:summary")[0]?.textContent;
                if (channelDesc && channelDesc.trim().length > 10) {
                  // Strip HTML tags if any
                  description = channelDesc.replace(/<[^>]*>?/gm, '').trim();
                }
              }
            } catch (e) {
              console.warn('Failed to fetch podcast feed description:', e);
            }
          }

          return {
            title: item.collectionName,
            author: item.artistName || 'Unknown Creator',
            description: description,
            link: item.collectionViewUrl,
            imageUrl: (item.artworkUrl600 || item.artworkUrl100 || '').replace('600x600bb', '1000x1000bb').replace('100x100bb', '1000x1000bb'),
            category: 'Podcasts'
          };
        }));
        setSearchResults(results);
        if (results.length === 0) setStatus({ type: 'error', message: 'No podcasts found.' });
      }
    } catch (error: any) {
      console.error('Search error:', error);
      setStatus({ type: 'error', message: error.message || 'Search failed. Please try again.' });
    } finally {
      setIsSearching(false);
    }
  };

  const selectResult = (result: SearchResult) => {
    setFormData({
      title: result.title,
      author: result.author,
      category: result.category,
      description: result.description,
      link: result.link,
      imageUrl: result.imageUrl
    });
    setSearchResults([]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.author) return;

    const normalizedFormData = {
      ...formData,
      title: formData.title.trim(),
      author: formData.author.trim(),
      imageUrl: normalizeImageUrl(formData.imageUrl),
      link: formData.link?.trim()
        ? formData.link.trim().startsWith('http://') || formData.link.trim().startsWith('https://')
          ? formData.link.trim()
          : `https://${formData.link.trim()}`
        : ''
    };

    try {
      if (isEditing) {
        const updated = {
          ...normalizedFormData,
          updatedAt: serverTimestamp()
        };
        await updateDoc(doc(db, 'recommendations', isEditing), updated).catch(error => handleFirestoreError(error, OperationType.UPDATE, `recommendations/${isEditing}`));
        setRecommendations(prev => prev.map(r => r.id === isEditing ? { ...r, ...normalizedFormData } as Recommendation : r));
        setStatus({ type: 'success', message: 'Recommendation updated!' });
      } else {
        const newDoc = {
          ...normalizedFormData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, 'recommendations'), newDoc).catch(error => handleFirestoreError(error, OperationType.CREATE, 'recommendations'));
        if (docRef) {
          setRecommendations(prev => [{ ...normalizedFormData, id: docRef.id, createdAt: new Date() } as Recommendation, ...prev]);
        }
        setStatus({ type: 'success', message: 'Recommendation added!' });
      }
      
      setTimeout(() => {
        setIsAdding(false);
        setIsEditing(null);
        setStatus(null);
        setFormData({ title: '', author: '', category: 'Books', description: '', link: '', imageUrl: '' });
      }, 1000);
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to save recommendation.' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'recommendations', id)).catch(error => handleFirestoreError(error, OperationType.DELETE, `recommendations/${id}`));
      setRecommendations(prev => prev.filter(r => r.id !== id));
      setSelectedItem(null);
      setDeleteConfirmation(null);
      setStatus({ type: 'success', message: 'Deleted successfully' });
      setTimeout(() => setStatus(null), 2000);
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to delete' });
      setDeleteConfirmation(null);
    }
  };

  const syncMetadata = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setStatus({ type: 'info' as any, message: 'Syncing metadata and high-res covers...' });
    
    let updatedCount = 0;
    const omdbKey = import.meta.env.VITE_OMDB_API_KEY || 'b054da29';
    const actualOmdbKey = omdbKey.includes('apikey=') ? omdbKey.split('apikey=')[1].split('&')[0] : omdbKey;
    const googleKey = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_YOUTUBE_API_KEY;

    try {
      for (const item of recommendations) {
        let newImageUrl = item.imageUrl || '';
        let newDescription = item.description || '';
        let needsUpdate = false;

        // Upgrade existing URLs if possible
        if (item.category === 'Apps' || item.category === 'Podcasts') {
          const upgraded = newImageUrl.replace('100x100bb', '1000x1000bb').replace('512x512bb', '1000x1000bb').replace('600x600bb', '1000x1000bb');
          if (upgraded !== newImageUrl) {
            newImageUrl = upgraded;
            needsUpdate = true;
          }
        }

        // Fetch missing info or upgrade low-res
        const isGenericDesc = !newDescription || newDescription.startsWith('Type:') || newDescription.startsWith('Released:') || newDescription === item.title || newDescription === 'YouTube Video';
        const isLowRes = !newImageUrl || newImageUrl.includes('SX300') || newImageUrl.includes('zoom=1') || newImageUrl.includes('default.jpg') || newImageUrl.includes('hqdefault.jpg');

        if (isGenericDesc || isLowRes) {
          const q = encodeURIComponent(item.title);
          if (item.category === 'Movies' || item.category === 'Shows') {
            const type = item.category === 'Movies' ? 'movie' : 'series';
            const res = await fetch(`https://www.omdbapi.com/?t=${q}&type=${type}&plot=short&apikey=${actualOmdbKey}`);
            if (res.ok) {
              const data = await res.json();
              if (data.Response !== 'False') {
                if (data.Poster && data.Poster !== 'N/A' && isLowRes) {
                  newImageUrl = data.Poster.replace('SX300', 'SX1000');
                  needsUpdate = true;
                }
                if (data.Plot && data.Plot !== 'N/A' && isGenericDesc) {
                  newDescription = data.Plot;
                  needsUpdate = true;
                }
              }
            }
          } else if (item.category === 'Books') {
            const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`${item.title} ${item.author}`)}&maxResults=1${googleKey ? `&key=${googleKey}` : ''}`);
            if (res.ok) {
              const data = await res.json();
              const info = data.items?.[0]?.volumeInfo;
              if (info) {
                const images = info.imageLinks || {};
                const rawImg = images.extraLarge || images.large || images.medium || images.thumbnail || '';
                if (rawImg && isLowRes) {
                  newImageUrl = rawImg.replace('http:', 'https:').replace('&edge=curl', '').replace('zoom=1', 'zoom=2');
                  needsUpdate = true;
                }
                if (info.description && isGenericDesc) {
                  newDescription = info.description;
                  needsUpdate = true;
                }
              }
            }
          } else if (item.category === 'Podcasts' && isGenericDesc) {
            const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=podcast&limit=1`);
            if (res.ok) {
              const data = await res.json();
              const pod = data.results?.[0];
              if (pod?.feedUrl) {
                try {
                  const proxyRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(pod.feedUrl)}`);
                  if (proxyRes.ok) {
                    const proxyData = await proxyRes.json();
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(proxyData.contents, "text/xml");
                    const desc = xmlDoc.querySelector("channel > description")?.textContent || 
                                xmlDoc.getElementsByTagName("itunes:summary")[0]?.textContent;
                    if (desc && desc.trim().length > 10) {
                      newDescription = desc.replace(/<[^>]*>?/gm, '').trim();
                      needsUpdate = true;
                    }
                  }
                } catch (e) {}
              }
            }
          }
        }

        if (needsUpdate) {
          await updateDoc(doc(db, 'recommendations', item.id), {
            imageUrl: newImageUrl,
            description: newDescription,
            updatedAt: serverTimestamp()
          });
          setRecommendations(prev => prev.map(r => r.id === item.id ? { ...r, imageUrl: newImageUrl, description: newDescription } : r));
          updatedCount++;
        }
      }
      setStatus({ type: 'success', message: `Sync complete! Updated ${updatedCount} items.` });
    } catch (err) {
      console.error('Sync failed:', err);
      setStatus({ type: 'error', message: 'Sync failed partially.' });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const startEdit = (item: Recommendation) => {
    setFormData({
      title: item.title,
      author: item.author,
      category: item.category,
      description: item.description || '',
      link: item.link || '',
      imageUrl: item.imageUrl || ''
    });
    setIsEditing(item.id);
    setSelectedItem(null);
    setIsAdding(true);
  };

  const categories = ['All', 'Books', 'Movies', 'Shows', 'Video & Media', 'Apps', 'Podcasts'];
  
  const filteredRecommendations = useMemo(() => {
    const filtered = recommendations.filter(r => {
      const matchesCategory = selectedCategory === 'All' || r.category === selectedCategory;
      const matchesSearch = !filterSearch.trim() || 
        r.title.toLowerCase().includes(filterSearch.toLowerCase()) ||
        r.author.toLowerCase().includes(filterSearch.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(filterSearch.toLowerCase()));
      return matchesCategory && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'author') return a.author.localeCompare(b.author);
      // Default to newest (createdAt desc)
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  }, [recommendations, selectedCategory, filterSearch, sortBy]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: recommendations.length };
    recommendations.forEach(r => {
      counts[r.category] = (counts[r.category] || 0) + 1;
    });
    return counts;
  }, [recommendations]);

  const getIcon = (category: string) => {
    switch (category) {
      case 'Books': return <Book size={18} />;
      case 'Movies': return <Film size={18} />;
      case 'Shows': return <Tv size={18} />;
      case 'Video & Media': return <Video size={18} />;
      case 'Apps': return <Tv size={18} />;
      case 'Podcasts': return <Podcast size={18} />;
      default: return <Book size={18} />;
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-40 flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-accent animate-pulse" size={20} />
        </div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-ink/40 font-black animate-pulse">Curating Collection</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      {/* Header Section */}
      <div className="flex flex-col items-center mb-24 text-center relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 px-4 py-1.5 rounded-full bg-accent/5 border border-accent/10 text-accent text-[9px] uppercase tracking-[0.3em] font-black flex items-center gap-2"
        >
          <Sparkles size={12} />
          <span>Personal Anthology</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-6xl md:text-8xl font-serif mb-6 tracking-tighter leading-[0.9]"
        >
          Curated <span className="italic font-light text-accent">Works</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-ink/50 text-sm md:text-base max-w-xl font-serif italic leading-relaxed"
        >
          A digital cabinet of curiosities—books that reshaped my thinking, cinema that lingered, and tools that define my craft.
        </motion.p>
        
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-10 flex flex-wrap justify-center gap-4"
          >
            <Button
              onClick={() => {
                setIsEditing(null);
                setFormData({ title: '', author: '', category: 'Books', description: '', link: '', imageUrl: '' });
                setIsAdding(true);
              }}
              variant="primary"
              size="lg"
              icon={Plus}
              magnetic={true}
              className="rounded-2xl px-8 shadow-xl shadow-accent/10"
            >
              Add to Library
            </Button>
            <Button
              onClick={syncMetadata}
              variant="outline"
              size="lg"
              icon={RefreshCw}
              isLoading={isSyncing}
              magnetic={true}
              className="rounded-2xl border-ink/10 hover:bg-ink/5"
              title="Automatically fetch high-res covers and missing descriptions"
            >
              Sync Metadata
            </Button>
          </motion.div>
        )}

        {/* Filter & Search Bar */}
        <div className="mt-16 w-full max-w-5xl space-y-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-4">
            {/* Search Input */}
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-ink/20 group-focus-within:text-accent transition-colors" size={18} />
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Filter by title, author, or theme..."
                className="w-full pl-14 pr-10 py-4 bg-surface/50 backdrop-blur-md border border-ink/5 rounded-2xl text-xs focus:outline-none focus:border-accent/30 transition-all shadow-sm"
              />
              {filterSearch && (
                <button 
                  onClick={() => setFilterSearch('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/20 hover:text-ink transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Sort Selector */}
            <div className="flex items-center space-x-3 bg-surface/50 backdrop-blur-md p-1.5 rounded-2xl border border-ink/5 self-end md:self-auto">
              <span className="text-[9px] uppercase tracking-widest font-black text-ink/30 pl-3">Sort:</span>
              {(['newest', 'title', 'author'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setSortBy(option)}
                  className={`px-3 py-1.5 rounded-xl text-[9px] uppercase tracking-widest font-black transition-all ${
                    sortBy === option 
                      ? 'bg-ink text-paper shadow-sm' 
                      : 'text-ink/40 hover:text-ink'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap justify-center gap-2 p-2 bg-surface/40 backdrop-blur-xl rounded-[2rem] border border-ink/5 shadow-inner">
            {categories.map((cat) => {
              const count = categoryCounts[cat] || 0;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`group relative px-6 py-3 rounded-full text-[10px] uppercase tracking-[0.15em] font-black transition-all duration-500 flex items-center gap-2.5 ${
                    isSelected 
                      ? 'text-white' 
                      : 'text-ink/40 hover:text-ink'
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="activeCategory"
                      className="absolute inset-0 bg-accent rounded-full shadow-lg shadow-accent/20"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10">{cat}</span>
                  <span className={`relative z-10 text-[8px] px-1.5 py-0.5 rounded-full transition-colors ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-ink/5 text-ink/30 group-hover:text-ink/60'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid Section */}
      {filteredRecommendations.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-32 text-center space-y-4"
        >
          <div className="w-12 h-12 bg-ink/5 rounded-full flex items-center justify-center mx-auto text-ink/20">
            <Search size={24} />
          </div>
          <p className="font-serif italic text-ink/40">No works found matching your criteria.</p>
          <button 
            onClick={() => { setSelectedCategory('All'); setFilterSearch(''); }}
            className="text-[10px] uppercase tracking-widest font-black text-accent hover:underline"
          >
            Reset Filters
          </button>
        </motion.div>
      ) : (
        <motion.div 
          layout
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-12"
        >
          <AnimatePresence mode="popLayout">
            {filteredRecommendations.map((item, idx) => (
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
                className={`group cursor-pointer flex flex-col ${
                  item.category === 'Video & Media' || extractYouTubeVideoId(item.imageUrl) || extractYouTubeVideoId(item.link) || extractVimeoVideoId(item.link)
                    ? 'col-span-2'
                    : ''
                }`}
              >
                <div className={`relative ${
                  item.category === 'Video & Media' || extractYouTubeVideoId(item.imageUrl) || extractYouTubeVideoId(item.link) || extractVimeoVideoId(item.link)
                    ? 'aspect-video rounded-2xl'
                    : item.category === 'Apps' || item.category === 'Podcasts'
                    ? 'aspect-square rounded-[2.5rem]'
                    : 'aspect-[2/3] rounded-2xl'
                } w-full overflow-hidden bg-surface shadow-sm group-hover:shadow-2xl group-hover:shadow-accent/10 transition-all duration-700 border border-ink/5 group-hover:border-accent/20`}>
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
                        <div className="text-accent/20 mb-4 transform group-hover:scale-110 group-hover:text-accent/40 transition-all duration-500">
                          {getIcon(item.category)}
                        </div>
                        <h3 className="font-serif text-xs font-bold line-clamp-3 text-ink/60 px-2 leading-relaxed">{item.title}</h3>
                        <p className="text-[8px] uppercase tracking-[0.2em] text-ink/30 mt-3 font-black">{item.author}</p>
                      </div>
                    );
                  })()}
                  
                  {/* Subtle Top Badge */}
                  <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[7px] uppercase tracking-widest font-black flex items-center gap-1.5">
                      {getIcon(item.category)}
                      <span>{item.category}</span>
                    </div>
                  </div>

                  {getEmbedMediaInfo(item.link) && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                      <div className="w-12 h-12 rounded-full bg-black/65 backdrop-blur-md border border-white/25 text-white flex items-center justify-center shadow-xl group-hover:scale-110 group-hover:bg-accent group-hover:border-accent transition-all duration-300">
                        <Play size={18} className="fill-white ml-0.5" />
                      </div>
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-5">
                    <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                      <p className="text-white/50 text-[8px] uppercase tracking-[0.2em] font-black mb-1">{item.author}</p>
                      <h3 className="text-white font-serif text-sm font-bold leading-snug line-clamp-2">{item.title}</h3>
                      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-white/40 text-[8px] uppercase tracking-widest font-black">
                        <span>View Details</span>
                        <ExternalLink size={10} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Title below card for better scannability */}
                <div className="mt-4 px-1 space-y-1">
                  <h3 className="font-serif text-sm font-medium text-ink/90 group-hover:text-accent transition-colors truncate leading-tight">
                    {item.title}
                  </h3>
                  <p className="text-[9px] uppercase tracking-widest text-ink/30 font-bold truncate">
                    {item.author}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Detail Modal */}
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
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-4xl bg-surface border border-ink/10 rounded-[3rem] overflow-hidden shadow-2xl z-10 flex flex-col md:flex-row max-h-[90vh]"
            >
              <button
                onClick={() => {
                  setIsPlayingMedia(false);
                  setSelectedItem(null);
                }}
                className="absolute top-6 right-6 z-20 p-3 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-all hover:rotate-90"
              >
                <X size={20} />
              </button>

              {/* Left Side: Visual or Embedded Player */}
              <div className={`w-full ${isPlayingMedia && getEmbedMediaInfo(selectedItem.link) ? 'md:w-1/2 p-6 md:p-8' : 'md:w-2/5 p-8 md:p-12'} bg-ink/[0.02] relative flex items-center justify-center overflow-hidden border-b md:border-b-0 md:border-r border-ink/5`}>
                {(() => {
                  const imgKey = getImageKey(selectedItem.id, selectedItem.imageUrl || selectedItem.link);
                  const errorStage = brokenImages[imgKey] || 0;
                  const resolvedSrc = getDisplayImageUrl(selectedItem.imageUrl, errorStage, selectedItem.link);
                  const canShowImg = Boolean(resolvedSrc && errorStage < 2);
                  const embedInfo = getEmbedMediaInfo(selectedItem.link);
                  const isWidescreen =
                    selectedItem.category === 'Video & Media' ||
                    Boolean(extractYouTubeVideoId(selectedItem.imageUrl)) ||
                    Boolean(extractYouTubeVideoId(selectedItem.link)) ||
                    Boolean(extractVimeoVideoId(selectedItem.link));

                  if (isPlayingMedia && embedInfo) {
                    return (
                      <div className="w-full space-y-3 relative z-10">
                        <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-ink/10 bg-black">
                          {embedInfo.provider === 'video' ? (
                            <video src={embedInfo.embedUrl} controls autoPlay className="w-full h-full object-contain" />
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
                        className={`relative z-10 group/poster ${embedInfo ? 'cursor-pointer' : ''} ${
                          isWidescreen
                            ? 'w-full max-w-[340px] aspect-video rounded-2xl'
                            : selectedItem.category === 'Apps' || selectedItem.category === 'Podcasts'
                            ? 'w-48 md:w-full max-w-[240px] aspect-square rounded-[2.5rem]'
                            : 'w-48 md:w-full max-w-[240px] aspect-[2/3] rounded-2xl'
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
                          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-surface">
                            <div className="text-accent/20 mb-4">
                              {getIcon(selectedItem.category)}
                            </div>
                            <h3 className="font-serif text-lg font-bold text-ink/80">{selectedItem.title}</h3>
                          </div>
                        )}
                        {embedInfo && (
                          <div className="absolute inset-0 bg-black/30 group-hover/poster:bg-black/45 transition-colors flex flex-col items-center justify-center gap-2">
                            <div className="w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center shadow-2xl group-hover/poster:scale-110 transition-transform">
                              <Play size={22} className="fill-white ml-0.5" />
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Right Side: Content */}
              <div className="w-full md:w-3/5 p-8 md:p-14 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-8">
                  <div>
                    <div className="flex items-center space-x-2 text-accent text-[10px] uppercase tracking-[0.3em] font-black mb-4">
                      {getIcon(selectedItem.category)}
                      <span>{selectedItem.category}</span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-serif leading-[1.1] tracking-tight mb-3">{selectedItem.title}</h2>
                    <p className="text-sm md:text-base uppercase tracking-[0.2em] text-ink/40 font-black">{selectedItem.author}</p>
                  </div>

                  <div className="h-px w-16 bg-accent/20" />

                  {selectedItem.description ? (
                    <p className="text-ink/70 text-sm md:text-base leading-relaxed font-serif italic">
                      "{selectedItem.description}"
                    </p>
                  ) : (
                    <p className="text-ink/30 text-xs italic font-serif">No additional notes provided for this work.</p>
                  )}
                </div>

                <div className="pt-12 mt-12 border-t border-ink/5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {(() => {
                      const embedInfo = getEmbedMediaInfo(selectedItem.link);
                      if (!embedInfo) return null;
                      return (
                        <button
                          type="button"
                          onClick={() => setIsPlayingMedia((prev) => !prev)}
                          className="inline-flex items-center space-x-2 px-6 py-4 rounded-2xl bg-accent text-white text-xs uppercase tracking-widest font-black shadow-lg shadow-accent/20 hover:opacity-90 transition-all"
                        >
                          <Play size={15} className="fill-white" />
                          <span>{isPlayingMedia ? 'Hide Player' : 'Watch Here'}</span>
                        </button>
                      );
                    })()}
                    {selectedItem.link && (
                      <a
                        href={selectedItem.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center space-x-2 px-6 py-4 rounded-2xl text-xs uppercase tracking-widest font-black transition-all ${
                          getEmbedMediaInfo(selectedItem.link)
                            ? 'bg-paper border border-ink/10 hover:border-accent text-ink'
                            : 'bg-accent text-white shadow-lg shadow-accent/20 hover:opacity-90'
                        }`}
                      >
                        <span>
                          {extractYouTubeVideoId(selectedItem.link)
                            ? 'Watch on YouTube'
                            : extractVimeoVideoId(selectedItem.link)
                            ? 'Watch on Vimeo'
                            : 'Explore Work'}
                        </span>
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => startEdit(selectedItem)}
                        icon={Edit2}
                        className="rounded-xl"
                        title="Edit"
                      />
                      <Button
                        variant="outline"
                        size="md"
                        onClick={() => setDeleteConfirmation(selectedItem.id)}
                        icon={Trash2}
                        className="rounded-xl text-red-500 border-red-500/20 hover:bg-red-500/10"
                        title="Delete"
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-surface border border-ink/10 rounded-[2.5rem] p-8 md:p-12 overflow-hidden shadow-2xl z-10 my-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-serif">{isEditing ? 'Edit Recommendation' : 'Add Recommendation'}</h2>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsAdding(false)} 
                  icon={X} 
                />
              </div>

              {status && (
                <div className={`mb-6 p-4 rounded-xl flex items-center space-x-3 text-xs uppercase tracking-widest font-bold ${
                  status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 
                  status.type === 'info' ? 'bg-accent/10 text-accent' :
                  'bg-red-500/10 text-red-500'
                }`}>
                  {status.type === 'info' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  <span>{status.message}</span>
                </div>
              )}

              {!isEditing && (
                <div className="mb-10 space-y-6">
                  <div className="flex flex-wrap gap-2">
                    {(['Books', 'Movies', 'Shows', 'Video & Media', 'Apps', 'Podcasts'] as const).map((type) => (
                      <Button
                        key={type}
                        variant={searchType === type ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => {
                          setSearchType(type);
                          setFormData(prev => ({ ...prev, category: type }));
                          setSearchResults([]);
                        }}
                        className="rounded-xl text-[9px] uppercase tracking-widest font-black"
                      >
                        {type}
                      </Button>
                    ))}
                  </div>

                  <form onSubmit={handleSearch} className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={
                        searchType === 'Books' ? 'Search by title, author, or ISBN...' :
                        searchType === 'Movies' ? 'Search movies by title...' :
                        searchType === 'Shows' ? 'Search TV shows by title...' :
                        searchType === 'Video & Media' ? 'Search YouTube or paste video link...' :
                        searchType === 'Podcasts' ? 'Search podcasts...' :
                        'Search apps in App Store...'
                      }
                      className="w-full px-6 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent pr-16"
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={isSearching}
                      isLoading={isSearching}
                      icon={Search}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-xl"
                    />
                  </form>

                  {searchResults.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto p-2 bg-paper/50 rounded-2xl border border-ink/5">
                      {searchResults.map((result, idx) => (
                        <div
                          key={idx}
                          onClick={() => selectResult(result)}
                          className="flex items-center space-x-4 p-3 bg-surface hover:bg-accent/5 rounded-xl border border-ink/5 cursor-pointer transition-colors group"
                        >
                          {result.imageUrl && (
                            <img src={result.imageUrl} alt="" className="w-10 h-14 object-cover rounded-lg shadow-sm" referrerPolicy="no-referrer" />
                          )}
                          <div className="flex-grow min-w-0">
                            <h4 className="font-serif font-bold text-sm truncate group-hover:text-accent transition-colors">{result.title}</h4>
                            <p className="text-[10px] uppercase tracking-widest text-ink/40 truncate">{result.author}</p>
                          </div>
                          <Plus size={16} className="text-ink/20 group-hover:text-accent" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 font-black">Title</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-5 py-3 bg-paper border border-ink/10 rounded-xl text-sm focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 font-black">Author / Creator / Year</label>
                    <input
                      type="text"
                      required
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      className="w-full px-5 py-3 bg-paper border border-ink/10 rounded-xl text-sm focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 font-black">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      className="w-full px-5 py-3 bg-paper border border-ink/10 rounded-xl text-sm focus:outline-none focus:border-accent appearance-none"
                    >
                      <option value="Books">Books</option>
                      <option value="Movies">Movies</option>
                      <option value="Shows">Shows</option>
                      <option value="Video & Media">Video & Media</option>
                      <option value="Apps">Apps</option>
                      <option value="Podcasts">Podcasts</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 font-black">Cover Image URL</label>
                    <input
                      type="text"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-5 py-3 bg-paper border border-ink/10 rounded-xl text-sm focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-ink/40 font-black">External Link</label>
                  <input
                    type="url"
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                    className="w-full px-5 py-3 bg-paper border border-ink/10 rounded-xl text-sm focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-ink/40 font-black">Personal Note / Description</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-5 py-3 bg-paper border border-ink/10 rounded-xl text-sm focus:outline-none focus:border-accent resize-none"
                  />
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    icon={Save}
                    className="w-full py-4 rounded-2xl shadow-xl shadow-accent/20"
                  >
                    {isEditing ? 'Update Recommendation' : 'Save to Library'}
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
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-surface border border-ink/10 p-8 rounded-[2rem] max-w-sm w-full text-center z-10 shadow-2xl"
            >
              <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-serif mb-2">Delete Recommendation?</h3>
              <p className="text-xs text-ink/40 mb-8 leading-relaxed">This action cannot be undone. This item will be permanently removed from your library.</p>
              <div className="flex space-x-3">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setDeleteConfirmation(null)}
                  className="flex-1 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => handleDelete(deleteConfirmation)}
                  className="flex-1 rounded-xl bg-red-500 text-white border-red-500 hover:bg-red-600"
                >
                  Delete
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
