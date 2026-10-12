import type { BookingFormState } from '@church/shared/types';
import { IndexedDbRepository } from './IndexedDbRepository';

export interface BookingDraft {
  key: string;
  form: BookingFormState;
  selectedRoomIds: number[];
  roomPurposes: Record<number, string>;
  bookingStep: number;
  bookingStarted: boolean;
  updatedAt: number;
  schemaVersion: 1;
}

export class BookingDraftRepository {
  private readonly storage: IndexedDbRepository<BookingDraft>;

  constructor() {
    this.storage = new IndexedDbRepository<BookingDraft>(
      'space-booking-app',
      'booking-drafts',
    );
  }

  find(key: string): Promise<BookingDraft | undefined> {
    return this.storage.get(key);
  }

  save(draft: BookingDraft): Promise<IDBValidKey> {
    return this.storage.put(draft);
  }

  remove(key: string): Promise<void> {
    return this.storage.delete(key);
  }
}
