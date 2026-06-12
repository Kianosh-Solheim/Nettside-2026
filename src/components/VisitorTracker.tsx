import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function VisitorTracker() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const docId = path === '/' ? 'home' : path.replace(/\//g, '_').substring(1);
    const enterTime = Date.now();
    let visitRefId: string | null = null;

    const recordView = async () => {
      try {
        // Overall tracking (Legacy)
        const docRef = doc(db, 'pageStats', docId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          updateDoc(docRef, {
            views: increment(1)
          }).catch(console.warn);
        } else {
          setDoc(docRef, {
            path,
            views: 1,
            durationSeconds: 0
          }).catch(console.warn);
        }

        // Time-series tracking
        const visitRef = await addDoc(collection(db, 'page_visits'), {
           path,
           timestamp: serverTimestamp(),
           durationSeconds: 0
        });
        visitRefId = visitRef.id;
      } catch (err) {
        console.warn("Visitor Stats tracking failed:", err);
      }
    };
    
    recordView();

    return () => {
      const leaveTime = Date.now();
      const durationSeconds = Math.round((leaveTime - enterTime) / 1000);
      
      const recordDuration = async () => {
        try {
          if (durationSeconds > 0) {
            const docRef = doc(db, 'pageStats', docId);
            updateDoc(docRef, {
              durationSeconds: increment(durationSeconds)
            }).catch(console.warn);

            if (visitRefId) {
              const vRef = doc(db, 'page_visits', visitRefId);
              updateDoc(vRef, {
                durationSeconds: durationSeconds
              }).catch(console.warn);
            }
          }
        } catch (err) {
          console.warn("Visitor Stats tracking failed during exit:", err);
        }
      };
      
      recordDuration();
    };
  }, [location.pathname]);

  return null;
}

