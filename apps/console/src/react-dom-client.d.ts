declare module 'react-dom/client' {
  import type { ReactNode } from 'react';

  export interface Root {
    render(children: ReactNode): void;
    unmount(): void;
  }

  export interface RootOptions {
    identifierPrefix?: string;
    onCaughtError?: (error: unknown, errorInfo: unknown) => void;
    onRecoverableError?: (error: unknown, errorInfo: unknown) => void;
    onUncaughtError?: (error: unknown, errorInfo: unknown) => void;
  }

  export function createRoot(container: Element | DocumentFragment, options?: RootOptions): Root;
  export function hydrateRoot(
    container: Document | Element,
    initialChildren: ReactNode,
    options?: RootOptions,
  ): Root;
}
