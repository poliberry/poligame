import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Overlay from './pages/Overlay';

function App() {
  return (
    <Routes>
      <Route path="/overlay" element={<Overlay />} />
      <Route path="*" element={<Overlay />} />
    </Routes>
  );
}

export default App;


