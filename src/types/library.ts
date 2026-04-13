export interface Author {
  firstName: string;
  lastName: string;
}

export interface Book {
  id: string;
  title: string;
  subtitle?: string;
  authors: Author[];
  author?: string; // Legacy support
  isbn: string;
  genre: string;
  description: string;
  coverUrl: string;
  publisher?: string;
  year?: string;
  location: {
    room: string;
    bookshelf: string;
    shelfLevel: number;
    position: number;
  };
  nfcTagId?: string;
  readingStatus?: 'To Read' | 'Currently Reading' | 'Finished';
  spineColor?: string;
  borrowedBy?: string;
  borrowedAt?: any;
  userId?: string;
  createdAt: any;
}

export interface BorrowHistory {
  id: string;
  bookId: string;
  userId: string;
  userName: string;
  borrowedAt: any;
  returnedAt?: any;
}

export interface LibraryLocation {
  rooms: string[];
  bookshelves: {
    [room: string]: string[];
  };
}
