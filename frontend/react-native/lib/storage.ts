type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const memory = new Map<string, string>();
let cachedStorage: StorageLike | null | undefined;

const getStorage = async (): Promise<StorageLike | null> => {
  if (cachedStorage !== undefined) {
    return cachedStorage;
  }

  try {
    const mod = await import('@react-native-async-storage/async-storage');
    cachedStorage = mod.default as StorageLike;
    return cachedStorage;
  } catch {
    cachedStorage = null;
    return null;
  }
};

export const storage = {
  getItem: async (key: string) => {
    const store = await getStorage();
    if (store) {
      return store.getItem(key);
    }
    return memory.get(key) ?? null;
  },
  setItem: async (key: string, value: string) => {
    const store = await getStorage();
    if (store) {
      await store.setItem(key, value);
      return;
    }
    memory.set(key, value);
  },
  removeItem: async (key: string) => {
    const store = await getStorage();
    if (store) {
      await store.removeItem(key);
      return;
    }
    memory.delete(key);
  },
};
