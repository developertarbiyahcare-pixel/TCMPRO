
import { UserAccount, SavedPatient, AdminMessage, Promotion } from '../types';
import { db as firestore, auth, collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, updateDoc, onSnapshot } from '../firebase';

export const DEFAULT_ADMIN: UserAccount = {
  uid: 'haxor-super-saint',
  username: 'haxor',
  password: 'haxor123', 
  role: 'super_saint',
  status: 'active',
  createdAt: Date.now()
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const db = {
  users: {
    getAll: async (): Promise<UserAccount[]> => {
      try {
        if (!auth.currentUser) return [];
        const querySnapshot = await getDocs(collection(firestore, 'users'));
        const users: UserAccount[] = [];
        querySnapshot.forEach((doc) => {
          users.push(doc.data() as UserAccount);
        });
        return users;
      } catch (e) {
        console.warn("Users fetch failed (likely unauthenticated):", e);
        return [];
      }
    },
    get: async (uid: string): Promise<UserAccount | null> => {
      try {
        const docSnap = await getDoc(doc(firestore, 'users', uid));
        if (docSnap.exists()) {
          return docSnap.data() as UserAccount;
        }
        return null;
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, `users/${uid}`);
        return null;
      }
    },
    add: async (user: UserAccount): Promise<boolean> => {
      try {
        if (!user.uid) throw new Error("User UID is required");
        await setDoc(doc(firestore, 'users', user.uid), user);
        return true;
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
        return false;
      }
    },
    update: async (uid: string, data: Partial<UserAccount>): Promise<boolean> => {
      try {
        await updateDoc(doc(firestore, 'users', uid), data);
        return true;
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `users/${uid}`);
        return false;
      }
    },
    delete: async (uid: string): Promise<boolean> => {
      try {
        await deleteDoc(doc(firestore, 'users', uid));
        return true;
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `users/${uid}`);
        return false;
      }
    }
  },
  patients: {
    getAll: async (): Promise<SavedPatient[]> => {
      try {
        if (!auth.currentUser) return [];
        // Check role for data isolation
        const userProfile = await db.users.get(auth.currentUser.uid);
        let q;
        if (userProfile?.role === 'super_saint') {
          q = collection(firestore, 'patients');
        } else {
          q = query(collection(firestore, 'patients'), where('authorUid', '==', auth.currentUser.uid));
        }
        const querySnapshot = await getDocs(q);
        const patients: SavedPatient[] = [];
        querySnapshot.forEach((doc) => {
          patients.push(doc.data() as SavedPatient);
        });
        return patients;
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'patients');
        return [];
      }
    },
    add: async (patient: SavedPatient) => {
      try {
        if (!auth.currentUser) throw new Error("Not authenticated");
        const patientWithAuth = { ...patient, authorUid: auth.currentUser.uid };
        await setDoc(doc(firestore, 'patients', patient.id), patientWithAuth);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `patients/${patient.id}`);
      }
    },
    delete: async (id: string) => {
      try {
        await deleteDoc(doc(firestore, 'patients', id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `patients/${id}`);
      }
    }
  },
  messages: {
    send: async (msg: AdminMessage) => {
      try {
        await setDoc(doc(firestore, 'messages', msg.id), msg);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `messages/${msg.id}`);
      }
    },
    getByUser: (uid: string, callback: (msgs: AdminMessage[]) => void) => {
      if (!auth.currentUser) return () => {};
      const q = query(collection(firestore, 'messages'), where('recipientUid', '==', uid));
      return onSnapshot(q, (snapshot) => {
        const msgs: AdminMessage[] = [];
        snapshot.forEach(doc => msgs.push(doc.data() as AdminMessage));
        callback(msgs.sort((a, b) => b.timestamp - a.timestamp));
      }, (e) => {
        console.warn("Messages fetch failed (likely unauthenticated):", e.message);
      });
    },
    markAsRead: async (id: string) => {
      try {
        await updateDoc(doc(firestore, 'messages', id), { isRead: true });
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `messages/${id}`);
      }
    }
  },
  promotions: {
    getAll: (callback: (promos: Promotion[]) => void) => {
      return onSnapshot(collection(firestore, 'promotions'), (snapshot) => {
        const promos: Promotion[] = [];
        snapshot.forEach(doc => promos.push(doc.data() as Promotion));
        callback(promos.sort((a, b) => b.createdAt - a.createdAt));
      }, (e) => {
        console.warn("Promotions fetch failed (likely unauthenticated):", e.message);
      });
    },
    add: async (promo: Promotion) => {
      try {
        await setDoc(doc(firestore, 'promotions', promo.id), promo);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `promotions/${promo.id}`);
      }
    },
    delete: async (id: string) => {
      try {
        await deleteDoc(doc(firestore, 'promotions', id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `promotions/${id}`);
      }
    }
  }
};
