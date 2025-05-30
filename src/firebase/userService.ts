import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

export type UserRole = 'student' | 'teacher' | 'admin';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string | Date | any;
  lastLogin: string | Date | any;
  updatedAt: string | Date | any;
}

export const createUserProfile = async (user: {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  emailVerified?: boolean;
}) => {
  const userRef = doc(db, 'users', user.uid);
  const userProfile: Partial<UserProfile> = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || null,
    photoURL: user.photoURL || null,
    role: 'student', // Rol por defecto
    emailVerified: user.emailVerified || false,
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(userRef, userProfile, { merge: true });
  return userProfile as UserProfile;
};

export const updateUserProfile = async (
  userId: string,
  updates: Partial<Omit<UserProfile, 'uid' | 'createdAt'>>
) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  if (!userDoc.exists()) {
    return null;
  }
  
  return userDoc.data() as UserProfile;
};

export const updateLastLogin = async (userId: string) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    lastLogin: serverTimestamp(),
  });
};
