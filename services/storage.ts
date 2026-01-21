import { ChatSession, User, GeneratedImage } from '../types';
import bcrypt from 'bcryptjs';

const DB_KEYS = {
  ACTIVE_USER: 'daadir_auth_v4',
  LEGACY_USERS: 'daadir_users_v4',
  LEGACY_SESSIONS: 'daadir_sessions_v4',
  LEGACY_IMAGES: 'daadir_images_v4'
};

const IDB_CONFIG = {
  NAME: 'DaadirAI_DB_v2',
  VERSION: 2,
  STORES: {
    IMAGES: 'images',
    USERS: 'users',
    SESSIONS: 'sessions'
  }
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
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
      
      // Migration from old localStorage keys if upgrading
      if (event.oldVersion < 2) {
        console.log("Database upgrade: Migrating legacy data...");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const storage = {
  // Migration helper to move data from localStorage to IDB
  migrateLegacyData: async () => {
    const db = await getDB();
    
    // Migrate Users
    const legacyUsers = localStorage.getItem(DB_KEYS.LEGACY_USERS);
    if (legacyUsers) {
      try {
        const users = JSON.parse(legacyUsers) as User[];
        const tx = db.transaction(IDB_CONFIG.STORES.USERS, 'readwrite');
        const store = tx.objectStore(IDB_CONFIG.STORES.USERS);
        users.forEach(u => store.put(u));
        localStorage.removeItem(DB_KEYS.LEGACY_USERS);
      } catch (e) { console.error("User migration failed", e); }
    }

    // Migrate Sessions
    const legacySessions = localStorage.getItem(DB_KEYS.LEGACY_SESSIONS);
    if (legacySessions) {
      try {
        const sessions = JSON.parse(legacySessions) as ChatSession[];
        const tx = db.transaction(IDB_CONFIG.STORES.SESSIONS, 'readwrite');
        const store = tx.objectStore(IDB_CONFIG.STORES.SESSIONS);
        sessions.forEach(s => store.put(s));
        localStorage.removeItem(DB_KEYS.LEGACY_SESSIONS);
      } catch (e) { console.error("Session migration failed", e); }
    }
  },

  getUsers: async (): Promise<User[]> => {
    await storage.migrateLegacyData();
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_CONFIG.STORES.USERS, 'readonly');
      const store = tx.objectStore(IDB_CONFIG.STORES.USERS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  isUsernameTaken: async (username: string): Promise<boolean> => {
    const users = await storage.getUsers();
    return users.some(u => u.username?.toLowerCase() === username.toLowerCase());
  },

  registerUser: async (user: User, rawPassword?: string): Promise<void> => {
    await delay(300); 
    const db = await getDB();
    const users = await storage.getUsers();
    
    if (user.username && users.some(u => u.username.toLowerCase() === user.username.toLowerCase() && u.email !== user.email)) {
      throw new Error("Username already taken.");
    }

    let passwordHash: string | undefined;
    if (rawPassword) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(rawPassword, salt);
    }

    const existingUser = users.find(u => u.email.toLowerCase() === user.email.toLowerCase());
    const userData = { 
      ...user, 
      passwordHash: passwordHash || existingUser?.passwordHash,
      strikes: existingUser?.strikes || 0,
      banUntil: existingUser?.banUntil || 0
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_CONFIG.STORES.USERS, 'readwrite');
      const store = tx.objectStore(IDB_CONFIG.STORES.USERS);
      store.put(userData);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  updateUser: async (userId: string, updates: Partial<User>): Promise<void> => {
    const users = await storage.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const updatedUser = { ...user, ...updates };
    const db = await getDB();
    
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_CONFIG.STORES.USERS, 'readwrite');
      const store = tx.objectStore(IDB_CONFIG.STORES.USERS);
      store.put(updatedUser);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    
    const active = storage.getActiveUser();
    if (active && active.id === userId) {
      const { passwordHash, privateHistoryPasswordHash, ...cleanUser } = updatedUser as any;
      storage.setActiveUser(cleanUser);
    }
  },

  authenticate: async (email: string, rawPassword?: string): Promise<User | null> => {
    await delay(400); 
    const users = await storage.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) return null;

    if (user.banUntil && user.banUntil > Date.now()) {
      throw new Error(`Account suspended until ${new Date(user.banUntil).toLocaleDateString()}.`);
    }

    if (user.passwordHash && rawPassword) {
      const isMatch = await bcrypt.compare(rawPassword, user.passwordHash);
      if (!isMatch) return null;
    } else if (user.passwordHash && !rawPassword) {
      return null;
    }

    const { passwordHash: _, privateHistoryPasswordHash: __, ...publicUser } = user;
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

  getSessions: async (userId: string, isPrivate: boolean = false): Promise<ChatSession[]> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_CONFIG.STORES.SESSIONS, 'readonly');
      const store = tx.objectStore(IDB_CONFIG.STORES.SESSIONS);
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result as ChatSession[];
        resolve(all
          .filter(s => s.userId === userId && (isPrivate ? s.isPrivate === true : !s.isPrivate))
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