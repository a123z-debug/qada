import {StrictMode, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

function FrontendGuard() {
  useEffect(() => {
    const blockEvent = (event: Event) => event.preventDefault();
    const blockShortcut = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const developerTools = event.key === 'F12' ||
        (event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(key)) ||
        (event.ctrlKey && key === 'u');
      const copying = (event.ctrlKey || event.metaKey) && ['c', 'x', 'a', 's', 'p'].includes(key);

      if (developerTools || copying) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('contextmenu', blockEvent);
    document.addEventListener('copy', blockEvent);
    document.addEventListener('cut', blockEvent);
    document.addEventListener('dragstart', blockEvent);
    document.addEventListener('keydown', blockShortcut, true);

    return () => {
      document.removeEventListener('contextmenu', blockEvent);
      document.removeEventListener('copy', blockEvent);
      document.removeEventListener('cut', blockEvent);
      document.removeEventListener('dragstart', blockEvent);
      document.removeEventListener('keydown', blockShortcut, true);
    };
  }, []);

  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FrontendGuard />
    <App />
  </StrictMode>,
);
