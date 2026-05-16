export async function register() {
  // Node.js 22+ expose un localStorage natif expérimental, mais sous forme d'objet
  // vide {} sans méthodes (getItem, setItem...) si --localstorage-file n'est pas fourni.
  // next-auth v4 appelle localStorage.getItem() → crash.
  // Ce polyfill remplace le localStorage cassé par une implémentation en mémoire.
  if (typeof globalThis.localStorage?.getItem !== "function") {
    const store: Record<string, string> = {};
    (globalThis as unknown as Record<string, unknown>).localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = String(value); },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
      key: (index: number) => Object.keys(store)[index] ?? null,
      get length() { return Object.keys(store).length; },
    };
  }
}
