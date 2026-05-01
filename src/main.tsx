import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n/config';
import './index.css';
import './lib/monacoSetup';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
