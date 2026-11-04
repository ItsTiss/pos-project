import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';

// TODO(Task 6/7): replace these placeholders with the real Inventory and
// Checkout page components once those tasks land.
function Inventory() {
  return <div />;
}

function Checkout() {
  return <div />;
}

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
