export class IndexedDbRepository<T> {
  private readonly databaseName: string;
  private readonly storeName: string;
  private readonly version: number;
  private databasePromise?: Promise<IDBDatabase>;

  constructor(databaseName: string, storeName: string, version = 1) {
    this.databaseName = databaseName;
    this.storeName = storeName;
    this.version = version;
  }

  get(key: IDBValidKey): Promise<T | undefined> {
    return this.request('readonly', (store) => store.get(key));
  }

  put(value: T): Promise<IDBValidKey> {
    return this.request('readwrite', (store) => store.put(value));
  }

  delete(key: IDBValidKey): Promise<void> {
    return this.request('readwrite', (store) => store.delete(key));
  }

  private async request<TResult>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<TResult>,
  ): Promise<TResult> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(this.storeName, mode);
      const request = operation(transaction.objectStore(this.storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;

    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, this.version);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(this.storeName)) {
          database.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.databasePromise = undefined;
        reject(request.error);
      };
      request.onblocked = () => {
        this.databasePromise = undefined;
        reject(new Error('IndexedDB upgrade is blocked by another tab.'));
      };
    });

    return this.databasePromise;
  }
}
