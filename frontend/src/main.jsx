import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global error handlers to catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  // Suppress browser extension errors (they're not from our code)
  if (event.reason && event.reason.message && 
      event.reason.message.includes('message channel closed')) {
    // This is likely a browser extension error, ignore it
    event.preventDefault();
    return;
  }
  
  // Log other unhandled promise rejections for debugging
  console.error('Unhandled promise rejection:', event.reason);
  // Optionally prevent default to avoid console errors
  // event.preventDefault();
});

// Global error handler for general errors
window.addEventListener('error', (event) => {
  // Suppress browser extension errors
  if (event.message && event.message.includes('message channel closed')) {
    event.preventDefault();
    return;
  }
  
  console.error('Global error:', event.error);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
