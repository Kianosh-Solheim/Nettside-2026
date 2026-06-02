import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

export default function VisitorTracker() {
  const location = useLocation();

  useEffect(() => {
    // Only track actual routes, not empty or specific internal things if we want to filter
    const path = location.pathname;
    
    // Convert path to a valid Firestore document ID
    const docId = path === '/' ? 'home' : path.replace(/\//g, '_').substring(1);
    const enterTime = Date.now();
    let leaveTime = 0;

    const recordView = async () => {
      try {
        const docRef = doc(db, 'pageStats', docId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          await updateDoc(docRef, {
            views: increment(1)
          });
        } else {
          await setDoc(docRef, {
            path,
            views: 1,
            durationSeconds: 0
          });
        }
      } catch (err) {
        console.warn("Visitor Stats tracking failed:", err);
      }
    };
    
    recordView();

    return () => {
      leaveTime = Date.now();
      const durationSeconds = Math.round((leaveTime - enterTime) / 1000);
      
      // Update the duration spent
      const recordDuration = async () => {
        try {
          const docRef = doc(db, 'pageStats', docId);
          await updateDoc(docRef, {
            durationSeconds: increment(durationSeconds)
          });
        } catch (err) {
          console.warn("Visitor Stats tracking failed during exit:", err);
        }
      };
      
      if (durationSeconds > 0) {
        recordDuration();
      }
    };
  }, [location.pathname]);

  return null;
}
