# Frontend and PWA architecture

## Folder structure

```text
apps/member/
?? src/
?  ?? components/                  # Reusable presentation components
?  ?? pages/                       # Page composition
?  ?? hooks/                       # React state adapters
?  ?? services/
?  ?  ?? booking/
?  ?  ?  ?? BookingDraftService.ts # Draft use cases
?  ?  ?? pwa/
?  ?     ?? PwaService.ts          # Service Worker registration
?  ?? repositories/
?  ?  ?? IndexedDbRepository.ts    # Generic IndexedDB access
?  ?  ?? BookingDraftRepository.ts # Booking draft persistence
?  ?? lib/                         # Existing API adapter and shared types
?? public/
?  ?? sw.js                        # Worker lifecycle coordinator only
?  ?? sw/
?  ?  ?? config.js                 # Cache names and precache policy
?  ?  ?? services/
?  ?     ?? cache-manager.js       # Cache First / Network First behavior
?  ?? manifest.webmanifest
?? docs/PWA_ARCHITECTURE.md
```

## Dependency direction

```text
React page ? hook ? application service ? repository ? IndexedDB / API
                        ?
                    PwaService

sw.js ? CacheManager ? Cache Storage
```

The browser page and Service Worker are different runtimes. React code registers the
worker through `PwaService`, while `sw.js` only coordinates lifecycle and fetch
events. Cache mechanics stay inside `CacheManager`.

## Safety policy

| Data or request | Policy |
| --- | --- |
| App shell, JavaScript, CSS, images, fonts | Cache First after first load |
| Navigation | Network First with cached app-shell fallback |
| Every `/api/*` request | Network Only |
| Booking form | Debounced IndexedDB draft |
| Availability check | Online, repeated immediately before submit |
| Booking mutation | Online only; never queued or replayed |

A booking draft is not a reservation. Restoring a draft must never imply that the
room is still available. The submit button is disabled offline and the backend
remains the final authority for conflict checks.

An `OfflineSyncManager` is intentionally not used for reservations. Automatic
replay can create stale or duplicate bookings until the backend provides an atomic
booking transaction, a database-level overlap constraint, and persisted
idempotency keys.

## Service Worker lifecycle

- `install`: precaches only the minimal shell.
- `activate`: deletes old caches that share this app's prefix and claims clients.
- `fetch`: ignores APIs, uses Network First for navigation, and Cache First for
  same-origin static resources.
- No `sync` listener is registered because booking writes are online-only.

Increment `CACHE_VERSION` in `public/sw/config.js` when the shell caching policy
changes. Keep route decisions declarative and keep endpoint business rules outside
`sw.js`.
