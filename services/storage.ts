
import { ChatSession, User, GeneratedImage } from '../types';
import bcrypt from 'bcryptjs';

const DB_KEYS = {
  ACTIVE_USER: 'daadir_auth_v4',
  LEGACY_USERS: 'daadir_users_v4',
  LEGACY_SESSIONS: 'daadir_sessions_v4',
  LEGACY_IMAGES: 'daadir_images_v4'
};

const IDB_CONFIG = {
  NAME: 'DaadirAI_Permanent_DB',
  VERSION: 3,
  STORES: {
    IMAGES: 'images',
    USERS: 'users',
    SESSIONS: 'sessions'
  }
};

let dbPromise: Promise<IDBDatabase> | null = null;

const getDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_CONFIG.NAME, IDB_CONFIG.VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_CONFIG.STORES.IMAGES)) {
        db.createObjectStore(IDB_CONFIG.STORES.IMAGES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(IDB_CONFIG.STORES.USERS)) {
        db.createObjectStore(IDB_CONFIG.STORES.USERS, { keyPath: 'email' });
      }
      if (!db.objectStoreNames.contains(IDB_CONFIG.STORES.SESSIONS)) {
        db.createObjectStore(IDB_CONFIG.STORES.SESSIONS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
};

export const storage = {
  // Request the browser to keep data forever
  requestPersistence: async () => {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      console.log(`Storage persistence: ${isPersisted ? 'Permanent' : 'Temporary'}`);
      return isPersisted;
    }
    return false;
  },

  getUsers: async (): Promise<User[]> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_CONFIG.STORES.USERS, 'readonly');
      const store = tx.objectStore(IDB_CONFIG.STORES.USERS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  registerUser: async (user: User, rawPassword?: string): Promise<void> => {
    const db = await getDB();
    const users = await storage.getUsers();
    
    let passwordHash: string | undefined;
    if (rawPassword) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(rawPassword, salt);
    }

    const userData = { 
      ...user, 
      passwordHash: passwordHash || user.passwordHash,
      strikes: user.strikes || 0,
      banUntil: user.banUntil || 0
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_CONFIG.STORES.USERS, 'readwrite');
      const store = tx.objectStore(IDB_CONFIG.STORES.USERS);
      store.put(userData);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  authenticate: async (email: string, rawPassword?: string): Promise<User | null> => {
    const users = await storage.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) return null;

    if (user.passwordHash && rawPassword) {
      const isMatch = await bcrypt.compare(rawPassword, user.passwordHash);
      if (!isMatch) return null;
    }

    const { passwordHash: _, ...publicUser } = user;
    return publicUser as User;
  },

  setActiveUser: (user: User | null) => {
    if (user) {
      localStorage.setItem(DB_KEYS.ACTIVE_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(DB_KEYS.ACTIVE_USER);
    }
  },

  getActiveUser: (): User | null => {
    try {
      const item = localStorage.getItem(DB_KEYS.ACTIVE_USER);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      return null;
    }
  },

  getSessions: async (userId: string): Promise<ChatSession[]> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_CONFIG.STORES.SESSIONS, 'readonly');
      const store = tx.objectStore(IDB_CONFIG.STORES.SESSIONS);
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result as ChatSession[];
        resolve(all
          .filter(s => s.userId === userId)
          .sort((a, b) => b.updatedAt - a.updatedAt));
      };
      request.onerror = () => reject(request.error);
    });
  },

  saveSession: async (session: ChatSession): Promise<void> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_CONFIG.STORES.SESSIONS, 'readwrite');
      const store = tx.objectStore(IDB_CONFIG.STORES.SESSIONS);
      store.put({ ...session, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  deleteSession: async (id: string): Promise<void> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_CONFIG.STORES.SESSIONS, 'readwrite');
      const store = tx.objectStore(IDB_CONFIG.STORES.SESSIONS);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  getImages: async (userId: string): Promise<GeneratedImage[]> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_CONFIG.STORES.IMAGES, 'readonly');
      const store = tx.objectStore(IDB_CONFIG.STORES.IMAGES);
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result as GeneratedImage[];
        resolve(all.filter(img => img.userId === userId).sort((a, b) => b.timestamp - a.timestamp));
      };
      request.onerror = () => reject(request.error);
    });
  },

  saveImage: async (image: GeneratedImage): Promise<void> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_CONFIG.STORES.IMAGES, 'readwrite');
      const store = tx.objectStore(IDB_CONFIG.STORES.IMAGES);
      store.put(image);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};
