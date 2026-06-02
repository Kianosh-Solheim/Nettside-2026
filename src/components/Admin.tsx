import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, db, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, serverTimestamp, signInWithPopup, googleProvider, auth, storage, ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject, handleFirestoreError, OperationType, getDocs, listAll, getMetadata, getDocFromServer } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, Save, X, LogIn, AlertCircle, CheckCircle2, Search, Book as BookIcon, Film, Tv, Loader2, Upload, File as FileIcon, Image as ImageIcon, Copy, ExternalLink as ExternalLinkIcon, ArrowUpDown, Mail, Briefcase, GraduationCap, Heart, Calendar as CalendarIcon, RefreshCcw, Users, User, Check, Share2, MailOpen, XCircle, BookOpen, Activity } from 'lucide-react';
import Button from './ui/Button';
import RichTextEditor from './ui/RichTextEditor';
import Expenses from './Expenses';
import MeasuredWords from './MeasuredWords';
import Memberships from './Memberships';

const CV_CATEGORIES = [
  { title: 'Work Experience', icon: Briefcase },
  { title: 'Education', icon: GraduationCap },
  { title: 'Volunteering', icon: Heart }
];

interface Recommendation {
  id: string;
  title: string;
  author: string;
  category: 'Books' | 'Movies & Shows' | 'Video & Media' | 'Apps';
  description?: string;
  link?: string;
  imageUrl?: string;
}

interface SearchResult {
  title: string;
  author: string;
  description: string;
  link: string;
  imageUrl: string;
  category: 'Books' | 'Movies & Shows' | 'Video & Media' | 'Apps';
}

interface CVItem {
  title: string;
  subtitle: string;
  date: string;
  description: string;
  link?: string;
  logoUrl?: string;
}

interface CVSection {
  id: string;
  title: string;
  order: number;
  items: CVItem[];
}

interface Profile {
  name: string;
  role: string;
  email: string;
  location: string;
  website: string;
  phone?: string;
  mobile?: string;
  landline?: string;
  visitingCardKey?: string;
  githubToken?: string;
  githubRepo?: string; // owner/repo format
}

interface Social {
  id: string;
  label: string;
  href: string;
  icon: 'linkedin' | 'twitter' | 'github' | 'mail' | 'instagram' | 'facebook' | 'youtube' | 'bluesky';
  order: number;
}

interface FileMetadata {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  createdAt: any;
}

interface Message {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: any;
  read: boolean;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  author: string;
  imageUrl: string;
  imageAlt?: string;
  imageCredit?: string;
  tags: string[];
  status: 'draft' | 'published';
  publishedAt: any;
  createdAt: any;
  updatedAt: any;
}

interface PageStat {
  id: string;
  path: string;
  views: number;
  durationSeconds: number;
}

