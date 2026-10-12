import {
  BookingDraftRepository,
  type BookingDraft,
} from '../../repositories/BookingDraftRepository';

export class BookingDraftService {
  private readonly repository: BookingDraftRepository;

  constructor(repository: BookingDraftRepository) {
    this.repository = repository;
  }

  createKey(userEmail: string, branch: string): string {
    return `${userEmail.trim().toLowerCase()}::${branch}`;
  }

  load(key: string): Promise<BookingDraft | undefined> {
    return this.repository.find(key);
  }

  save(draft: Omit<BookingDraft, 'updatedAt' | 'schemaVersion'>): Promise<IDBValidKey> {
    return this.repository.save({
      ...draft,
      updatedAt: Date.now(),
      schemaVersion: 1,
    });
  }

  clear(key: string): Promise<void> {
    return this.repository.remove(key);
  }
}

export const bookingDraftService = new BookingDraftService(
  new BookingDraftRepository(),
);
