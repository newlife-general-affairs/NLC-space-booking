import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from '@church/shared/auth'
import { pwaService } from './services/pwa/PwaService.ts'
import './features/pwa/installPrompt.ts'

// Prevent duplicate clicks globally
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    // Find closest button, link, role="button", element with cursor-pointer (except inputs), or submit inputs
    const clickable = target.closest('button, a, [role="button"], [class*="cursor-pointer"]:not(input), input[type="submit"], input[type="button"]');
    
    if (clickable) {
      // Check if it's explicitly allowed to fast-click
      if (
        clickable.hasAttribute('data-no-debounce') || 
        target.hasAttribute('data-no-debounce')
      ) {
        return;
      }
      
      // If it is already in cooldown, prevent the click
      if (clickable.getAttribute('data-double-click-prevented') === 'true') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      // If it has original disabled attribute or pointer-events none, do nothing
      if (
        clickable.hasAttribute('disabled') || 
        (clickable as HTMLElement).style.pointerEvents === 'none'
      ) {
        return;
      }
      
      // Set cooldown state
      clickable.setAttribute('data-double-click-prevented', 'true');
      
      const originalPointerEvents = (clickable as HTMLElement).style.pointerEvents;
      const originalOpacity = (clickable as HTMLElement).style.opacity;
      
      // Temporarily disable visually and pointer-wise
      (clickable as HTMLElement).style.pointerEvents = 'none';
      (clickable as HTMLElement).style.opacity = '0.6';
      
      setTimeout(() => {
        clickable.removeAttribute('data-double-click-prevented');
        if (clickable) {
          (clickable as HTMLElement).style.pointerEvents = originalPointerEvents;
          (clickable as HTMLElement).style.opacity = originalOpacity;
        }
      }, 2000); // 2000ms cooldown (2 seconds)
    }
  }, true); // capturing phase to intercept before React handlers
}

void pwaService.start()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)