export default function Admin({ user }: { user: any }) {
  const [activeTab, setActiveTab] = useState<'oversikt' | 'recommendations' | 'cv' | 'socials' | 'files' | 'messages' | 'integrations' | 'users' | 'meetings' | 'expenses' | 'measured-words' | 'memberships' | 'writings'>('oversikt');
  const [pageStats, setPageStats] = useState<PageStat[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [cvSections, setCvSections] = useState<CVSection[]>([]);
  const [socials, setSocials] = useState<Social[]>([]);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageFilter, setMessageFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [users, setUsers] = useState<any[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userPages, setUserPages] = useState<Record<string, any>>({});
  const [allMeetings, setAllMeetings] = useState<any[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [isEditingBlogPost, setIsEditingBlogPost] = useState<string | null>(null);
  const [filePickerTab, setFilePickerTab] = useState<'upload' | 'wikimedia'>('upload');
  const [wikimediaSearch, setWikimediaSearch] = useState('');
  const [wikimediaResults, setWikimediaResults] = useState<any[]>([]);
  const [isSearchingWikimedia, setIsSearchingWikimedia] = useState(false);
  const [blogFormData, setBlogFormData] = useState<Partial<BlogPost>>({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    author: '',
    imageUrl: '',
    tags: [],
    status: 'draft'
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileSortOption, setFileSortOption] = useState<'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc'>('newest');
  const [profile, setProfile] = useState<Profile>({
    name: 'Kianosh F. Solheim',
    role: 'Comparative Politics Student at the University of Bergen',
    email: 'kianosh@solheim.online',
    location: 'Bergen, Norway',
    website: 'www.solheim.online',
    phone: '',
    mobile: '',
    landline: '',
    visitingCardKey: ''
  });
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Recommendation>>({
    title: '',
    author: '',
    category: 'Books',
    description: '',
    link: '',
    imageUrl: ''
  });
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [timetableBoards, setTimetableBoards] = useState<any[]>([]);
  const [filePicker, setFilePicker] = useState<{
    isOpen: boolean;
    onSelect: (url: string, alt?: string, credit?: string) => void;
  }>({
    isOpen: false,
    onSelect: () => {}
  });

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'timetable_boards'), orderBy('order', 'asc')), (snapshot) => {
      setTimetableBoards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsub;
  }, []);

  const addTimetableBoard = async () => {
    try {
      await addDoc(collection(db, 'timetable_boards'), {
        name: 'New Board',
        url: '',
        order: timetableBoards.length + 1,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'timetable_boards');
    }
  };

  const updateTimetableBoard = async (id: string, data: any) => {
    try {
      await updateDoc(doc(db, 'timetable_boards', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `timetable_boards/${id}`);
    }
  };

  const deleteTimetableBoard = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'timetable_boards', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `timetable_boards/${id}`);
    }
  };
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchType, setSearchType] = useState<'Books' | 'Movies & Shows' | 'Video & Media' | 'Apps'>('Books');
  const [isFetchingYouTube, setIsFetchingYouTube] = useState(false);
  const [isSearchingMovies, setIsSearchingMovies] = useState(false);
  const [movieSearchResults, setMovieSearchResults] = useState<any[]>([]);

  const isAdmin = user?.email === 'kianoshsolheim@gmail.com' || user?.email === 'kianosh@solheim.online';

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'blog_posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBlogPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogPost)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'blog_posts'));
    return unsubscribe;
  }, [isAdmin]);

  useEffect(() => {
    if (profile.name && !blogFormData.author) {
      setBlogFormData(prev => ({ ...prev, author: profile.name }));
    }
  }, [profile.name]);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'recommendations'), orderBy('createdAt', 'desc'));
    const unsubscribeRecs = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Recommendation[];
      setRecommendations(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'recommendations'));

    const qCV = query(collection(db, 'cv'), orderBy('order', 'asc'));
    const unsubscribeCV = onSnapshot(qCV, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as CVSection[];
      setCvSections(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'cv'));

    const unsubscribeProfile = onSnapshot(collection(db, 'profile'), (snapshot) => {
      if (!snapshot.empty) {
        setProfile({ ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as any);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'profile'));

    const qSocials = query(collection(db, 'socials'), orderBy('order', 'asc'));
    const unsubscribeSocials = onSnapshot(qSocials, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Social[];
      setSocials(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'socials'));

    const qFiles = query(collection(db, 'files'), orderBy('createdAt', 'desc'));
    const unsubscribeFiles = onSnapshot(qFiles, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as FileMetadata[];
      setFiles(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'files'));

    const qMessages = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));
    const unsubscribeMessages = onSnapshot(qMessages, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Message[];
      setMessages(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'messages'));

    const qUsers = query(collection(db, 'users'), orderBy('email', 'asc'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      setUsers(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    const unsubscribeUserPages = onSnapshot(collection(db, 'user_pages'), (snapshot) => {
      const meetings: any[] = [];
      const pages: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        pages[doc.id] = data;
        if (data.meetings && Array.isArray(data.meetings)) {
          data.meetings.forEach((m: any) => {
            meetings.push({
              ...m,
              userId: doc.id,
              userEmail: data.contactInfo?.email || 'Unknown'
            });
          });
        }
      });
      setUserPages(pages);
      setAllMeetings(meetings.sort((a, b) => new Date(b.updatedAt || b.date).getTime() - new Date(a.updatedAt || a.date).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'user_pages'));

    const unsubscribeConfig = onSnapshot(doc(db, 'config', 'google_calendar_tokens'), (snapshot) => {
      setIsCalendarConnected(snapshot.exists());
    }, (error) => handleFirestoreError(error, OperationType.GET, 'config/google_calendar_tokens'));

    const qPageStats = query(collection(db, 'pageStats'), orderBy('views', 'desc'));
    const unsubscribePageStats = onSnapshot(qPageStats, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as PageStat[];
      setPageStats(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'pageStats'));

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        setStatus({ type: 'success', message: 'Google Calendar connected successfully!' });
        setTimeout(() => setStatus(null), 3000);
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      unsubscribeRecs();
      unsubscribeCV();
      unsubscribeProfile();
      unsubscribeSocials();
      unsubscribeFiles();
      unsubscribeMessages();
      unsubscribeUsers();
      unsubscribeUserPages();
      unsubscribeConfig();
      unsubscribePageStats();
      window.removeEventListener('message', handleMessage);
    };
  }, [isAdmin]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      if (searchType === 'Books') {
        let query = searchQuery.trim();
        // Check if it's an ISBN (10 or 13 digits, allowing hyphens and spaces)
        const cleanIsbn = query.replace(/[-\s]/g, '');
        const isIsbn = /^\d{9,13}[\dX]?$/i.test(cleanIsbn);
        
        if (isIsbn) {
          query = `isbn:${cleanIsbn}`;
        }
        
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_YOUTUBE_API_KEY;
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5${apiKey ? `&key=${apiKey}` : ''}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Books API failed: ${errorData.error?.message || response.statusText}`);
        }
        const data = await response.json();
        
        const results: SearchResult[] = (data.items || []).map((item: any) => ({
          title: item.volumeInfo.title,
          author: item.volumeInfo.authors?.join(', ') || 'Unknown Author',
          description: item.volumeInfo.description || '',
          link: item.volumeInfo.infoLink,
          imageUrl: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
          category: 'Books'
        }));
        setSearchResults(results);
        if (results.length === 0) setStatus({ type: 'error', message: isIsbn ? 'No book found for this ISBN.' : 'No books found.' });
      } else if (searchType === 'Movies & Shows') {
        const omdbKey = import.meta.env.VITE_OMDB_API_KEY;
        const response = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(searchQuery)}&type=movie&apikey=${omdbKey || 'b054da29'}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Movies API failed: ${errorData.Error || response.statusText}`);
        }
        const data = await response.json();
        
        if (data.Response === 'False') {
          throw new Error(data.Error || 'No movies found');
        }

        const results: SearchResult[] = (data.Search || []).map((item: any) => ({
          title: item.Title,
          author: item.Year || 'Unknown Year',
          description: `Type: ${item.Type}`,
          link: `https://www.imdb.com/title/${item.imdbID}`,
          imageUrl: item.Poster !== 'N/A' ? item.Poster : '',
          category: 'Movies & Shows'
        }));
        setSearchResults(results);
        if (results.length === 0) setStatus({ type: 'error', message: 'No movies found.' });
      } else if (searchType === 'Video & Media') {
        // Search both iTunes TV and YouTube if possible, or just provide a combined search
        // For simplicity, let's try to search YouTube first if we have a key, otherwise iTunes
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_YOUTUBE_API_KEY;
        let results: SearchResult[] = [];

        if (apiKey) {
          try {
            const ytResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&maxResults=3&type=video&key=${apiKey}`);
            if (ytResponse.ok) {
              const ytData = await ytResponse.json();
              results = [...results, ...(ytData.items || []).map((item: any) => ({
                title: item.snippet.title,
                author: item.snippet.channelTitle,
                description: item.snippet.description || '',
                link: `https://www.youtube.com/watch?v=${item.id.videoId}`,
                imageUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
                category: 'Video & Media' as const
              }))];
            }
          } catch (e) {
            console.error('YouTube search failed', e);
          }
        }

        try {
          const omdbKey = import.meta.env.VITE_OMDB_API_KEY;
          const omdbResponse = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(searchQuery)}&type=series&apikey=${omdbKey || 'b054da29'}`);
          if (omdbResponse.ok) {
            const omdbData = await omdbResponse.ok ? await omdbResponse.json() : { Response: 'False' };
            if (omdbData.Response !== 'False') {
              results = [...results, ...(omdbData.Search || []).map((item: any) => ({
                title: item.Title,
                author: item.Year || 'Unknown Year',
                description: `Type: ${item.Type}`,
                link: `https://www.imdb.com/title/${item.imdbID}`,
                imageUrl: item.Poster !== 'N/A' ? item.Poster : '',
                category: 'Video & Media' as const
              }))];
            }
          }
        } catch (e) {
          console.error('OMDb series search failed', e);
        }

        setSearchResults(results);
        if (results.length === 0) setStatus({ type: 'error', message: 'No video or media found.' });
      } else if (searchType === 'Apps') {
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&entity=software&limit=5`);
        if (!response.ok) throw new Error('Apps API failed');
        const data = await response.json();
        
        const results: SearchResult[] = (data.results || []).map((item: any) => ({
          title: item.trackName,
          author: item.artistName || 'Unknown Developer',
          description: item.description || '',
          link: item.trackViewUrl,
          imageUrl: item.artworkUrl100.replace('100x100', '512x512'),
          category: 'Apps'
        }));
        setSearchResults(results);
        if (results.length === 0) setStatus({ type: 'error', message: 'No apps found.' });
      }
    } catch (error) {
      console.error('Search error:', error);
      setStatus({ type: 'error', message: 'Search failed. Please try again.' });
    } finally {
      setIsSearching(false);
    }
  };

  const importResult = (result: SearchResult) => {
    setFormData({
      title: result.title,
      author: result.author,
      category: result.category,
      description: result.description,
      link: result.link,
      imageUrl: result.imageUrl
    });
    setSearchResults([]);
    setSearchQuery('');
    setStatus({ type: 'success', message: 'Data imported into form' });
    setTimeout(() => setStatus(null), 2000);
  };

  const fetchYouTubeData = async () => {
    const url = formData.link;
    if (!url || !url.includes('youtube.com') && !url.includes('youtu.be')) {
      setStatus({ type: 'error', message: 'Please enter a valid YouTube URL first.' });
      return;
    }

    setIsFetchingYouTube(true);
    try {
      // Use oEmbed to get video info without an API key
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (!response.ok) throw new Error('Failed to fetch YouTube info');
      const data = await response.json();

      setFormData(prev => ({
        ...prev,
        title: data.title || prev.title,
        author: data.author_name || prev.author,
        imageUrl: data.thumbnail_url || prev.imageUrl,
        category: 'Video & Media'
      }));
      setStatus({ type: 'success', message: 'YouTube data fetched!' });
      setTimeout(() => setStatus(null), 2000);
    } catch (error) {
      console.error('YouTube fetch error:', error);
      setStatus({ type: 'error', message: 'Failed to fetch YouTube info. Try manual entry.' });
    } finally {
      setIsFetchingYouTube(false);
    }
  };

  const handleSearchMovies = async () => {
    if (!formData.title) {
      setStatus({ type: 'error', message: 'Please enter a movie title first.' });
      return;
    }
    setIsSearchingMovies(true);
    try {
      const omdbKey = import.meta.env.VITE_OMDB_API_KEY;
      const response = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(formData.title)}&type=movie&apikey=${omdbKey || 'b054da29'}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Movies API failed: ${errorData.Error || response.statusText}`);
      }
      const data = await response.json();
      
      if (data.Response === 'False') {
        setMovieSearchResults([]);
        if (data.Error !== 'Movie not found!') {
          throw new Error(data.Error);
        } else {
          setStatus({ type: 'error', message: 'No movie posters found for this title.' });
        }
      } else {
        setMovieSearchResults(data.Search || []);
      }
    } catch (error) {
      console.error("Error searching movies:", error);
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Failed to search for movie posters.' });
    } finally {
      setIsSearchingMovies(false);
    }
  };

  const seedData = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Seed Data',
      message: 'This will populate your profile with your actual CV, recommendations, and social links. Continue?',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        const initialData = [
          {
            title: "A Vision of Britain",
            author: "Charles (Prince of Wales)",
            category: "Books",
            description: "",
            link: "http://books.google.dk/books?id=fNvotwAACAAJ&dq=A+Vision+of+Britain&hl=&source=gbs_api",
            imageUrl: ""
          },
          {
            title: "Christopher Hitchens - Free Speech",
            author: "hitch archive",
            category: "Video & Media",
            description: "Freedom of Speech - Christopher Hitchens I am sure that all British journalists will agree with the statement issued by Jodie ...",
            link: "https://www.youtube.com/watch?v=4Z2uzEM0ugY",
            imageUrl: "https://i.ytimg.com/vi/4Z2uzEM0ugY/hqdefault.jpg"
          },
          {
            title: "God Is Not Great",
            author: "Christopher Hitchens",
            category: "Books",
            description: "In god is Not Great Hitchens turned his formidable eloquence and rhetorical energy to the most controversial issue in the world: God and religion. The result is a devastating critique of religious faith god Is Not Great is the ultimate case against religion. In a series of acute readings of the major religious texts, Christopher Hitchens demonstrates the ways in which religion is man-made, dangerously sexually repressive and distorts the very origins of the cosmos. Above all, Hitchens argues that the concept of an omniscient God has profoundly damaged humanity, and proposes that the world might be a great deal better off without 'him'.",
            link: "https://play.google.com/store/books/details?id=Lm9VdHv0OWEC&source=gbs_api",
            imageUrl: "https://books.google.com/books/content?id=Lm9VdHv0OWEC&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api"
          },
          {
            title: "Obsidian",
            author: "Dynalist Inc.",
            category: "Apps",
            description: "Obsidian is a powerful knowledge base that works on top of a local folder of plain text Markdown files. It is a second brain, for you, forever. Now available on the go for iOS! Features include: - Customizable toolbar - Pull down quick actions - Graph view - Community plugins - Themes - Sidebar pinning for tablet - iCloud vaults",
            link: "https://obsidian.md",
            imageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/c6/cf/a0/c6cfa074-d701-4b37-c9c5-f5f989759291/AppIcon-0-0-1x_U007epad-0-1-85-220.png/512x512bb.jpg"
          }
        ];

        const initialCV = [
          {
            title: "Work Experience",
            order: 1,
            items: [
              {
                title: "Intern",
                subtitle: "United Nations Association of Norway",
                date: "Jan 2025 - Jul 2025",
                description: "Internship as part of my Comparative Politics bachelor's degree (SAMPOL290 Comparative Politics Internship)",
                link: "",
                logoUrl: ""
              }
            ]
          },
          {
            title: "Education",
            order: 2,
            items: [
              {
                title: "Master's degree in Comparative Politics",
                subtitle: "University of Bergen",
                date: "Aug 2025 - Aug 2027",
                description: "Thesis: Thesis Title: (To be determined)",
                link: "",
                logoUrl: ""
              },
              {
                title: "Bachelor's degree in Comparative Politics",
                subtitle: "University of Bergen",
                date: "Jul 2022 - Jul 2025",
                description: "Thesis: Thesis Title: \"The Elephant in the Room: How the GOP Paved the Way for Trump’s Populism\" Supervisor: Jonas Linde (UiB) Courses: SAMPOL100 Introduction to Comparative Politics, SAMPOL103 Political ideologies, SAMPOL105 State and Nation Building, SAMPOL106 Political Institutions in Established Democracies, SAMPOL107 Political Mobilization, SAMPOL115 Democracy and Democratization, MET102 Methods in the Social Sciences, SAMPOL203 Comparative Arctic Indigenous Governance, SAMPOL226 Populism and its Consequences for Liberal Democracy, SAMPOL233 Forsvar og totalforsvar i etablerte demokrati, SAMPOL230 Party Politics in Europa andutover, SAMPOL235 The Politics and Global Governance of International Protection, SAMPOL238 The Politics of Contestation, SAMPOL260 Bachelor Essay in Comparative Politics",
                link: "",
                logoUrl: ""
              }
            ]
          },
          {
            title: "Volunteering",
            order: 3,
            items: [
              {
                title: "Board member",
                subtitle: "The LO Students in Bergen",
                date: "Sep 2025 - Present",
                description: "(LO refers to the Norwegian Confederation of Trade Unions.)",
                link: "",
                logoUrl: ""
              },
              {
                title: "Head of Communications",
                subtitle: "The Architectural Uprising Bergen",
                date: "Jan 2025 - Present",
                description: "Responsible to key individuals, and for developing communication strategies for use on various political parties.",
                link: "",
                logoUrl: ""
              },
              {
                title: "Board Member",
                subtitle: "The Labour Party’s student association in Bergen (ASTUD)",
                date: "Jan 2024 - Jan 2025",
                description: "The Labour Party’s student association in Bergen (ASTUD)",
                link: "",
                logoUrl: ""
              },
              {
                title: "Head of the Social Democratic List (Listeleder)",
                subtitle: "Sosialdemokratisk Liste UiB, Studentparlamentet",
                date: "Aug 2023 - Mar 2024",
                description: "I was Head of the Social Democratic List at the University of Bergen Student Parliament, representing and coordinating the list's activities and initiatives from March 2023 to March 2024.",
                link: "",
                logoUrl: ""
              },
              {
                title: "Representative",
                subtitle: "University’s Learning Environment Committee",
                date: "Aug 2023 - Jul 2025",
                description: "Elected by the Student Parliament for two terms: 1 Aug 2023 – 31 Jul 2024 & 1 Aug 2024 – 31 Jul 2025 ",
                link: "",
                logoUrl: ""
              },
              {
                title: "PR Committee Member",
                subtitle: "Sampolkonferansen, (Comparative Politics Conference)",
                date: "Oct 2022 - Oct 2023",
                description: "Contributed to public relations and marketing efforts, with responsibility for the website and other communication channels",
                link: "",
                logoUrl: ""
              },
              {
                title: "Board Member",
                subtitle: "Bergen AUF (Labour Party Youth Organisation)",
                date: "Jan 2020 - Aug 2021 & Sep 2022 - Jan 2024",
                description: "",
                link: "",
                logoUrl: ""
              }
            ]
          }
        ];

        try {
          for (const item of initialData) {
            await addDoc(collection(db, 'recommendations'), {
              ...item,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            }).catch(error => handleFirestoreError(error, OperationType.CREATE, 'recommendations'));
          }
          for (const section of initialCV) {
            await addDoc(collection(db, 'cv'), section).catch(error => handleFirestoreError(error, OperationType.CREATE, 'cv'));
          }
          
          const initialSocials = [
            { label: "LinkedIn", href: "https://www.linkedin.com/in/solheim-online", icon: "linkedin", order: 1 }
          ];
          for (const social of initialSocials) {
            await addDoc(collection(db, 'socials'), social).catch(error => handleFirestoreError(error, OperationType.CREATE, 'socials'));
          }

          await addDoc(collection(db, 'profile'), {
            name: 'Kianosh F. Solheim',
            role: 'Comparative Politics Student at the University of Bergen',
            email: 'kianosh@solheim.online',
            location: 'Bergen, Norway',
            website: 'www.solheim.online',
            phone: '+47 000 00 000',
            mobile: '',
            landline: '',
            visitingCardKey: 'secret'
          }).catch(error => handleFirestoreError(error, OperationType.CREATE, 'profile'));
          setStatus({ type: 'success', message: 'Your data seeded successfully' });
          setTimeout(() => setStatus(null), 3000);
        } catch (error) {
          console.error(error);
          setStatus({ type: 'error', message: 'Failed to seed data' });
        }
      }
    });
  };

  const handleConnectCalendar = async () => {
    try {
      const response = await fetch('/api/auth/google/url');
      const { url } = await response.json();
      window.open(url, 'google_auth_popup', 'width=600,height=700');
    } catch (error) {
      console.error("Failed to get auth URL:", error);
      setStatus({ type: 'error', message: 'Failed to initiate Google Calendar connection' });
    }
  };
  const updateProfile = async (e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingProfile(true);
    try {
      const profileRef = collection(db, 'profile');
      const snapshot = await getDocs(profileRef)
        .catch(error => handleFirestoreError(error, OperationType.LIST, 'profile'));
      if (snapshot && snapshot.empty) {
        await addDoc(profileRef, profile)
          .catch(error => handleFirestoreError(error, OperationType.CREATE, 'profile'));
      } else if (snapshot) {
        await updateDoc(doc(db, 'profile', snapshot.docs[0].id), profile as any)
          .catch(error => handleFirestoreError(error, OperationType.UPDATE, `profile/${snapshot.docs[0].id}`));
      }
      setStatus({ type: 'success', message: 'Profile updated successfully' });
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: 'Failed to update profile' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const addCVSection = async (title: string = 'New Section') => {
    try {
      await addDoc(collection(db, 'cv'), {
        title,
        order: cvSections.length + 1,
        items: [{ title: '', subtitle: '', date: '', description: '', link: '', logoUrl: '' }]
      }).catch(error => handleFirestoreError(error, OperationType.CREATE, 'cv'));
    } catch (error) {
      console.error(error);
    }
  };

  const updateCVSection = async (id: string, data: Partial<CVSection>) => {
    try {
      await updateDoc(doc(db, 'cv', id), data)
        .catch(error => handleFirestoreError(error, OperationType.UPDATE, `cv/${id}`));
      setStatus({ type: 'success', message: 'Section updated' });
      setTimeout(() => setStatus(null), 2000);
    } catch (error) {
      console.error(error);
    }
  };

  const deleteCVSection = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Section',
      message: 'Are you sure you want to delete this entire CV section? This action cannot be undone.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'cv', id))
            .catch(error => handleFirestoreError(error, OperationType.DELETE, `cv/${id}`));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          setStatus({ type: 'success', message: 'Section deleted' });
          setTimeout(() => setStatus(null), 2000);
        } catch (error) {
          console.error(error);
          setStatus({ type: 'error', message: 'Failed to delete section' });
        }
      }
    });
  };

  const addSocial = async () => {
    try {
      await addDoc(collection(db, 'socials'), {
        label: 'New Link',
        href: 'https://',
        icon: 'linkedin',
        order: socials.length + 1
      }).catch(error => handleFirestoreError(error, OperationType.CREATE, 'socials'));
    } catch (error) {
      console.error(error);
    }
  };

  const updateSocial = async (id: string, data: Partial<Social>) => {
    try {
      await updateDoc(doc(db, 'socials', id), data)
        .catch(error => handleFirestoreError(error, OperationType.UPDATE, `socials/${id}`));
    } catch (error) {
      console.error(error);
    }
  };

  const deleteSocial = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Social Link',
      message: 'Are you sure you want to delete this social media link?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'socials', id))
            .catch(error => handleFirestoreError(error, OperationType.DELETE, `socials/${id}`));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          setStatus({ type: 'success', message: 'Social link deleted' });
          setTimeout(() => setStatus(null), 2000);
        } catch (error) {
          console.error(error);
          setStatus({ type: 'error', message: 'Failed to delete social link' });
        }
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await updateDoc(doc(db, 'recommendations', isEditing), {
          ...formData,
          updatedAt: serverTimestamp()
        }).catch(error => handleFirestoreError(error, OperationType.UPDATE, `recommendations/${isEditing}`));
        setStatus({ type: 'success', message: 'Recommendation updated successfully' });
      } else {
        await addDoc(collection(db, 'recommendations'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }).catch(error => handleFirestoreError(error, OperationType.CREATE, 'recommendations'));
        setStatus({ type: 'success', message: 'Recommendation added successfully' });
      }
      setFormData({ title: '', author: '', category: 'Books', description: '', link: '', imageUrl: '' });
      setIsEditing(null);
      setMovieSearchResults([]);
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: 'Failed to save recommendation' });
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Recommendation',
      message: 'Are you sure you want to delete this recommendation?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'recommendations', id))
            .catch(error => handleFirestoreError(error, OperationType.DELETE, `recommendations/${id}`));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          setStatus({ type: 'success', message: 'Recommendation deleted successfully' });
          setTimeout(() => setStatus(null), 3000);
        } catch (error) {
          setStatus({ type: 'error', message: 'Failed to delete recommendation' });
        }
      }
    });
  };

  const handleEdit = (rec: Recommendation) => {
    setIsEditing(rec.id);
    setFormData({
      title: rec.title,
      author: rec.author,
      category: rec.category,
      description: rec.description || '',
      link: rec.link || '',
      imageUrl: rec.imageUrl || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const syncStorage = async () => {
    if (!auth.currentUser || !isAdmin) return;
    setIsSyncing(true);
    setStatus({ type: 'info', message: 'Syncing storage with database...' });

    console.log(`Starting sync as user: ${auth.currentUser.uid} (${auth.currentUser.email})`);

    try {
      // Get current files in Firestore to avoid duplicates
      const currentFilesSnapshot = await getDocs(collection(db, 'files'))
        .catch(error => handleFirestoreError(error, OperationType.LIST, 'files'));
      
      if (!currentFilesSnapshot) return;

      const currentUrls = new Set(currentFilesSnapshot.docs.map(doc => doc.data().url));
      console.log(`Current indexed files in database: ${currentUrls.size}`);

      let addedCount = 0;
      const checkedPaths = new Set<string>();

      const processFolder = async (folderPath: string) => {
        if (checkedPaths.has(folderPath)) return;
        checkedPaths.add(folderPath);

        console.log(`Listing folder: "${folderPath}"`);
        const storageRef = ref(storage, folderPath);
        
        try {
          const res = await listAll(storageRef);
          console.log(`Found ${res.items.length} items and ${res.prefixes.length} subfolders in "${folderPath}"`);

          for (const item of res.items) {
            const url = await getDownloadURL(item);
            if (!currentUrls.has(url)) {
              console.log(`Syncing new file: ${item.name}`);
              try {
                const metadata = await getMetadata(item);
                await addDoc(collection(db, 'files'), {
                  name: item.name,
                  url: url,
                  type: metadata.contentType || 'application/octet-stream',
                  size: metadata.size || 0,
                  createdAt: serverTimestamp()
                }).catch(error => handleFirestoreError(error, OperationType.CREATE, 'files'));
                addedCount++;
              } catch (metaErr) {
                console.warn('Could not get metadata for', item.name, metaErr);
                // Fallback if metadata fails
                await addDoc(collection(db, 'files'), {
                  name: item.name,
                  url: url,
                  type: 'application/octet-stream',
                  size: 0,
                  createdAt: serverTimestamp()
                }).catch(error => handleFirestoreError(error, OperationType.CREATE, 'files'));
                addedCount++;
              }
            } else {
              console.log(`File already indexed: ${item.name}`);
            }
          }

          // Recursively process subfolders
          for (const prefix of res.prefixes) {
            await processFolder(prefix.fullPath);
          }
        } catch (err: any) {
          console.warn(`Could not list path: "${folderPath}"`, err);
          if (err.code === 'storage/unauthorized') {
            // Log but don't throw, so we can check other top-level folders
            console.error(`Permission denied for folder "${folderPath || 'root'}". Check Storage Rules.`);
          } else {
            throw err;
          }
        }
      };

      // Start from root and common folders
      const pathsToCheck = ['', 'uploads', 'images', 'documents', 'assets'];
      for (const path of pathsToCheck) {
        setStatus({ type: 'info', message: `Checking folder: ${path || 'root'}...` });
        try {
          await processFolder(path);
        } catch (e: any) {
          console.error(`Failed to process path "${path}":`, e);
        }
      }

      setStatus({ type: 'success', message: `Sync complete. Added ${addedCount} new files.` });
      setTimeout(() => setStatus(null), 3000);
    } catch (error: any) {
      console.error('Sync error:', error);
      setStatus({ type: 'error', message: `Sync failed: ${error.message}` });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!auth.currentUser) {
      setStatus({ type: 'error', message: 'You must be logged in to upload files' });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        }, 
        (error: any) => {
          console.error('Upload error details:', {
            code: error.code,
            message: error.message,
            serverResponse: error.serverResponse,
            name: error.name
          });
          setStatus({ type: 'error', message: `Upload failed: ${error.message}` });
          setIsUploading(false);
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, 'files'), {
            name: file.name,
            url: downloadURL,
            type: file.type,
            size: file.size,
            createdAt: serverTimestamp()
          }).catch(error => handleFirestoreError(error, OperationType.CREATE, 'files'));

          setStatus({ type: 'success', message: 'File uploaded successfully' });
          setIsUploading(false);
          setUploadProgress(0);
          setTimeout(() => setStatus(null), 3000);
        }
      );
    } catch (error: any) {
      console.error('Upload error details:', {
        code: error.code,
        message: error.message,
        serverResponse: error.serverResponse,
        name: error.name
      });
      setStatus({ type: 'error', message: `Upload failed: ${error.message}` });
      setIsUploading(false);
    }
  };

  const deleteFile = async (file: FileMetadata) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete File',
      message: `Are you sure you want to delete "${file.name}"? This will remove it from storage and any links to it will break.`,
      onConfirm: async () => {
        try {
          // Delete from Storage
          const fileRef = ref(storage, file.url);
          await deleteObject(fileRef);
          
          // Delete from Firestore
          await deleteDoc(doc(db, 'files', file.id))
            .catch(error => handleFirestoreError(error, OperationType.DELETE, `files/${file.id}`));
          
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          setStatus({ type: 'success', message: 'File deleted successfully' });
          setTimeout(() => setStatus(null), 3000);
        } catch (error) {
          console.error('Delete error:', error);
          // Even if storage delete fails (e.g. file already gone), delete from Firestore
          await deleteDoc(doc(db, 'files', file.id))
            .catch(error => handleFirestoreError(error, OperationType.DELETE, `files/${file.id}`));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          setStatus({ type: 'success', message: 'File removed from database' });
          setTimeout(() => setStatus(null), 3000);
        }
      }
    });
  };

  const deleteMessage = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Message',
      message: 'Are you sure you want to delete this message?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'messages', id))
            .catch(error => handleFirestoreError(error, OperationType.DELETE, `messages/${id}`));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          setStatus({ type: 'success', message: 'Message deleted' });
          setTimeout(() => setStatus(null), 3000);
        } catch (error) {
          console.error(error);
          setStatus({ type: 'error', message: 'Failed to delete message' });
        }
      }
    });
  };

  const toggleMessageRead = async (id: string, currentRead: boolean) => {
    try {
      await updateDoc(doc(db, 'messages', id), { read: !currentRead })
        .catch(error => handleFirestoreError(error, OperationType.UPDATE, `messages/${id}`));
    } catch (error) {
      console.error(error);
    }
  };

  const toggleAdminHealthAccess = async (userId: string, currentAccess: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { canViewAdminHealth: !currentAccess })
        .catch(error => handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`));
      setStatus({ type: 'success', message: `Admin health access ${!currentAccess ? 'granted' : 'revoked'}` });
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: 'Failed to update user' });
    }
  };

  const toggleApproval = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { approved: !currentStatus })
        .catch(error => handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`));
      setStatus({ type: 'success', message: `User ${!currentStatus ? 'approved' : 'unapproved'}` });
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: 'Failed to update user' });
    }
  };

  const toggleKiaplayAccess = async (userId: string, currentAccess: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { hasKiaplayAccess: !currentAccess })
        .catch(error => handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`));
      setStatus({ type: 'success', message: `KIAPLAY access ${!currentAccess ? 'granted' : 'revoked'}` });
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: 'Failed to update user' });
    }
  };

  const handleMeetingStatus = async (userId: string, meetingId: string, status: 'accepted' | 'rejected') => {
    try {
      const userPageRef = doc(db, 'user_pages', userId);
      const userPageDoc = await getDocFromServer(userPageRef);
      if (userPageDoc.exists()) {
        const data = userPageDoc.data();
        const newList = data.meetings.map((m: any) => 
          m.id === meetingId ? { ...m, status, updatedAt: new Date().toISOString() } : m
        );
        await updateDoc(userPageRef, {
          meetings: newList,
          updatedAt: serverTimestamp()
        });
        setStatus({ type: 'success', message: `Meeting ${status} successfully.` });
        setTimeout(() => setStatus(null), 3000);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `user_pages/${userId}`);
      setStatus({ type: 'error', message: 'Failed to update meeting status.' });
    }
  };

  const handleRemoveMeeting = async (userId: string, meetingId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Meeting',
      message: 'Are you sure you want to delete this meeting suggestion?',
      onConfirm: async () => {
        try {
          const userPageRef = doc(db, 'user_pages', userId);
          const userPageDoc = await getDocFromServer(userPageRef);
          if (userPageDoc.exists()) {
            const data = userPageDoc.data();
            const newList = data.meetings.filter((m: any) => m.id !== meetingId);
            await updateDoc(userPageRef, {
              meetings: newList,
              updatedAt: serverTimestamp()
            });
            setStatus({ type: 'success', message: 'Meeting deleted successfully.' });
            setTimeout(() => setStatus(null), 3000);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `user_pages/${userId}`);
          setStatus({ type: 'error', message: 'Failed to delete meeting.' });
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const deleteUser = async (userId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete User',
      message: 'Are you sure you want to delete this user? This will remove their account data from the database.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', userId))
            .catch(error => handleFirestoreError(error, OperationType.DELETE, `users/${userId}`));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          setStatus({ type: 'success', message: 'User deleted' });
          setTimeout(() => setStatus(null), 3000);
        } catch (error) {
          console.error(error);
          setStatus({ type: 'error', message: 'Failed to delete user' });
        }
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setStatus({ type: 'success', message: 'URL copied to clipboard' });
    setTimeout(() => setStatus(null), 2000);
  };

  const resetBlogForm = () => {
    setIsEditingBlogPost(null);
    setBlogFormData({
      title: '',
      slug: '',
      content: '',
      excerpt: '',
      author: profile.name,
      imageUrl: '',
      tags: [],
      status: 'draft'
    });
  };

  const triggerGitHubAction = async () => {
    if (!profile.githubToken || !profile.githubRepo) return;
    try {
      setStatus({ type: 'info', message: 'Triggering GitHub Action build...' });
      const cleanRepo = profile.githubRepo.replace(/\/$/, '').trim();
      const [owner, repo] = cleanRepo.split('/');
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/deploy.yml/dispatches`, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${profile.githubToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ref: 'main' })
      });
      if (res.ok) {
        setStatus({ type: 'success', message: 'GitHub Action triggered successfully. Site will update in ~2 minutes.' });
      } else {
        const errorText = await res.text();
        setStatus({ type: 'error', message: `GitHub Action failed: ${errorText}` });
      }
    } catch (error) {
      console.error('Error triggering GitHub action:', error);
      setStatus({ type: 'error', message: 'Failed to trigger GitHub Action' });
    }
  };

  const handleSaveBlogPost = async () => {
    if (!blogFormData.title || !blogFormData.slug || !blogFormData.content) {
      setStatus({ type: 'error', message: 'Title, Slug, and Content are required.' });
      return;
    }

    try {
      const data = {
        ...blogFormData,
        updatedAt: serverTimestamp(),
        publishedAt: blogFormData.status === 'published' ? (blogFormData.publishedAt || serverTimestamp()) : null
      };

      if (isEditingBlogPost && isEditingBlogPost !== 'new') {
        await updateDoc(doc(db, 'blog_posts', isEditingBlogPost), data);
        setStatus({ type: 'success', message: 'Blog post updated successfully' });
      } else {
        await addDoc(collection(db, 'blog_posts'), {
          ...data,
          createdAt: serverTimestamp()
        });
        setStatus({ type: 'success', message: 'Blog post published successfully' });
      }
      resetBlogForm();
      if (blogFormData.status === 'published' && profile.githubToken && profile.githubRepo) {
        await triggerGitHubAction();
      }
    } catch (error) {
      handleFirestoreError(error, isEditingBlogPost ? OperationType.UPDATE : OperationType.CREATE, isEditingBlogPost ? `blog_posts/${isEditingBlogPost}` : 'blog_posts');
      setStatus({ type: 'error', message: 'Failed to save blog post' });
    }
  };

  const handleDeleteBlogPost = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Blog Post',
      message: 'Are you sure you want to permanently delete this blog post? This action cannot be undone.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'blog_posts', id));
          setStatus({ type: 'success', message: 'Blog post deleted successfully' });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `blog_posts/${id}`);
          setStatus({ type: 'error', message: 'Failed to delete blog post' });
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const sortedFiles = [...files].sort((a, b) => {
    switch (fileSortOption) {
      case 'newest':
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      case 'oldest':
        return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'size-asc':
        return a.size - b.size;
      case 'size-desc':
        return b.size - a.size;
      default:
        return 0;
    }
  });

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-40 text-center">
        <h1 className="text-4xl font-serif mb-8">Admin Access</h1>
        <p className="text-ink/60 mb-12 max-w-md mx-auto">Please log in with your authorized Google account to manage recommendations.</p>
        <Button
          onClick={async () => {
            try {
              await signInWithPopup(auth, googleProvider);
            } catch (error: any) {
              console.error("Login Error:", error);
              if (error.code === 'auth/unauthorized-domain') {
                setStatus({ 
                  type: 'error', 
                  message: 'This domain (solheim.online) is not authorized in Firebase Console. Please add it to "Authorized domains" in Authentication settings.' 
                });
              } else {
                setStatus({ type: 'error', message: error.message || 'Login failed' });
              }
              setTimeout(() => setStatus(null), 10000);
            }
          }}
          variant="primary"
          size="lg"
          icon={LogIn}
          magnetic={true}
          className="mb-8"
        >
          Login with Google
        </Button>

        {status && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`max-w-md mx-auto flex items-center space-x-2 px-6 py-3 rounded-full text-xs uppercase tracking-widest ${
              status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' : 
              status.type === 'info' ? 'bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' :
              'bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
            }`}
          >
            {status.type === 'success' ? <CheckCircle2 size={16} /> : 
             status.type === 'info' ? <Loader2 size={16} className="animate-spin" /> :
             <AlertCircle size={16} />}
            <span>{status.message}</span>
          </motion.div>
        )}
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-40 text-center">
        <AlertCircle size={48} className="mx-auto text-accent mb-6" />
        <h1 className="text-4xl font-serif mb-4">Unauthorized</h1>
        <p className="text-ink/60">You do not have permission to access the admin dashboard.</p>
      </div>
    );
  }

  const searchWikimedia = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!wikimediaSearch.trim()) return;
    
    setIsSearchingWikimedia(true);
    try {
      const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(wikimediaSearch)}&gsrnamespace=6&gsrlimit=20&prop=imageinfo|info&iiprop=url|extmetadata&iiurlwidth=500&format=json&origin=*`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.query?.pages) {
        const results = Object.values(data.query.pages).map((page: any) => {
          const imageinfo = page.imageinfo?.[0] || {};
          const extmeta = imageinfo.extmetadata || {};
          return {
            id: page.pageid,
            title: page.title.replace('File:', ''),
            url: imageinfo.url,
            thumburl: imageinfo.thumburl || imageinfo.url,
            credit: extmeta.Artist?.value || '',
            descriptionUrl: imageinfo.descriptionurl || page.canonicalurl || page.fullurl,
            attribution: extmeta.LicenseShortName?.value || ''
          };
        }).filter((p: any) => !!p.url);
        setWikimediaResults(results);
      } else {
        setWikimediaResults([]);
      }
    } catch (error) {
      console.error("Wikimedia search failed:", error);
      setStatus({ type: 'error', message: 'Failed to search Wikimedia.' });
    } finally {
      setIsSearchingWikimedia(false);
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (messageFilter === 'unread') return !msg.read;
    if (messageFilter === 'read') return msg.read;
    return true;
  });

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
      {/* Status Notifications */}
      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[150] w-full max-w-md px-4"
          >
            <div className={`flex items-center space-x-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-md ${
              status.type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400' : 
              status.type === 'info' ? 'bg-blue-500/90 text-white border-blue-400' :
              'bg-red-500/90 text-white border-red-400'
            }`}>
              {status.type === 'success' ? <CheckCircle2 size={20} /> : 
               status.type === 'info' ? <Loader2 size={20} className="animate-spin" /> :
               <AlertCircle size={20} />}
              <span className="text-[11px] uppercase tracking-widest font-black flex-grow">{status.message}</span>
              <button onClick={() => setStatus(null)} className="opacity-50 hover:opacity-100 transition-opacity">
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row gap-12">
        {/* Navigation Sidebar */}
        <aside className="lg:w-80 flex-shrink-0">
          <div className="lg:sticky lg:top-32 space-y-8">
            <div className="hidden lg:block">
              <h1 className="text-4xl font-serif tracking-tight mb-2">Admin</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-ink/30">Dashboard Control</p>
            </div>

            {/* Mobile Select Menu */}
            <div className="lg:hidden w-full mb-8">
              <div className="text-center mb-6">
                <h1 className="text-3xl font-serif tracking-tight mb-1">Admin Dashboard</h1>
                <p className="text-[9px] uppercase tracking-[0.2em] font-black text-ink/30">Manage your digital presence</p>
              </div>
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as any)}
                className="w-full bg-surface border border-ink/10 rounded-2xl px-6 py-4 text-[10px] uppercase tracking-widest font-black text-ink outline-none focus:border-accent ring-accent/20 transition-all appearance-none [color-scheme:dark]"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.5rem center', backgroundSize: '1.2rem' }}
              >
                {[
                  { id: 'oversikt', label: 'Oversikt' },
                  { id: 'recommendations', label: 'Recommendations' },
                  { id: 'cv', label: 'CV Editor' },
                  { id: 'socials', label: 'Socials' },
                  { id: 'files', label: 'Files' },
                  { id: 'messages', label: 'Messages', count: messages.filter(m => !m.read).length },
                  { id: 'meetings', label: 'Meetings', count: allMeetings.filter(m => m.status === 'pending').length },
                  { id: 'expenses', label: 'Expenses' },
                  { id: 'memberships', label: 'Memberships' },
                  { id: 'measured-words', label: 'Measured Words' },
                  { id: 'writings', label: 'Writings Editor' },
                  { id: 'integrations', label: 'Integrations' },
                  { id: 'users', label: 'Users' }
                ].map((tab) => (
                  <option key={tab.id} value={tab.id} className="bg-surface text-ink">
                    {tab.label} {tab.count ? `(${tab.count})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Desktop Sidebar Nav */}
            <nav className="hidden lg:flex flex-col gap-1.5 p-3 bg-paper border border-ink/5 rounded-[40px] shadow-inner relative group">
              <div className="absolute inset-0 bg-accent/[0.02] rounded-[40px] pointer-events-none" />
              {[
                { id: 'oversikt', label: 'Oversikt', icon: Activity },
                { id: 'recommendations', label: 'Recommendations', icon: BookIcon },
                { id: 'cv', label: 'CV Editor', icon: User },
                { id: 'socials', label: 'Socials', icon: Share2 },
                { id: 'files', label: 'File Library', icon: ImageIcon },
                { id: 'messages', label: 'Messages', icon: Mail, count: messages.filter(m => !m.read).length },
                { id: 'meetings', label: 'Meetings', icon: CalendarIcon, count: allMeetings.filter(m => m.status === 'pending').length },
                { id: 'expenses', label: 'Expenses', icon: ArrowUpDown },
                { id: 'memberships', label: 'Memberships', icon: Users },
                { id: 'measured-words', label: 'Measured Words', icon: Edit2 },
                { id: 'integrations', label: 'Integrations', icon: RefreshCcw },
                { id: 'writings', label: 'Writings Editor', icon: BookOpen },
                { id: 'users', label: 'User Directory', icon: User }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full group flex items-center justify-between px-6 py-4 rounded-3xl text-[10px] uppercase tracking-widest transition-all font-black relative overflow-hidden ${
                    activeTab === tab.id 
                      ? 'bg-ink text-paper shadow-xl shadow-ink/20' 
                      : 'text-ink/40 hover:text-ink hover:bg-ink/5'
                  }`}
                >
                  <div className="flex items-center space-x-4 relative z-10">
                    <tab.icon size={18} className={`transition-transform group-hover:scale-110 ${activeTab === tab.id ? 'text-accent' : 'text-current opacity-40'}`} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.count ? (
                    <span className={`relative z-10 px-2 py-0.5 rounded-full text-[8px] animate-pulse ${
                      activeTab === tab.id ? 'bg-accent text-paper' : 'bg-accent/10 text-accent'
                    }`}>
                      {tab.count}
                    </span>
                  ) : null}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="nav-bg"
                      className="absolute inset-0 bg-ink"
                      initial={false}
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              ))}
            </nav>

            {/* Quick Stats Overlay (Optional Decoration) */}
            <div className="hidden lg:block p-8 bg-accent/5 border border-accent/10 rounded-[40px] group hover:bg-accent/10 transition-colors duration-500">
              <p className="text-[8px] uppercase tracking-[0.3em] text-accent font-black mb-4">Storage Used</p>
              <div className="h-1.5 w-full bg-accent/10 rounded-full overflow-hidden mb-2">
                 <div className="h-full bg-accent w-1/3 rounded-full" />
              </div>
              <p className="text-[7px] text-accent/40 font-black uppercase tracking-widest">342 MB / 5 GB (Spark Plan)</p>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-grow min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {activeTab === 'oversikt' ? (
                <div className="space-y-12 max-w-7xl mx-auto">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 px-4">
                    <div>
                      <h2 className="text-4xl font-serif mb-2">Metrics Overview</h2>
                      <p className="text-[10px] uppercase tracking-[0.2em] font-black text-ink/40">Page views and time spent</p>
                    </div>
                  </div>

                  <div className="bg-surface rounded-[48px] border border-ink/5 shadow-sm p-8 md:p-12 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-ink/5">
                            <th className="pb-4 text-[10px] uppercase tracking-widest font-black text-ink/40">Page Path</th>
                            <th className="pb-4 text-[10px] uppercase tracking-widest font-black text-ink/40 text-right">Accumulated Views</th>
                            <th className="pb-4 text-[10px] uppercase tracking-widest font-black text-ink/40 text-right">Summarized Duration</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ink/5">
                          {pageStats.map(stat => {
                            const minutes = Math.floor(stat.durationSeconds / 60);
                            const seconds = stat.durationSeconds % 60;
                            const durationString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                            return (
                              <tr key={stat.id} className="group hover:bg-ink/5 transition-colors">
                                <td className="py-4 font-mono text-sm group-hover:text-accent transition-colors">{stat.path}</td>
                                <td className="py-4 text-right font-medium">{stat.views.toLocaleString()}</td>
                                <td className="py-4 text-right text-ink/60">{durationString}</td>
                              </tr>
                            );
                          })}
                          {pageStats.length === 0 && (
                            <tr>
                              <td colSpan={3} className="py-12 text-center text-ink/40 italic">
                                No visitor stats tracked yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'recommendations' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-16">
          {/* Left Column: Search & Form */}
          <div className="lg:col-span-1 space-y-8">
            {/* Search Section */}
            <div className="bg-surface p-6 md:p-8 rounded-[32px] border border-ink/5 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-accent/10 transition-colors duration-700" />
              
              <h2 className="text-xl font-serif mb-6 flex items-center relative z-10">
                <div className="p-2 bg-accent/10 rounded-xl mr-3 text-accent">
                  <Search size={18} />
                </div>
                Search & Import
              </h2>
              
                <div className="flex flex-wrap gap-2 mb-6 relative z-10">
                  {[
                    { id: 'Books', label: 'Books' },
                    { id: 'Movies & Shows', label: 'Movies' },
                    { id: 'Video & Media', label: 'Media' },
                    { id: 'Apps', label: 'Apps' }
                  ].map((type) => (
                    <Button
                      key={type.id}
                      onClick={() => setSearchType(type.id as any)}
                      variant={searchType === type.id ? 'primary' : 'outline'}
                      size="sm"
                      className={`flex-1 min-w-[80px] rounded-xl transition-all font-black ${
                        searchType === type.id ? 'shadow-md shadow-accent/10' : 'text-ink/40 border-ink/10'
                      }`}
                      magnetic={true}
                    >
                      {type.label}
                    </Button>
                  ))}
                </div>
              
              <form onSubmit={handleSearch} className="relative mb-6 z-10">
                <input
                  type="text"
                  placeholder={searchType === 'Books' ? "Search for books or ISBN..." : `Search for ${searchType.toLowerCase()}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-5 pr-12 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all placeholder:text-ink/20"
                />
                <Button
                  type="submit"
                  disabled={isSearching}
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-accent hover:bg-accent/10 rounded-xl transition-all disabled:opacity-50 p-0"
                  magnetic={false}
                >
                  {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                </Button>
              </form>

              <AnimatePresence>
                {searchResults.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar"
                  >
                    {searchResults.map((result, idx) => (
                      <div
                        key={idx}
                        onClick={() => importResult(result)}
                        className="flex items-center space-x-4 p-3 rounded-xl border border-ink/5 hover:border-accent/30 hover:bg-accent/5 cursor-pointer transition-all group"
                      >
                        <div className="w-12 h-16 bg-ink/5 rounded overflow-hidden flex-shrink-0">
                          <img src={result.imageUrl} alt="" className="w-full h-full object-cover grayscale group-hover:grayscale-0" referrerPolicy="no-referrer" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-serif truncate">{result.title}</h4>
                          <p className="text-[10px] uppercase tracking-widest text-ink/40 truncate">{result.author}</p>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                ) : searchQuery && !isSearching && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-4 text-ink/40 text-xs uppercase tracking-widest"
                  >
                    No results found
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Manual Form */}
            <div className="bg-surface p-8 rounded-[32px] border border-ink/5 shadow-sm relative overflow-hidden">
              <h2 className="text-xl font-serif mb-8 flex items-center">
                <div className="p-2 bg-accent/10 rounded-xl mr-3 text-accent">
                  <Plus size={18} />
                </div>
                {isEditing ? 'Edit Entry' : 'Manual Entry'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">Title</label>
                    <div className="flex gap-2">
                      <input
                        required
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && formData.category === 'Movies & Shows' && (e.preventDefault(), handleSearchMovies())}
                        className="flex-grow px-5 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all"
                        placeholder="Enter title..."
                      />
                      {formData.category === 'Movies & Shows' && (
                        <Button
                          type="button"
                          onClick={handleSearchMovies}
                          isLoading={isSearchingMovies}
                          variant="outline"
                          className="px-6 border-accent/20 text-accent hover:bg-accent/5 rounded-2xl"
                          icon={Search}
                        >
                          Search
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {formData.category === 'Movies & Shows' && movieSearchResults.length > 0 && (
                    <div className="space-y-3 p-4 bg-accent/5 rounded-3xl border border-accent/10">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase tracking-widest text-accent font-black">Select Movie Poster</label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setMovieSearchResults([])}
                          className="text-accent/40 hover:text-accent"
                          icon={X}
                        />
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-60 overflow-y-auto p-2 custom-scrollbar">
                        {movieSearchResults.map((result, idx) => {
                          const posterUrl = result.Poster !== 'N/A' ? result.Poster : '';
                          const isSelected = formData.imageUrl === posterUrl;
                          if (!posterUrl) return null;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setFormData({ 
                                ...formData, 
                                imageUrl: posterUrl,
                                title: result.Title || formData.title,
                                author: result.Year || formData.author,
                                link: `https://www.imdb.com/title/${result.imdbID}`
                              })}
                              className={`relative aspect-[2/3] rounded-xl overflow-hidden border-2 transition-all ${
                                isSelected ? 'border-accent ring-4 ring-accent/10 scale-95' : 'border-transparent hover:border-accent/30'
                              }`}
                            >
                              <img src={posterUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              {isSelected && (
                                <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                                  <div className="bg-accent text-white p-1.5 rounded-full shadow-lg">
                                    <Check size={14} />
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">Author / Creator</label>
                    <input
                      required
                      type="text"
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      className="w-full px-5 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all"
                      placeholder="Enter author..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">Category</label>
                    <div className="relative">
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                        className="w-full px-5 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all appearance-none cursor-pointer"
                      >
                        <option value="Books">Books</option>
                        <option value="Movies & Shows">Movies & Shows</option>
                        <option value="Video & Media">Video & Media</option>
                        <option value="Apps">Apps</option>
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-ink/20">
                        <ArrowUpDown size={14} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">Image URL</label>
                    <div className="relative">
                      <input
                        type="url"
                        value={formData.imageUrl}
                        onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                        className="w-full px-5 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all pr-12"
                        placeholder="https://..."
                      />
                      <Button
                        type="button"
                        onClick={() => setFilePicker({
                          isOpen: true,
                          onSelect: (url) => setFormData({ ...formData, imageUrl: url })
                        })}
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-ink/20 hover:text-accent transition-colors p-0"
                        title="Select from File Explorer"
                        magnetic={false}
                        icon={ImageIcon}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">Description</label>
                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-5 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all resize-none"
                    placeholder="Enter description..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">External Link</label>
                  <div className="flex space-x-3">
                    <input
                      type="url"
                      value={formData.link}
                      onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                      className="flex-grow px-5 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all"
                      placeholder="https://..."
                    />
                    {(formData.link?.includes('youtube.com') || formData.link?.includes('youtu.be')) && (
                      <Button
                        type="button"
                        onClick={fetchYouTubeData}
                        disabled={isFetchingYouTube}
                        variant="outline"
                        size="sm"
                        className="px-5 bg-accent/5 text-accent border border-accent/20 rounded-2xl hover:bg-accent hover:text-white transition-all disabled:opacity-50"
                        title="Fetch YouTube Info"
                        magnetic={true}
                        icon={isFetchingYouTube ? Loader2 : RefreshCcw}
                      />
                    )}
                  </div>
                </div>

                <div className="flex space-x-4 pt-6">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    icon={Save}
                    magnetic={true}
                    className="flex-grow shadow-xl shadow-accent/20"
                  >
                    {isEditing ? 'Update Entry' : 'Add to Portfolio'}
                  </Button>
                  {isEditing && (
                    <Button
                      type="button"
                      onClick={() => {
                        setIsEditing(null);
                        setFormData({ title: '', author: '', category: 'Books', description: '', link: '', imageUrl: '' });
                      }}
                      variant="outline"
                      size="lg"
                      icon={X}
                      magnetic={true}
                      className="p-4 border-ink/10 text-ink/40 hover:text-accent hover:border-accent transition-all rounded-2xl"
                    />
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: List */}
          <div className="lg:col-span-2">
            <div className="space-y-6">
              {recommendations.map((rec) => (
                <motion.div
                  key={rec.id}
                  layout
                  className="bg-surface p-5 md:p-8 rounded-[32px] border border-ink/5 flex flex-col sm:flex-row sm:items-center justify-between gap-6 group hover:border-accent/20 hover:shadow-xl hover:shadow-accent/5 transition-all duration-500"
                >
                  <div className="flex items-center space-x-6">
                    <div className="w-16 h-16 md:w-24 md:h-24 rounded-2xl overflow-hidden bg-ink/[0.03] border border-ink/5 flex-shrink-0 p-1">
                      <img
                        src={rec.imageUrl || `https://picsum.photos/seed/${rec.id}/200/200`}
                        alt={rec.title}
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 rounded-xl"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 bg-accent/5 text-accent text-[8px] uppercase tracking-widest font-black rounded-md border border-accent/10">
                          {rec.category}
                        </span>
                      </div>
                      <h3 className="text-xl md:text-2xl font-serif text-ink/90 group-hover:text-accent transition-colors duration-500 truncate">{rec.title}</h3>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black truncate">{rec.author}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end space-x-3">
                    <Button
                      onClick={() => handleEdit(rec)}
                      variant="ghost"
                      size="sm"
                      icon={Edit2}
                      magnetic={true}
                      className="p-4 text-ink/20 hover:text-accent hover:bg-accent/5 rounded-2xl transition-all"
                    />
                    <Button
                      onClick={() => handleDelete(rec.id)}
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      magnetic={true}
                      className="p-4 text-ink/20 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                    />
                  </div>
                </motion.div>
              ))}
              {recommendations.length === 0 && (
                <div className="text-center py-32 border-2 border-dashed border-ink/5 rounded-[48px] bg-ink/[0.01]">
                  <div className="p-4 bg-ink/5 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6 text-ink/20">
                    <BookIcon size={32} />
                  </div>
                  <p className="text-ink/30 text-xs uppercase tracking-[0.3em] font-black">No recommendations yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'cv' ? (
        <div className="space-y-12">
          {/* Profile Editor */}
          <div className="bg-surface p-8 md:p-12 rounded-[48px] border border-ink/5 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full -mr-32 -mt-32 blur-[100px] group-hover:bg-accent/10 transition-colors duration-1000" />
            
            <div className="flex items-center justify-between mb-12 relative z-10">
              <div>
                <h2 className="text-3xl font-serif mb-2">Sidebar Information</h2>
                <p className="text-ink/40 text-[10px] uppercase tracking-[0.2em] font-black">Your public identity</p>
              </div>
              <div className="p-4 bg-accent/10 rounded-2xl text-accent">
                <User size={32} />
              </div>
            </div>

            <form onSubmit={updateProfile} className="space-y-8 relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">Full Name</label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full px-6 py-4 bg-paper border border-ink/10 rounded-2xl text-lg font-serif focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all"
                    placeholder="Your Name"
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">Role / Title</label>
                  <input
                    type="text"
                    value={profile.role}
                    onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                    className="w-full px-6 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all"
                    placeholder="e.g. Creative Developer"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">Email</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full px-6 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all"
                    placeholder="hello@example.com"
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">Location</label>
                  <input
                    type="text"
                    value={profile.location}
                    onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                    className="w-full px-6 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all"
                    placeholder="e.g. Oslo, Norway"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">Phone (General)</label>
                  <input
                    type="text"
                    value={profile.phone || ''}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full px-6 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all"
                    placeholder="+47 ..."
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">Mobile</label>
                  <input
                    type="text"
                    value={profile.mobile || ''}
                    onChange={(e) => setProfile({ ...profile, mobile: e.target.value })}
                    className="w-full px-6 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all"
                    placeholder="+47 ..."
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">Landline</label>
                  <input
                    type="text"
                    value={profile.landline || ''}
                    onChange={(e) => setProfile({ ...profile, landline: e.target.value })}
                    className="w-full px-6 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all"
                    placeholder="+47 ..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">Website</label>
                  <input
                    type="text"
                    value={profile.website}
                    onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                    className="w-full px-6 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all"
                    placeholder="https://yourwebsite.com"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">Visiting Card Access Key</label>
                    {profile.visitingCardKey && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`${window.location.origin}/visiting-card?key=${profile.visitingCardKey}`)}
                        className="text-[10px] uppercase tracking-widest text-accent hover:underline flex items-center gap-1 font-bold"
                      >
                        <Copy size={12} />
                        Copy Link
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={profile.visitingCardKey || ''}
                      onChange={(e) => setProfile({ ...profile, visitingCardKey: e.target.value.trim() })}
                      className="w-full px-6 py-4 bg-paper border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all"
                      placeholder="e.g. secret-key"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] uppercase tracking-widest text-ink/20 font-bold">
                      ?key={profile.visitingCardKey || '...'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  icon={Save}
                  magnetic={true}
                  className="px-12 py-4 shadow-xl shadow-accent/20"
                >
                  Save Profile
                </Button>
              </div>
            </form>
          </div>

          {/* CV Sections Editor */}
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4">
              <div>
                <h2 className="text-3xl font-serif mb-2">Curriculum Vitae</h2>
                <p className="text-ink/40 text-[10px] uppercase tracking-[0.2em] font-black">Manage your professional journey</p>
              </div>
            </div>

            <div className="space-y-12">
              {CV_CATEGORIES.map((category) => {
                const section = cvSections.find(s => s.title === category.title);
                const Icon = category.icon;

                return (
                  <div key={category.title} className="bg-surface rounded-[48px] border border-ink/5 shadow-sm overflow-hidden group hover:border-accent/10 transition-all duration-500">
                    <div className="p-8 md:p-12 flex flex-col sm:flex-row sm:items-center justify-between gap-8 bg-ink/[0.01] border-b border-ink/5">
                      <div className="flex items-center space-x-6">
                        <div className="p-4 bg-accent/10 rounded-2xl text-accent">
                          <Icon size={32} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-serif text-ink/80 group-hover:text-accent transition-colors">{category.title}</h3>
                          <p className="text-[10px] uppercase tracking-widest text-ink/30 font-black">
                            {section ? `${section.items.length} Items` : 'Not Initialized'}
                          </p>
                        </div>
                      </div>
                      
                      {!section && (
                        <Button
                          onClick={() => addCVSection(category.title)}
                          variant="primary"
                          size="lg"
                          icon={Plus}
                          magnetic={true}
                          className="px-8 py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-accent/20"
                        >
                          Initialize Section
                        </Button>
                      )}

                      {section && (
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center bg-paper border border-ink/10 rounded-xl px-4 py-2">
                            <span className="text-[10px] uppercase tracking-widest text-ink/30 font-black mr-3">Order</span>
                            <input
                              type="number"
                              className="w-10 text-center text-xs font-black bg-transparent focus:outline-none"
                              value={section.order}
                              onChange={(e) => updateCVSection(section.id, { order: parseInt(e.target.value) })}
                            />
                          </div>
                          <Button
                            onClick={() => deleteCVSection(section.id)}
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            magnetic={true}
                            className="p-4 text-ink/20 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                            title="Delete Section"
                          />
                        </div>
                      )}
                    </div>

                    {section ? (
                      <div className="p-8 md:p-12 space-y-12">
                        {section.items.map((item, idx) => (
                          <div key={idx} className="p-8 bg-paper/50 rounded-[32px] border border-ink/5 relative group/item space-y-8 hover:border-accent/20 hover:shadow-xl hover:shadow-accent/5 transition-all duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="space-y-6">
                                <div className="space-y-2">
                                  <label className="block text-[9px] uppercase tracking-widest text-ink/30 font-black">Title / Role</label>
                                  <input
                                    placeholder="e.g. Senior Developer"
                                    className="w-full px-5 py-4 bg-paper border border-ink/10 rounded-2xl text-sm font-serif focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all"
                                    value={item.title}
                                    onChange={(e) => {
                                      const newItems = [...section.items];
                                      newItems[idx].title = e.target.value;
                                      updateCVSection(section.id, { items: newItems });
                                    }}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="block text-[9px] uppercase tracking-widest text-ink/30 font-black">Subtitle / Organization</label>
                                  <input
                                    placeholder="e.g. Google"
                                    className="w-full px-5 py-4 bg-paper border border-ink/10 rounded-2xl text-[10px] uppercase tracking-widest focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all font-black"
                                    value={item.subtitle}
                                    onChange={(e) => {
                                      const newItems = [...section.items];
                                      newItems[idx].subtitle = e.target.value;
                                      updateCVSection(section.id, { items: newItems });
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="space-y-6">
                                <div className="space-y-2">
                                  <label className="block text-[9px] uppercase tracking-widest text-ink/30 font-black">Date Range</label>
                                  <input
                                    placeholder="e.g. 2023 — Present"
                                    className="w-full px-5 py-4 bg-paper border border-ink/10 rounded-2xl text-[10px] uppercase tracking-widest focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all font-black"
                                    value={item.date}
                                    onChange={(e) => {
                                      const newItems = [...section.items];
                                      newItems[idx].date = e.target.value;
                                      updateCVSection(section.id, { items: newItems });
                                    }}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="block text-[9px] uppercase tracking-widest text-ink/30 font-black">External Link</label>
                                  <input
                                    placeholder="https://..."
                                    className="w-full px-5 py-4 bg-paper border border-ink/10 rounded-2xl text-[10px] uppercase tracking-widest focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all font-black"
                                    value={item.link || ''}
                                    onChange={(e) => {
                                      const newItems = [...section.items];
                                      newItems[idx].link = e.target.value;
                                      updateCVSection(section.id, { items: newItems });
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <label className="block text-[9px] uppercase tracking-widest text-ink/30 font-black">Logo / Icon</label>
                              <div className="flex items-center space-x-6">
                                <Button
                                  type="button"
                                  onClick={() => setFilePicker({
                                    isOpen: true,
                                    onSelect: (url) => {
                                      const newItems = [...section.items];
                                      newItems[idx].logoUrl = url;
                                      updateCVSection(section.id, { items: newItems });
                                    }
                                  })}
                                  variant="ghost"
                                  className="w-24 h-24 rounded-2xl border-2 border-dashed border-ink/10 flex flex-col items-center justify-center text-ink/20 hover:border-accent hover:text-accent transition-all overflow-hidden bg-paper group/logo"
                                  magnetic={true}
                                >
                                  {item.logoUrl ? (
                                    <img src={item.logoUrl} alt="Logo" className="w-full h-full object-contain p-4" referrerPolicy="no-referrer" />
                                  ) : (
                                    <>
                                      <ImageIcon size={24} />
                                      <span className="text-[9px] mt-2 font-black uppercase tracking-widest">Select</span>
                                    </>
                                  )}
                                </Button>
                                <div className="flex-grow">
                                  <input
                                    placeholder="Or paste Logo URL..."
                                    className="w-full px-5 py-4 bg-paper border border-ink/10 rounded-2xl text-[10px] uppercase tracking-widest focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all font-black"
                                    value={item.logoUrl || ''}
                                    onChange={(e) => {
                                      const newItems = [...section.items];
                                      newItems[idx].logoUrl = e.target.value;
                                      updateCVSection(section.id, { items: newItems });
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="block text-[9px] uppercase tracking-widest text-ink/30 font-black">Description (Markdown)</label>
                              <textarea
                                placeholder="Describe your achievements..."
                                rows={4}
                                className="w-full px-6 py-4 bg-paper border border-ink/10 rounded-2xl text-sm leading-relaxed focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all resize-none"
                                value={item.description}
                                onChange={(e) => {
                                  const newItems = [...section.items];
                                  newItems[idx].description = e.target.value;
                                  updateCVSection(section.id, { items: newItems });
                                }}
                              />
                            </div>

                            <Button
                              onClick={() => {
                                setConfirmModal({
                                  isOpen: true,
                                  title: 'Delete Item',
                                  message: `Are you sure you want to delete "${item.title || 'this item'}"?`,
                                  onConfirm: () => {
                                    const newItems = section.items.filter((_, i) => i !== idx);
                                    updateCVSection(section.id, { items: newItems });
                                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                  }
                                });
                              }}
                              variant="ghost"
                              size="sm"
                              icon={X}
                              magnetic={true}
                              className="absolute -top-3 -right-3 w-10 h-10 p-0 bg-paper border border-ink/10 rounded-full text-ink/20 hover:text-red-500 shadow-xl opacity-0 group-hover/item:opacity-100 transition-all"
                            />
                          </div>
                        ))}
                        <Button
                          onClick={() => {
                            const newItems = [...section.items, { title: '', subtitle: '', date: '', description: '', link: '', logoUrl: '' }];
                            updateCVSection(section.id, { items: newItems });
                          }}
                          variant="outline"
                          className="w-full py-8 border-2 border-dashed border-ink/10 rounded-[32px] text-[10px] uppercase tracking-[0.3em] text-ink/40 hover:border-accent hover:text-accent transition-all font-black bg-ink/[0.01]"
                          magnetic={true}
                        >
                          + Add Item to {category.title}
                        </Button>
                      </div>
                    ) : (
                      <div className="py-20 text-center border-2 border-dashed border-ink/5 rounded-[48px] bg-ink/[0.01] m-8">
                        <p className="text-ink/30 text-[10px] uppercase tracking-[0.3em] font-black">This section has not been initialized yet.</p>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Custom Sections */}
              {cvSections.filter(s => !CV_CATEGORIES.some(cat => cat.title === s.title)).length > 0 && (
                <div className="pt-12 border-t border-ink/5">
                  <h3 className="text-lg font-serif mb-6 text-ink/40">Other Sections</h3>
                  <div className="space-y-12">
                    {cvSections.filter(s => !CV_CATEGORIES.some(cat => cat.title === s.title)).map((section) => (
                      <div key={section.id} className="bg-surface p-6 md:p-8 rounded-3xl border border-ink/5 shadow-sm space-y-8 opacity-60 hover:opacity-100 transition-opacity">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink/5 pb-4">
                          <input
                            className="text-xl font-serif bg-transparent border-none focus:outline-none focus:text-accent transition-colors w-full"
                            value={section.title}
                            onChange={(e) => updateCVSection(section.id, { title: e.target.value })}
                          />
                          <div className="flex items-center justify-between sm:justify-end space-x-4 w-full sm:w-auto">
                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] uppercase tracking-widest text-ink/40">Order:</span>
                              <input
                                type="number"
                                className="w-12 text-center text-xs border border-ink/10 rounded p-1"
                                value={section.order}
                                onChange={(e) => updateCVSection(section.id, { order: parseInt(e.target.value) })}
                              />
                            </div>
                            <Button
                              onClick={() => deleteCVSection(section.id)}
                              variant="ghost"
                              size="sm"
                              icon={Trash2}
                              magnetic={true}
                              className="p-2 text-ink/20 hover:text-red-500 transition-colors"
                            />
                          </div>
                        </div>
                        {/* ... existing items rendering for custom sections ... */}
                        <div className="space-y-8">
                          {section.items.map((item, idx) => (
                            <div key={idx} className="p-4 md:p-6 bg-paper rounded-2xl relative group space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-4">
                                  <input
                                    placeholder="Item Title"
                                    className="w-full bg-transparent border-b border-ink/5 text-sm font-serif focus:outline-none focus:border-accent"
                                    value={item.title}
                                    onChange={(e) => {
                                      const newItems = [...section.items];
                                      newItems[idx].title = e.target.value;
                                      updateCVSection(section.id, { items: newItems });
                                    }}
                                  />
                                  <input
                                    placeholder="Subtitle"
                                    className="w-full bg-transparent border-b border-ink/5 text-[10px] uppercase tracking-widest focus:outline-none focus:border-accent"
                                    value={item.subtitle}
                                    onChange={(e) => {
                                      const newItems = [...section.items];
                                      newItems[idx].subtitle = e.target.value;
                                      updateCVSection(section.id, { items: newItems });
                                    }}
                                  />
                                </div>
                                <div className="space-y-4">
                                  <input
                                    placeholder="Date"
                                    className="w-full bg-transparent border-b border-ink/5 text-[10px] uppercase tracking-widest focus:outline-none focus:border-accent"
                                    value={item.date}
                                    onChange={(e) => {
                                      const newItems = [...section.items];
                                      newItems[idx].date = e.target.value;
                                      updateCVSection(section.id, { items: newItems });
                                    }}
                                  />
                                  <input
                                    placeholder="External Link (Optional)"
                                    className="w-full bg-transparent border-b border-ink/5 text-[10px] uppercase tracking-widest focus:outline-none focus:border-accent"
                                    value={item.link || ''}
                                    onChange={(e) => {
                                      const newItems = [...section.items];
                                      newItems[idx].link = e.target.value;
                                      updateCVSection(section.id, { items: newItems });
                                    }}
                                  />
                                  <div className="space-y-2">
                                    <label className="block text-[9px] uppercase tracking-widest text-ink/40 font-bold">Logo / Icon</label>
                                    <div className="flex items-center space-x-4">
                                      <Button
                                        type="button"
                                        onClick={() => setFilePicker({
                                          isOpen: true,
                                          onSelect: (url) => {
                                            const newItems = [...section.items];
                                            newItems[idx].logoUrl = url;
                                            updateCVSection(section.id, { items: newItems });
                                          }
                                        })}
                                        variant="ghost"
                                        className="w-16 h-16 rounded-xl border-2 border-dashed border-ink/10 flex flex-col items-center justify-center text-ink/20 hover:border-accent hover:text-accent transition-all overflow-hidden bg-surface group/logo"
                                        magnetic={true}
                                      >
                                        {item.logoUrl ? (
                                          <img src={item.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                                        ) : (
                                          <>
                                            <ImageIcon size={20} />
                                            <span className="text-[8px] mt-1">Select</span>
                                          </>
                                        )}
                                      </Button>
                                      <div className="flex-grow">
                                        <input
                                          placeholder="Or paste Logo URL..."
                                          className="w-full bg-transparent border-b border-ink/5 text-[10px] uppercase tracking-widest focus:outline-none focus:border-accent"
                                          value={item.logoUrl || ''}
                                          onChange={(e) => {
                                            const newItems = [...section.items];
                                            newItems[idx].logoUrl = e.target.value;
                                            updateCVSection(section.id, { items: newItems });
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <textarea
                                placeholder="Description (Markdown supported)"
                                rows={3}
                                className="w-full bg-transparent border border-ink/5 p-3 rounded-xl text-xs leading-relaxed focus:outline-none focus:border-accent resize-none"
                                value={item.description}
                                onChange={(e) => {
                                  const newItems = [...section.items];
                                  newItems[idx].description = e.target.value;
                                  updateCVSection(section.id, { items: newItems });
                                }}
                              />
                              <Button
                                onClick={() => {
                                  setConfirmModal({
                                    isOpen: true,
                                    title: 'Delete Item',
                                    message: `Are you sure you want to delete "${item.title || 'this item'}"?`,
                                    onConfirm: () => {
                                      const newItems = section.items.filter((_, i) => i !== idx);
                                      updateCVSection(section.id, { items: newItems });
                                      setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                    }
                                  });
                                }}
                                variant="ghost"
                                size="sm"
                                icon={X}
                                magnetic={true}
                                className="absolute -top-2 -right-2 p-2 bg-surface border border-ink/5 rounded-full text-ink/20 hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                              />
                            </div>
                          ))}
                          <Button
                            onClick={() => {
                              const newItems = [...section.items, { title: '', subtitle: '', date: '', description: '', link: '', logoUrl: '' }];
                              updateCVSection(section.id, { items: newItems });
                            }}
                            variant="ghost"
                            className="w-full py-4 border border-dashed border-ink/10 rounded-2xl text-[10px] uppercase tracking-widest text-ink/40 hover:border-accent hover:text-accent transition-all"
                            magnetic={true}
                          >
                            + Add Item
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-8 border-t border-ink/5">
              <Button
                onClick={() => addCVSection()}
                variant="outline"
                size="sm"
                icon={Plus}
                magnetic={true}
                className="flex items-center space-x-2 px-6 py-3 border border-ink/10 text-ink/40 rounded-full text-[10px] uppercase tracking-widest hover:border-accent hover:text-accent transition-all"
              >
                Add Custom Section
              </Button>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'socials' ? (
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="bg-surface p-8 md:p-12 rounded-[48px] border border-ink/5 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full -mr-32 -mt-32 blur-[100px] group-hover:bg-accent/10 transition-colors duration-1000" />
            
            <div className="flex items-center justify-between mb-12 relative z-10">
              <div>
                <h2 className="text-3xl font-serif mb-2">Social Connections</h2>
                <p className="text-ink/40 text-[10px] uppercase tracking-[0.2em] font-black">Where to find you online</p>
              </div>
              <div className="p-4 bg-accent/10 rounded-2xl text-accent">
                <Share2 size={32} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              {socials.map((social) => (
                <SocialItemEditor
                  key={social.id}
                  social={social}
                  onUpdate={updateSocial}
                  onDelete={deleteSocial}
                />
              ))}
            </div>

            {socials.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-ink/5 rounded-[48px] bg-ink/[0.01] relative z-10">
                <p className="text-ink/30 text-[10px] uppercase tracking-[0.3em] font-black">No social links added yet.</p>
              </div>
            ) : (
              <div className="mt-12 flex justify-center relative z-10">
                <Button
                  onClick={addSocial}
                  variant="outline"
                  size="lg"
                  icon={Plus}
                  magnetic={true}
                  className="px-12 py-4 border-dashed border-2 border-ink/10 text-ink/40 hover:text-accent hover:border-accent transition-all rounded-2xl uppercase tracking-[0.2em] font-black text-[10px]"
                >
                  Add New Link
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'meetings' ? (
        <div className="space-y-12 max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 px-4">
            <div>
              <h2 className="text-4xl font-serif mb-2">Meeting Requests</h2>
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-ink/40">Manage user meeting suggestions</p>
            </div>
          </div>

          <div className="grid gap-8">
            {allMeetings.length === 0 ? (
              <div className="py-32 text-center border-2 border-dashed border-ink/5 rounded-[48px] bg-ink/[0.01]">
                <div className="p-6 bg-ink/5 rounded-3xl w-20 h-20 mx-auto mb-6 flex items-center justify-center text-ink/20">
                  <CalendarIcon size={40} />
                </div>
                <p className="text-ink/30 text-[10px] uppercase tracking-[0.3em] font-black">No meeting requests found.</p>
              </div>
            ) : (
              allMeetings.map((meeting, idx) => (
                <motion.div
                  key={`${meeting.id}-${idx}`}
                  layout
                  className="bg-surface p-8 md:p-10 rounded-[48px] border border-ink/5 hover:border-accent/20 hover:shadow-2xl hover:shadow-accent/5 transition-all duration-500 group relative overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 relative z-10">
                    <div className="flex items-center space-x-8">
                      <div className="p-5 rounded-[24px] bg-ink/[0.03] text-ink/40 group-hover:bg-accent/10 group-hover:text-accent transition-all duration-500">
                        <CalendarIcon size={32} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-serif mb-2 text-ink/80">{meeting.title}</h3>
                        <div className="flex flex-wrap items-center gap-4">
                          <span className="text-[10px] uppercase tracking-widest text-accent font-black">
                            {new Date(meeting.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                          <span className="text-[10px] uppercase tracking-widest text-ink/30 font-black">{meeting.userEmail}</span>
                          <span className={`text-[8px] uppercase tracking-[0.2em] px-3 py-1 rounded-full font-black ${
                            meeting.status === 'accepted' ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 
                            meeting.status === 'rejected' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 
                            'bg-yellow-500 text-white shadow-lg shadow-yellow-500/20'
                          }`}>
                            {meeting.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      {meeting.status === 'pending' ? (
                        meeting.suggestedBy === user.uid ? (
                          <span className="text-[10px] uppercase tracking-widest text-ink/30 font-bold italic">Awaiting user response</span>
                        ) : (
                          <>
                            <Button
                              onClick={() => handleMeetingStatus(meeting.userId, meeting.id, 'accepted')}
                              variant="ghost"
                              size="sm"
                              magnetic={true}
                              className="h-12 px-6 bg-green-500/10 text-green-600 hover:bg-green-500 hover:text-white rounded-2xl transition-all uppercase tracking-widest font-black text-[10px]"
                              icon={Check}
                            >
                              Accept
                            </Button>
                            <Button
                              onClick={() => handleMeetingStatus(meeting.userId, meeting.id, 'rejected')}
                              variant="ghost"
                              size="sm"
                              magnetic={true}
                              className="h-12 px-6 bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white rounded-2xl transition-all uppercase tracking-widest font-black text-[10px]"
                              icon={XCircle}
                            >
                              Reject
                            </Button>
                          </>
                        )
                      ) : null}
                      
                      <Button
                        onClick={() => handleRemoveMeeting(meeting.userId, meeting.id)}
                        variant="ghost"
                        size="sm"
                        magnetic={true}
                        className="w-12 h-12 p-0 bg-paper border border-ink/5 rounded-2xl text-ink/20 hover:text-red-500 hover:shadow-xl transition-all"
                        icon={Trash2}
                      />
                    </div>
                  </div>
                  
                  {meeting.notes && (
                    <div className="mt-8 p-6 bg-ink/[0.02] rounded-[32px] border border-ink/5 relative z-10">
                      <p className="text-sm text-ink/60 leading-relaxed italic">"{meeting.notes}"</p>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </div>
      ) : activeTab === 'users' ? (
        <div className="space-y-12 max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 px-4">
            <div>
              <h2 className="text-4xl font-serif mb-2">User Directory</h2>
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-ink/40">Manage access and permissions</p>
            </div>
            
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/20" size={16} />
              <input
                type="text"
                placeholder="Search users..."
                className="w-full bg-surface border border-ink/5 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-ink"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-8">
            {users.filter(u => 
              (u.displayName || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
              (u.email || '').toLowerCase().includes(userSearchQuery.toLowerCase())
            ).length === 0 ? (
              <div className="py-32 text-center border-2 border-dashed border-ink/5 rounded-[48px] bg-ink/[0.01]">
                <div className="p-6 bg-ink/5 rounded-3xl w-20 h-20 mx-auto mb-6 flex items-center justify-center text-ink/20">
                  <Users size={40} />
                </div>
                <p className="text-ink/30 text-[10px] uppercase tracking-[0.3em] font-black">
                  {userSearchQuery ? `No users found matching "${userSearchQuery}"` : "No users found in the system."}
                </p>
              </div>
            ) : (
              users
                .filter(u => 
                  (u.displayName || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                  (u.email || '').toLowerCase().includes(userSearchQuery.toLowerCase())
                )
                .map((u) => (
                <motion.div
                  key={u.id}
                  layout
                  className="bg-surface p-8 md:p-10 rounded-[48px] border border-ink/5 hover:border-accent/20 hover:shadow-2xl hover:shadow-accent/5 transition-all duration-500 group relative overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 relative z-10">
                    <div className="flex items-center space-x-8">
                      <div className="p-5 rounded-[24px] bg-ink/[0.03] text-ink/40 group-hover:bg-accent/10 group-hover:text-accent transition-all duration-500">
                        <User size={32} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-serif mb-2 text-ink/80">{u.displayName || 'Anonymous User'}</h3>
                        <div className="flex flex-wrap items-center gap-4">
                          <span className="text-[10px] uppercase tracking-widest text-ink/30 font-black">{u.email}</span>
                          {userPages[u.id]?.contactInfo?.email && userPages[u.id].contactInfo.email !== u.email && (
                            <span className="text-[10px] uppercase tracking-widest text-accent font-black">Contact: {userPages[u.id].contactInfo.email}</span>
                          )}
                          <span className={`text-[8px] uppercase tracking-[0.2em] px-3 py-1 rounded-full font-black ${
                            u.role === 'admin' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'bg-ink/5 text-ink/40'
                          }`}>
                            {u.role || 'user'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Button
                        to={`/user/${u.id}`}
                        variant="ghost"
                        size="sm"
                        magnetic={true}
                        className="w-12 h-12 p-0 bg-paper border border-ink/5 rounded-2xl text-ink/20 hover:text-accent hover:shadow-xl transition-all"
                        title="View User Page"
                        icon={ExternalLinkIcon}
                      />
                      
                      <div className="flex flex-col items-end gap-3">
                        <div className="flex items-center space-x-3">
                          <span className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Approved (Library)</span>
                          <Button
                            onClick={() => toggleApproval(u.id, u.approved)}
                            variant="ghost"
                            size="sm"
                            magnetic={true}
                            className={u.approved ? 'text-accent' : 'text-ink/20'}
                            icon={u.approved ? Check : X}
                            title={u.approved ? 'Revoke Approval' : 'Approve User'}
                          />
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">Admin Health</span>
                          <Button
                            onClick={() => toggleAdminHealthAccess(u.id, u.canViewAdminHealth)}
                            variant="ghost"
                            size="sm"
                            magnetic={true}
                            className={u.canViewAdminHealth ? 'text-accent' : 'text-ink/20'}
                            icon={u.canViewAdminHealth ? Check : X}
                            title={u.canViewAdminHealth ? 'Disable Health Access' : 'Enable Health Access'}
                          />
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">KIAPLAY</span>
                          <Button
                            onClick={() => toggleKiaplayAccess(u.id, u.hasKiaplayAccess)}
                            variant="ghost"
                            size="sm"
                            magnetic={true}
                            className={u.hasKiaplayAccess ? 'text-accent' : 'text-ink/20'}
                            icon={u.hasKiaplayAccess ? Check : X}
                            title={u.hasKiaplayAccess ? 'Disable KIAPLAY Access' : 'Enable KIAPLAY Access'}
                          />
                        </div>
                      </div>

                      <Button
                        onClick={() => deleteUser(u.id)}
                        variant="ghost"
                        size="sm"
                        magnetic={true}
                        className="w-12 h-12 p-0 bg-paper border border-ink/5 rounded-2xl text-ink/20 hover:text-red-500 hover:shadow-xl transition-all"
                        title="Delete User"
                        icon={Trash2}
                      />
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      ) : activeTab === 'integrations' ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <div className="bg-surface p-12 rounded-[40px] border border-ink/5 shadow-sm">
            <div className="flex items-center space-x-6 mb-12">
              <div className="p-5 bg-accent/10 rounded-3xl text-accent">
                <CalendarIcon size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-serif">Integrations</h2>
                <p className="text-[10px] uppercase tracking-widest text-ink/40">Connect external services</p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="flex items-center justify-between p-8 bg-paper rounded-3xl border border-ink/5">
                <div className="flex items-center space-x-6">
                  <div className="p-4 bg-white dark:bg-ink/5 rounded-2xl shadow-sm">
                    <CalendarIcon size={24} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif">Google Calendar</h3>
                    <p className="text-xs text-ink/40">Sync your availability with Google Calendar</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {isCalendarConnected ? (
                    <div className="flex items-center space-x-2 text-green-600 bg-green-50 px-4 py-2 rounded-full text-[10px] uppercase tracking-widest font-bold">
                      <CheckCircle2 size={14} />
                      <span>Connected</span>
                    </div>
                  ) : (
                    <Button
                      onClick={handleConnectCalendar}
                      variant="primary"
                      size="sm"
                      magnetic={true}
                      className="px-8"
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>

              <div className="p-8 bg-paper rounded-3xl border border-ink/5 space-y-6">
                <div className="flex items-center space-x-6">
                  <div className="p-4 bg-white dark:bg-ink/5 rounded-2xl shadow-sm">
                    <RefreshCcw size={24} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif">Deploy Integration (GitHub Actions)</h3>
                    <p className="text-xs text-ink/40">Automatically trigger a redeploy of your website when a blog post is published.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">GitHub Repository</label>
                    <input
                      type="text"
                      value={profile.githubRepo || ''}
                      onChange={(e) => setProfile({ ...profile, githubRepo: e.target.value })}
                      className="w-full px-6 py-4 bg-surface border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all"
                      placeholder="e.g. kianosh/solheim-online"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/40 font-black">GitHub Token</label>
                    <input
                      type="password"
                      value={profile.githubToken || ''}
                      onChange={(e) => setProfile({ ...profile, githubToken: e.target.value })}
                      className="w-full px-6 py-4 bg-surface border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all"
                      placeholder="ghp_..................."
                    />
                  </div>
                </div>
                <div className="pt-4 flex justify-between items-center">
                  <p className="text-[10px] uppercase tracking-widest text-ink/40">Requires fine-grained token with Action permissions.</p>
                  <Button variant="primary" size="sm" onClick={updateProfile} disabled={isSavingProfile}>
                    {isSavingProfile ? 'Saving...' : 'Save Config'}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between p-8 bg-paper rounded-3xl border border-ink/5">
                <div className="flex items-center space-x-6">
                  <div className="p-4 bg-white dark:bg-ink/5 rounded-2xl shadow-sm">
                    <Plus size={24} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif">Default Data</h3>
                    <p className="text-xs text-ink/40">Restore the initial demo content (CV, Recommendations, Socials)</p>
                  </div>
                </div>
                <Button
                  onClick={seedData}
                  variant="outline"
                  size="sm"
                  magnetic={true}
                  className="px-8 text-accent border-accent/20 hover:bg-accent hover:text-white"
                >
                  Seed Data
                </Button>
              </div>
              <div className="pt-12 border-t border-ink/5 mt-12">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-serif">Dashboard Timetables</h3>
                    <p className="text-xs text-ink/40">Manage iframe boards shown on the SAMPOL Dashboard</p>
                  </div>
                  <Button onClick={addTimetableBoard} variant="primary" size="sm" icon={Plus}>Add Board</Button>
                </div>
                
                <div className="space-y-6">
                  {timetableBoards.map((board, idx) => (
                    <div key={`${board.id}-${idx}`} className="bg-paper p-8 rounded-3xl border border-ink/5 space-y-6 group relative">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest text-ink/40 font-black">Board Name</label>
                          <input 
                            value={board.name}
                            onChange={(e) => updateTimetableBoard(board.id, { name: e.target.value })}
                            className="w-full bg-ink/5 p-4 rounded-xl outline-none text-sm"
                            placeholder="e.g. Bergen Airport"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest text-ink/40 font-black">Iframe/Source URL</label>
                          <input 
                            value={board.url}
                            onChange={(e) => updateTimetableBoard(board.id, { url: e.target.value })}
                            className="w-full bg-ink/5 p-4 rounded-xl outline-none text-sm font-mono"
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-ink/5">
                        <div className="flex items-center gap-4">
                           <span className="text-[10px] text-ink/30 italic">Tip: Use Avinor departure link for live flight status</span>
                        </div>
                        <Button 
                          onClick={() => deleteTimetableBoard(board.id)} 
                          variant="ghost" 
                          size="sm" 
                          icon={Trash2} 
                          className="text-red-500 hover:bg-red-50"
                        >
                          Remove Board
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : activeTab === 'messages' ? (
        <div className="space-y-12 max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 px-4">
            <div>
              <h2 className="text-4xl font-serif mb-2">Inquiry Inbox</h2>
              <p className="text-ink/40 text-[10px] uppercase tracking-[0.2em] font-black">Manage your incoming communications</p>
            </div>
            <div className="flex items-center bg-surface border border-ink/5 rounded-2xl px-6 py-3">
              <span className="text-[10px] uppercase tracking-widest text-ink/30 font-black mr-4">Filter</span>
              <div className="flex bg-paper p-1 rounded-xl">
                {['all', 'unread', 'read'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setMessageFilter(f as any)}
                    className={`px-4 py-1.5 rounded-lg text-[8px] uppercase tracking-widest font-black transition-all ${
                      messageFilter === f ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-ink/30 hover:text-ink/60'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-8">
            {filteredMessages.length === 0 ? (
              <div className="py-32 text-center border-2 border-dashed border-ink/5 rounded-[48px] bg-ink/[0.01]">
                <div className="p-6 bg-ink/5 rounded-3xl w-20 h-20 mx-auto mb-6 flex items-center justify-center text-ink/20">
                  <Mail size={40} />
                </div>
                <p className="text-ink/30 text-[10px] uppercase tracking-[0.3em] font-black">Your inbox is currently empty.</p>
              </div>
            ) : (
              filteredMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-surface p-8 md:p-12 rounded-[48px] border transition-all duration-500 group relative overflow-hidden ${
                    msg.read ? 'border-ink/5 opacity-80' : 'border-accent/20 shadow-xl shadow-accent/5'
                  }`}
                >
                  {!msg.read && (
                    <div className="absolute top-0 left-0 w-2 h-full bg-accent" />
                  )}
                  
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 relative z-10">
                    <div className="flex-grow space-y-6">
                      <div className="flex flex-wrap items-center gap-4">
                        <h3 className="text-2xl font-serif text-ink/80">{msg.name}</h3>
                        <span className="px-3 py-1 bg-ink/5 rounded-full text-[9px] uppercase tracking-widest text-ink/40 font-black">
                          {msg.email}
                        </span>
                        <span className="text-[9px] uppercase tracking-widest text-ink/20 font-black">
                          {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
                        </span>
                      </div>
                      
                      <div className="p-8 bg-paper/50 rounded-[32px] border border-ink/5">
                        <p className="text-ink/60 leading-relaxed whitespace-pre-wrap italic">"{msg.message}"</p>
                      </div>
                    </div>

                    <div className="flex md:flex-col items-center gap-4">
                      <Button
                        onClick={() => toggleMessageRead(msg.id, msg.read)}
                        variant="ghost"
                        size="sm"
                        magnetic={true}
                        className={`p-4 rounded-2xl transition-all ${
                          msg.read ? 'text-ink/20 hover:text-accent hover:bg-accent/5' : 'text-accent bg-accent/10'
                        }`}
                        title={msg.read ? 'Mark as unread' : 'Mark as read'}
                        icon={msg.read ? Mail : MailOpen}
                      />
                      <Button
                        onClick={() => deleteMessage(msg.id)}
                        variant="ghost"
                        size="sm"
                        magnetic={true}
                        className="p-4 text-ink/20 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                        title="Delete message"
                        icon={Trash2}
                      />
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      ) : activeTab === 'expenses' ? (
        <div className="max-w-7xl mx-auto">
          <Expenses />
        </div>
      ) : activeTab === 'memberships' ? (
        <div className="max-w-7xl mx-auto">
          <Memberships />
        </div>
      ) : activeTab === 'writings' ? (
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="flex flex-col lg:flex-row items-start justify-between gap-8">
            <div>
              <h2 className="text-4xl font-serif mb-2">Collected Writings</h2>
              <p className="text-ink/40 text-[10px] uppercase tracking-[0.2em] font-black">Manage your essays and articles</p>
            </div>
            {!isEditingBlogPost && (
              <Button
                onClick={() => {
                  resetBlogForm();
                  setIsEditingBlogPost('new');
                }}
                variant="primary"
                size="lg"
                magnetic={true}
                className="px-8 py-4 rounded-2xl shadow-xl shadow-accent/20"
                icon={Plus}
              >
                Create New Writing
              </Button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {isEditingBlogPost ? (
              <motion.div
                key="editor"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-surface p-8 md:p-12 rounded-[48px] border border-ink/5 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent/[0.03] rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
                
                <div className="flex items-center justify-between mb-12 relative z-10">
                  <h3 className="text-2xl font-serif">
                    {isEditingBlogPost === 'new' ? 'New Writing' : 'Edit Writing'}
                  </h3>
                  <Button onClick={resetBlogForm} variant="ghost" size="sm" icon={X} magnetic={true} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 relative z-10">
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <label className="block text-[10px] uppercase tracking-widest text-ink/30 font-black">Writing Title</label>
                      <input
                        className="w-full bg-paper border border-ink/10 rounded-2xl px-6 py-4 text-lg font-serif focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all"
                        value={blogFormData.title}
                        onChange={(e) => {
                          const title = e.target.value;
                          const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                          setBlogFormData(prev => ({ ...prev, title, slug }));
                        }}
                        placeholder="Enter a compelling title..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] uppercase tracking-widest text-ink/30 font-black">Slug (URL Path)</label>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] text-ink/20 font-mono">/writings/</span>
                        <input
                          className="flex-grow bg-paper border border-ink/10 rounded-2xl px-6 py-4 text-sm font-mono focus:outline-none focus:border-accent transition-all"
                          value={blogFormData.slug}
                          onChange={(e) => setBlogFormData(prev => ({ ...prev, slug: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="block text-[10px] uppercase tracking-widest text-ink/30 font-black">Author</label>
                        <input
                          className="w-full bg-paper border border-ink/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-accent transition-all"
                          value={blogFormData.author}
                          onChange={(e) => setBlogFormData(prev => ({ ...prev, author: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] uppercase tracking-widest text-ink/30 font-black">Status</label>
                        <select
                          className="w-full bg-paper border border-ink/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-accent transition-all appearance-none cursor-pointer"
                          value={blogFormData.status}
                          onChange={(e) => setBlogFormData(prev => ({ ...prev, status: e.target.value as any }))}
                        >
                          <option value="draft">Draft</option>
                          <option value="published">Published</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] uppercase tracking-widest text-ink/30 font-black">Excerpt / Summary</label>
                      <textarea
                        className="w-full bg-paper border border-ink/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-accent transition-all resize-none"
                        rows={3}
                        value={blogFormData.excerpt}
                        onChange={(e) => setBlogFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                        placeholder="A short summary for list views..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] uppercase tracking-widest text-ink/30 font-black">Feature Image URL</label>
                      <div className="flex gap-4">
                        <input
                          className="flex-grow bg-paper border border-ink/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-accent transition-all"
                          value={blogFormData.imageUrl}
                          onChange={(e) => setBlogFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                          placeholder="https://..."
                        />
                        <Button
                          onClick={() => setFilePicker({ 
                            isOpen: true, 
                            onSelect: (url, alt, credit) => setBlogFormData(prev => ({ ...prev, imageUrl: url, imageAlt: alt || '', imageCredit: credit || '' })) 
                          })}
                          variant="outline"
                          size="sm"
                          icon={ImageIcon}
                          magnetic={true}
                        />
                      </div>
                      {(blogFormData.imageAlt || blogFormData.imageCredit) && (
                        <div className="text-xs text-ink/50 mt-2 space-y-1">
                          {blogFormData.imageAlt && <p>Alt: {blogFormData.imageAlt}</p>}
                          {blogFormData.imageCredit && (
                            <div className="flex gap-2">
                              <span>Credit:</span>
                              <div dangerouslySetInnerHTML={{ __html: blogFormData.imageCredit }} className="[&_a]:underline [&_a]:hover:text-ink transition-colors" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-2 flex flex-col h-full">
                      <label className="block text-[10px] uppercase tracking-widest text-ink/30 font-black">Content</label>
                      <div className="bg-paper border border-ink/10 rounded-3xl p-6 min-h-[400px]">
                        <RichTextEditor
                          content={blogFormData.content || ''}
                          onChange={(html) => setBlogFormData(prev => ({ ...prev, content: html }))}
                          placeholder="Begin writing..."
                          onImageRequest={() => {
                            return new Promise((resolve) => {
                              setFilePicker({
                                isOpen: true,
                                onSelect: (url, alt, credit) => resolve({ url, alt, credit })
                              });
                            });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-12 pt-10 border-t border-ink/5 flex items-center justify-end space-x-6 relative z-10">
                  <Button onClick={resetBlogForm} variant="ghost" size="lg" magnetic={true}>Cancel</Button>
                  <Button onClick={handleSaveBlogPost} variant="primary" size="lg" icon={Save} magnetic={true} className="px-12">
                    {isEditingBlogPost === 'new' ? 'Publish Writing' : 'Save Changes'}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
              >
                {blogPosts.map((post) => (
                  <motion.div
                    key={post.id}
                    layout
                    className="bg-surface rounded-[40px] border border-ink/5 shadow-sm overflow-hidden group hover:shadow-2xl hover:border-accent/10 transition-all duration-700"
                  >
                    <div className="aspect-[16/9] relative bg-ink/5">
                      {post.imageUrl && (
                        <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                      )}
                      <div className="absolute top-6 left-6">
                        <span className={`px-4 py-1.5 rounded-full text-[8px] uppercase tracking-widest font-black shadow-lg backdrop-blur-md ${
                          post.status === 'published' ? 'bg-emerald-500/90 text-white' : 'bg-orange-500/90 text-white'
                        }`}>
                          {post.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-8 space-y-6">
                      <div className="space-y-3">
                        <h4 className="text-xl font-serif line-clamp-1">{post.title}</h4>
                        <p className="text-[10px] text-ink/40 uppercase tracking-widest line-clamp-2 leading-relaxed">
                          {post.excerpt || 'No excerpt provided.'}
                        </p>
                      </div>

                      <div className="pt-6 border-t border-ink/5 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Button
                            onClick={() => {
                              setIsEditingBlogPost(post.id);
                              setBlogFormData(post);
                            }}
                            variant="ghost"
                            size="sm"
                            icon={Edit2}
                            magnetic={true}
                            className="text-ink/40 hover:text-accent hover:bg-accent/5 p-3 rounded-xl transition-all"
                          />
                          <Button 
                            onClick={() => handleDeleteBlogPost(post.id)}
                            variant="ghost" 
                            size="sm" 
                            icon={Trash2} 
                            magnetic={true}
                            className="text-ink/20 hover:text-red-500 hover:bg-red-50 p-3 rounded-xl transition-all"
                          />
                        </div>
                        <div className="text-[9px] uppercase tracking-[0.2em] text-ink/20 font-black">
                          {post.createdAt?.toDate().toLocaleDateString() || 'Recently'}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {!isEditingBlogPost && blogPosts.length === 0 && (
            <div className="text-center py-40 border-2 border-dashed border-ink/5 rounded-[48px] bg-ink/[0.01]">
              <div className="p-6 bg-ink/5 rounded-3xl w-20 h-20 mx-auto mb-6 flex items-center justify-center text-ink/20">
                <BookOpen size={40} />
              </div>
              <p className="text-ink/30 text-[10px] uppercase tracking-[0.3em] font-black">No pieces in your library.</p>
            </div>
          )}
        </div>
      ) : activeTab === 'measured-words' ? (
        <div className="max-w-7xl mx-auto">
          <MeasuredWords />
        </div>
      ) : (
        <div className="space-y-12 max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 px-4">
            <div>
              <h2 className="text-4xl font-serif mb-2">Asset Library</h2>
              <p className="text-ink/40 text-[10px] uppercase tracking-[0.2em] font-black">Manage your digital resources</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Button
                onClick={syncStorage}
                variant="outline"
                size="lg"
                magnetic={true}
                className="bg-surface border-ink/10 text-ink/60 hover:text-accent hover:border-accent transition-all rounded-2xl px-8 py-4 text-[10px] uppercase tracking-widest font-black"
                title="Sync files from Firebase Storage"
                icon={RefreshCcw}
                isLoading={isSyncing}
              >
                {isSyncing ? 'Syncing...' : 'Sync Storage'}
              </Button>
              <div className="relative flex items-center bg-surface border border-ink/10 rounded-2xl px-6 py-4">
                <ArrowUpDown size={14} className="text-ink/40 mr-3" />
                <select
                  className="bg-transparent text-[10px] uppercase tracking-widest focus:outline-none appearance-none pr-6 cursor-pointer font-black"
                  value={fileSortOption}
                  onChange={(e) => setFileSortOption(e.target.value as any)}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="size-asc">Size (Smallest)</option>
                  <option value="size-desc">Size (Largest)</option>
                </select>
              </div>
              <div className="relative">
                <Button
                  variant="primary"
                  size="lg"
                  magnetic={true}
                  disabled={isUploading}
                  className="relative px-10 py-4 rounded-2xl shadow-xl shadow-accent/20"
                  icon={Upload}
                  isLoading={isUploading}
                >
                  {isUploading ? 'Uploading...' : 'Upload File'}
                  <input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                </Button>
              </div>
            </div>
          </div>

          {isUploading && (
            <div className="bg-surface p-8 rounded-[32px] border border-accent/20 shadow-xl shadow-accent/5 space-y-4 max-w-2xl mx-auto">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] font-black">
                <span className="text-accent">Uploading to Cloud...</span>
                <span className="text-ink/40">{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-ink/5 rounded-full h-3 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  className="bg-accent h-full"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {sortedFiles.map((file) => (
              <motion.div
                key={file.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface rounded-[40px] border border-ink/5 shadow-sm group hover:border-accent/20 hover:shadow-2xl hover:shadow-accent/5 transition-all duration-500 overflow-hidden flex flex-col"
              >
                <div className="aspect-square bg-ink/[0.02] overflow-hidden relative">
                  {file.type.startsWith('image/') ? (
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 scale-105 group-hover:scale-100"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-ink/10 group-hover:text-accent/20 transition-all duration-500">
                      <FileIcon size={80} strokeWidth={0.5} />
                    </div>
                  )}
                  
                  {/* Overlay Actions */}
                  <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center space-x-4">
                    <Button
                      onClick={() => copyToClipboard(file.url)}
                      variant="ghost"
                      size="sm"
                      magnetic={true}
                      className="w-12 h-12 p-0 bg-paper text-ink hover:bg-accent hover:text-white rounded-2xl shadow-xl"
                      title="Copy URL"
                      icon={Copy}
                    />
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-12 h-12 flex items-center justify-center bg-paper text-ink rounded-2xl hover:bg-accent hover:text-white transition-all transform hover:scale-110 shadow-xl"
                      title="Open in new tab"
                    >
                      <ExternalLinkIcon size={20} />
                    </a>
                    <Button
                      onClick={() => deleteFile(file)}
                      variant="ghost"
                      size="sm"
                      magnetic={true}
                      className="w-12 h-12 p-0 bg-paper text-red-500 hover:bg-red-500 hover:text-white rounded-2xl shadow-xl"
                      title="Delete"
                      icon={Trash2}
                    />
                  </div>

                  {/* File Type Badge */}
                  <div className="absolute top-6 left-6">
                    <span className="bg-paper/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-[8px] uppercase tracking-[0.2em] text-ink/60 font-black border border-ink/5 shadow-lg">
                      {file.type.split('/')[1] || 'file'}
                    </span>
                  </div>
                </div>

                <div className="p-8 flex-grow flex flex-col justify-between bg-ink/[0.01]">
                  <div>
                    <h3 className="text-base font-serif truncate mb-2 text-ink/80 group-hover:text-accent transition-colors" title={file.name}>
                      {file.name}
                    </h3>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-[10px] uppercase tracking-widest text-ink/30 font-black">
                        {formatFileSize(file.size)}
                      </span>
                      <span className="text-[9px] uppercase tracking-widest text-ink/20 font-black">
                        {file.createdAt?.seconds ? new Date(file.createdAt.seconds * 1000).toLocaleDateString() : 'Recent'}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {files.length === 0 && (
            <div className="text-center py-32 border-2 border-dashed border-ink/5 rounded-[48px] bg-ink/[0.01]">
              <div className="p-6 bg-ink/5 rounded-3xl w-20 h-20 mx-auto mb-6 flex items-center justify-center text-ink/20">
                <FileIcon size={40} />
              </div>
              <p className="text-ink/30 text-[10px] uppercase tracking-[0.3em] font-black">Your asset library is empty.</p>
            </div>
          )}
        </div>
      )}
      </motion.div>
    </AnimatePresence>
  </main>
</div>

{/* Confirmation Modal */}
<AnimatePresence>
  {confirmModal.isOpen && (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-surface p-6 sm:p-8 rounded-3xl shadow-2xl max-w-md w-full border border-ink/5"
      >
        <div className="flex items-center space-x-3 text-accent mb-4">
          <AlertCircle size={24} />
          <h3 className="text-xl font-serif">{confirmModal.title}</h3>
        </div>
        <p className="text-sm sm:text-base text-ink/60 mb-8 leading-relaxed">
          {confirmModal.message}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:space-x-4">
          <Button
            onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            variant="outline"
            size="lg"
            className="w-full sm:flex-1 px-6 py-3 border border-ink/10 rounded-full text-[10px] uppercase tracking-widest hover:bg-ink/5 transition-all font-black"
            magnetic={true}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmModal.onConfirm}
            variant="primary"
            size="lg"
            className="w-full sm:flex-1 px-6 py-3 bg-red-500 text-white rounded-full text-[10px] uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 font-black"
            magnetic={true}
          >
            Confirm Delete
          </Button>
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>

{/* File Picker Modal */}
<AnimatePresence>
  {filePicker.isOpen && (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setFilePicker(prev => ({ ...prev, isOpen: false }))}
        className="absolute inset-0 bg-ink/60 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-surface p-5 sm:p-8 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-ink/5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-2 sm:p-3 bg-accent/10 rounded-2xl text-accent">
              <ImageIcon size={24} className="sm:w-7 sm:h-7" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-serif leading-tight">Asset Selection</h3>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-ink/40">Choose from library or search Wikimedia</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="flex bg-ink/5 rounded-full p-1 mr-2">
              <button
                onClick={() => setFilePickerTab('upload')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${filePickerTab === 'upload' ? 'bg-surface text-ink shadow-sm' : 'text-ink/40 hover:text-ink'}`}
              >
                My Files
              </button>
              <button
                onClick={() => setFilePickerTab('wikimedia')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${filePickerTab === 'wikimedia' ? 'bg-surface text-ink shadow-sm' : 'text-ink/40 hover:text-ink'}`}
              >
                Wikimedia
              </button>
            </div>
            {filePickerTab === 'upload' && (
              <Button
                variant="primary"
                size="sm"
                magnetic={true}
                className="relative flex-1 sm:flex-none py-2.5"
                icon={Upload}
              >
                Upload
                <input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleFileUpload}
                  accept="image/*"
                />
              </Button>
            )}
            <Button
              onClick={() => { setFilePickerTab('upload'); setFilePicker(prev => ({ ...prev, isOpen: false })); }}
              variant="ghost"
              size="sm"
              icon={X}
              magnetic={true}
              className="p-2 sm:p-3 hover:bg-ink/5 rounded-full transition-colors hidden sm:flex"
            />
          </div>
        </div>

        {isUploading && (
          <div className="mb-8 p-4 bg-accent/5 rounded-2xl border border-accent/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-widest text-accent font-bold">Uploading...</span>
              <span className="text-[10px] font-mono text-accent">{Math.round(uploadProgress)}%</span>
            </div>
            <div className="h-1 w-full bg-accent/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
          {filePickerTab === 'upload' ? (
            files.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-ink/20 space-y-4">
                <ImageIcon size={48} />
                <p className="text-xs uppercase tracking-widest">No files uploaded yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {sortedFiles.map((file) => (
                <Button
                  key={file.id}
                  onClick={() => {
                    filePicker.onSelect(file.url);
                    setFilePicker(prev => ({ ...prev, isOpen: false }));
                  }}
                  variant="ghost"
                  className="group relative aspect-square bg-paper rounded-2xl border border-ink/5 overflow-hidden hover:border-accent transition-all w-full h-full"
                  magnetic={true}
                >
                  {file.type.startsWith('image/') ? (
                    <img
                      src={file.url}
                      alt={file.name}
                      className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all font-black"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="absolute inset-0 w-full h-full flex items-center justify-center text-ink/20 group-hover:text-accent/20 transition-colors">
                      <FileIcon size={32} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-accent/0 group-hover:bg-accent/10 transition-all flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 bg-surface text-accent px-3 py-1 rounded-full text-[8px] uppercase tracking-widest shadow-sm transform translate-y-2 group-hover:translate-y-0 transition-all font-black">
                      Select
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                    <p className="text-[9px] text-white truncate font-medium relative top-0">{file.name}</p>
                    <p className="text-[7px] text-white/60 uppercase tracking-widest relative top-0">{formatFileSize(file.size)}</p>
                  </div>
                </Button>
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col space-y-6">
            <form onSubmit={searchWikimedia} className="relative">
              <input
                type="text"
                placeholder="Search Wikimedia Commons..."
                value={wikimediaSearch}
                onChange={(e) => setWikimediaSearch(e.target.value)}
                className="w-full bg-paper border border-ink/10 rounded-2xl pl-12 pr-4 py-4 text-sm font-medium focus:border-accent outline-none ring-accent/20 transition-all"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" size={20} />
              <button
                type="submit"
                disabled={isSearchingWikimedia}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs uppercase tracking-widest font-black text-accent disabled:opacity-50"
              >
                {isSearchingWikimedia ? 'Searching...' : 'Search'}
              </button>
            </form>

            {wikimediaResults.length === 0 && !isSearchingWikimedia && (
              <div className="h-48 flex flex-col items-center justify-center text-ink/20 space-y-4">
                <ImageIcon size={48} />
                <p className="text-xs uppercase tracking-widest">Search for public domain images</p>
              </div>
            )}

            {isSearchingWikimedia ? (
              <div className="h-48 flex items-center justify-center">
                <Loader2 size={32} className="text-ink/20 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {wikimediaResults.map((result) => (
                  <Button
                    key={result.id}
                    onClick={() => {
                      const author = result.credit || 'Unknown Author';
                      const licenseStr = result.attribution ? ` (${result.attribution})` : '';
                      const creditHtml = `<a href="${result.descriptionUrl}" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a> / ${author}${licenseStr}`;
                      filePicker.onSelect(result.url, result.title, creditHtml);
                      setFilePicker(prev => ({ ...prev, isOpen: false }));
                    }}
                    variant="ghost"
                    className="group relative aspect-square bg-paper rounded-2xl border border-ink/5 overflow-hidden hover:border-accent transition-all w-full h-full"
                    magnetic={true}
                  >
                    <img
                      src={result.thumburl}
                      alt={result.title}
                      className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all font-black"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-accent/0 group-hover:bg-accent/10 transition-all flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 bg-surface text-accent px-3 py-1 rounded-full text-[8px] uppercase tracking-widest shadow-sm transform translate-y-2 group-hover:translate-y-0 transition-all font-black">
                        Select
                      </span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                      <p className="text-[7px] text-white/80 line-clamp-2 leading-tight uppercase relative top-0">{result.title}</p>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>
</div>
);
}

function SocialItemEditor({ social, onUpdate, onDelete }: { 
  social: Social, 
  onUpdate: (id: string, data: Partial<Social>) => Promise<void>,
  onDelete: (id: string) => Promise<void>
}) {
  const [localData, setLocalData] = useState(social);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalData(social);
    setHasChanges(false);
  }, [social]);

  const handleChange = (data: Partial<Social>) => {
    setLocalData(prev => ({ ...prev, ...data }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(social.id, localData);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-paper/50 p-8 rounded-[32px] border border-ink/5 shadow-sm space-y-6 relative group hover:border-accent/20 transition-all duration-500">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-[9px] uppercase tracking-widest text-ink/30 font-black">Label</label>
          <input
            className="w-full bg-paper border border-ink/10 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all"
            value={localData.label}
            onChange={(e) => handleChange({ label: e.target.value })}
            placeholder="e.g. LinkedIn"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[9px] uppercase tracking-widest text-ink/30 font-black">Icon</label>
          <div className="relative">
            <select
              className="w-full bg-paper border border-ink/10 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all appearance-none cursor-pointer"
              value={localData.icon}
              onChange={(e) => handleChange({ icon: e.target.value as any })}
            >
              <option value="linkedin">LinkedIn</option>
              <option value="twitter">Twitter</option>
              <option value="github">GitHub</option>
              <option value="mail">Email</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="youtube">YouTube</option>
              <option value="bluesky">BlueSky</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-ink/20">
              <ArrowUpDown size={14} />
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-[9px] uppercase tracking-widest text-ink/30 font-black">URL (href)</label>
        <input
          className="w-full bg-paper border border-ink/10 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all"
          value={localData.href}
          onChange={(e) => handleChange({ href: e.target.value })}
          placeholder="https://..."
        />
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-ink/5">
        <div className="flex items-center space-x-6">
          <div className="w-24 space-y-2">
            <label className="block text-[9px] uppercase tracking-widest text-ink/30 font-black">Order</label>
            <input
              type="number"
              className="w-full bg-paper border border-ink/10 rounded-xl px-4 py-2 text-xs font-black focus:outline-none focus:border-accent transition-all"
              value={localData.order}
              onChange={(e) => handleChange({ order: parseInt(e.target.value) || 0 })}
            />
          </div>
          <Button
            onClick={() => onDelete(social.id)}
            variant="ghost"
            size="sm"
            magnetic={true}
            className="mt-5 p-3 text-ink/20 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            title="Delete"
            icon={Trash2}
          />
        </div>
        
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          variant={hasChanges ? "primary" : "ghost"}
          size="sm"
          magnetic={true}
          className={`mt-5 px-6 py-2 rounded-xl text-[10px] uppercase tracking-widest font-black transition-all ${
            hasChanges ? 'shadow-lg shadow-accent/20' : 'text-ink/20'
          }`}
          icon={Save}
          isLoading={isSaving}
        >
          {isSaving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Saved'}
        </Button>
      </div>
    </div>
  );
}
