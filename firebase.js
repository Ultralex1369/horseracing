import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, query, orderBy, limit,
  doc, getDoc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Until you paste a real config, the game still works; it just skips the shared leaderboard.
const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR");
const db = configured ? getFirestore(initializeApp(firebaseConfig)) : null;
export const online = !!db;

// Data layout:
//   tracks/{trackId}          -> { name, time, ghost: [x,y,angle, x,y,angle, ...] }  (the record run)
//   tracks/{trackId}/scores/* -> { name, time, at }                                   (every finished run)

export async function submitRun(trackId, name, time, ghost) {
  if (!db) return;
  try {
    await addDoc(collection(db, "tracks", trackId, "scores"), {
      name, time, at: serverTimestamp(),
    });
    const ref = doc(db, "tracks", trackId);
    const snap = await getDoc(ref);
    if (!snap.exists() || time < snap.data().time) {
      await setDoc(ref, { name, time, ghost });
    }
  } catch (e) {
    console.warn("submitRun failed", e);
  }
}

export async function topRuns(trackId) {
  if (!db) return [];
  try {
    const q = query(collection(db, "tracks", trackId, "scores"), orderBy("time"), limit(10));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ name: d.data().name, time: d.data().time }));
  } catch (e) {
    console.warn("topRuns failed", e);
    return [];
  }
}

export async function recordGhost(trackId) {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, "tracks", trackId));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("recordGhost failed", e);
    return null;
  }
}
