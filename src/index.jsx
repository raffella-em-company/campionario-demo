import React from 'react';
import ReactDOM from 'react-dom/client';
import { Helmet } from 'react-helmet';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <Helmet>
      {/* favicon standard */}
      <link rel="icon" href="/icons/icon-512.png" />

      {/* manifest per Android/Chrome */}
      <link rel="manifest" href="/manifest.json" />
      <meta name="theme-color" content="#6c63ff" />

      {/* iOS “Aggiungi a Home” */}
      <link rel="apple-touch-icon" href="/icons/icon-512.png" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta
        name="apple-mobile-web-app-status-bar-style"
        content="black-translucent"
      />
    </Helmet>
    <App />
  </>
);
