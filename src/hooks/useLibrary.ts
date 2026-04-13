import { useState, useEffect } from 'react';
import { 
  db, 
  auth,
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { Book } from '../types/library';

export function useLibrary() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      setUnauthorized(false);
      return;
    }

    const q = query(collection(db, 'books'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const booksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Book[];
      setBooks(booksData);
      setLoading(false);
      setUnauthorized(false);
    }, (error) => {
      if (error.code === 'permission-denied') {
        setUnauthorized(true);
      } else {
        handleFirestoreError(error, OperationType.LIST, 'books');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const addBook = async (bookData: Omit<Book, 'id' | 'createdAt' | 'userId'>) => {
    try {
      await addDoc(collection(db, 'books'), {
        ...bookData,
        userId: auth.currentUser?.uid,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'books');
    }
  };

  const updateBook = async (id: string, bookData: Partial<Book>) => {
    try {
      const bookRef = doc(db, 'books', id);
      await updateDoc(bookRef, bookData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `books/${id}`);
    }
  };

  const deleteBook = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'books', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `books/${id}`);
    }
  };

  const moveBook = async (bookId: string, newLocation: Book['location']) => {
    try {
      const bookRef = doc(db, 'books', bookId);
      await updateDoc(bookRef, { location: newLocation });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `books/${bookId}`);
    }
  };

  const renameBookshelf = async (room: string, oldName: string, newName: string) => {
    if (oldName === newName) return;
    const booksToUpdate = books.filter(b => b.location.room === room && b.location.bookshelf === oldName);
    
    try {
      await Promise.all(booksToUpdate.map(book => 
        updateDoc(doc(db, 'books', book.id), {
          location: { ...book.location, bookshelf: newName }
        })
      ));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'books');
    }
  };

  return { books, loading, unauthorized, addBook, updateBook, deleteBook, moveBook, renameBookshelf };
}
