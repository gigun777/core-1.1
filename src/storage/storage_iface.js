export function assertStorage(storage) {
  const methods = ['get', 'set', 'del'];
  for (const method of methods) {
    if (typeof storage?.[method] !== 'function') {
      throw new Error(`Storage adapter must implement ${method}(...)`);
    }
  }
}

export function createMemoryStorage(seed = {}) {
  const db = new Map(Object.entries(seed));
  return {
    async get(key) {
      return db.has(key) ? structuredClone(db.get(key)) : null;
    },
    async set(key, value) {
      db.set(key, structuredClone(value));
    },
    async del(key) {
      db.delete(key);
    },
    async list(prefix = '') {
      return [...db.entries()]
        .filter(([k]) => k.startsWith(prefix))
        .map(([key, value]) => ({ key, value: structuredClone(value) }));
    }
  };
}
