import React from 'react';
// FIX: Changed import to a named import to match the export from App.tsx
import { App } from './App';
import { createRoot } from 'react-dom/client';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
