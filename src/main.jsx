import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Archive from './pages/Archive.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Checkout from './pages/Checkout.jsx'
import Bedankt from './pages/Bedankt.jsx'
import Scanner from './pages/Scanner.jsx'

// Mollie redirect shim: converts ?order_id=xxx (real query param Mollie uses)
// into #/bedankt?order_id=xxx (hash router route) before React boots.
const _sp = new URLSearchParams(window.location.search)
const _orderId = _sp.get('order_id')
if (_orderId) {
  window.location.replace(
    window.location.origin + window.location.pathname + '#/bedankt?order_id=' + _orderId
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/archief" element={<Archive />} />
        <Route path="/dashboard/*" element={<Dashboard />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/bedankt" element={<Bedankt />} />
        <Route path="/scanner" element={<Scanner />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
)
