import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { reschedulePersistedReminders } from './lib/notifications';

// Reschedule any persisted event reminders from IndexedDB
reschedulePersistedReminders().catch(console.warn);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
