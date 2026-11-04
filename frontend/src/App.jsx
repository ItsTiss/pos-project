import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import Inventory from './pages/Inventory';
import Checkout from './pages/Checkout';

export default function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/inventory">Inventory</Link>
        <Link to="/checkout">Checkout</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/inventory" replace />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/checkout" element={<Checkout />} />
      </Routes>
    </BrowserRouter>
  );
}
