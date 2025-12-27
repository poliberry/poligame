import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ConvexProviderWrapper } from './components/ConvexProvider';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConvexProviderWrapper>
      <HashRouter>
        <App />
      </HashRouter>
    </ConvexProviderWrapper>
  </React.StrictMode>
);


