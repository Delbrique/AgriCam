import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './components/ThemeProvider';
import { TraductionProvider } from './lib/traduction';
import './styles/tokens.css';
import './styles/tailwind.css';

createRoot(document.getElementById('racine')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <TraductionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </TraductionProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
