import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { migrateLegacyData } from './db/legacy';
import './index.css';

// Data of the local-only version moves into the synced database before the app reads anything.
migrateLegacyData()
  .catch((e) => console.error('Не удалось перенести старые данные', e))
  .then(() =>
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>,
    ),
  );
