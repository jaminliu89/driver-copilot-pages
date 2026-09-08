const DB = "driver-copilot-v1";
export function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("snapshots", { keyPath: "contentKey" });
      r.result.createObjectStore("settings");
      r.result.createObjectStore("shared");
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function transact(name, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    let result, requestError;
    try {
      result = fn(tx.objectStore(name));
      if (result)
        result.addEventListener("error", () => {
          requestError = result.error;
        });
    } catch (e) {
      db.close();
      reject(e);
      return;
    }
    tx.oncomplete = () => {
      db.close();
      resolve(result?.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || requestError || new Error("本机数据库操作失败"));
    };
    tx.onabort = tx.onerror;
  });
}
export const allSnapshots = () =>
  transact("snapshots", "readonly", (s) => s.getAll());
export async function saveSnapshot(record) {
  if (!record.canSave || !record.period || !record.contentKey)
    throw new Error("快照未通过核对");
  return transact("snapshots", "readwrite", (s) => s.add(record));
}
export const removeSnapshot = (key) =>
  transact("snapshots", "readwrite", (s) => s.delete(key));
export const setting = (key) =>
  transact("settings", "readonly", (s) => s.get(key));
export const setSetting = (key, value) =>
  transact("settings", "readwrite", (s) => s.put(value, key));
export async function clearPrivate() {
  for (const s of ["snapshots", "settings", "shared"])
    await transact(s, "readwrite", (x) => x.clear());
}
export async function consumeShared() {
  const blob = await transact("shared", "readonly", (s) => s.get("pending"));
  await transact("shared", "readwrite", (s) => s.delete("pending"));
  return blob;
}
