/* In-browser model loader (staged for the TRAINED weights).
   Status today: the net is still distilling on the server, so this module
   intentionally does NOT run inference yet — it provides the IndexedDB weight
   cache + status API the future ONNX/WASM runtime will plug into. The game
   keeps using the server engine (same model, honest about where it runs). */
const DB = 'cfllm-model', STORE = 'weights';
export const ModelLoader = {
  status: 'awaiting-trained-weights',
  open() {
    return new Promise((res, rej) => {
      const q = indexedDB.open(DB, 1);
      q.onupgradeneeded = () => q.result.createObjectStore(STORE);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
  },
  async cachedVersion() {
    try {
      const db = await this.open();
      return await new Promise(res => {
        const tx = db.transaction(STORE).objectStore(STORE).get('version');
        tx.onsuccess = () => res(tx.result || null);
      });
    } catch { return null; }
  },
  async health() {
    try {
      const h = await (await fetch('/api/health')).json();
      return { serverTrained: !!h.trained, params: h.params, browser: this.status };
    } catch {
      return { serverTrained: false, params: 0, browser: this.status, offline: true };
    }
  },
};
