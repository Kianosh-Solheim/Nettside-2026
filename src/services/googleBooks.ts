export interface GoogleAuthor {
  firstName: string;
  lastName: string;
}

export interface GoogleBookInfo {
  title: string;
  subtitle: string;
  author: string;
  authors: GoogleAuthor[];
  isbn: string;
  description: string;
  genre: string;
  coverUrl: string;
  publisher: string;
  year: string;
}

export async function searchGoogleBooks(query: string): Promise<GoogleBookInfo[]> {
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`);
    const data = await res.json();
    
    if (!data.items) return [];

    return data.items.map((item: any) => {
      const info = item.volumeInfo;
      const isbn = info.industryIdentifiers?.find((id: any) => id.type === 'ISBN_13')?.identifier || 
                   info.industryIdentifiers?.find((id: any) => id.type === 'ISBN_10')?.identifier || '';
      
      const authors: GoogleAuthor[] = (info.authors || []).map((authorStr: string) => {
        const parts = authorStr.trim().split(/\s+/);
        if (parts.length === 1) {
          return { firstName: '', lastName: parts[0] };
        }
        const lastName = parts.pop() || '';
        const firstName = parts.join(' ');
        return { firstName, lastName };
      });

      return {
        title: info.title || '',
        subtitle: info.subtitle || '',
        author: info.authors ? info.authors.join(', ') : 'Unknown Author',
        authors: authors.length > 0 ? authors : [{ firstName: '', lastName: 'Unknown Author' }],
        isbn: isbn,
        description: info.description || '',
        genre: info.categories ? info.categories[0] : '',
        coverUrl: info.imageLinks ? info.imageLinks.thumbnail.replace('http:', 'https:') : '',
        publisher: info.publisher || '',
        year: info.publishedDate || ''
      };
    });
  } catch (error) {
    console.error("Error searching Google Books:", error);
    return [];
  }
}

export async function getBookByIsbn(isbn: string): Promise<GoogleBookInfo | null> {
  const results = await searchGoogleBooks(`isbn:${isbn}`);
  return results.length > 0 ? results[0] : null;
}
