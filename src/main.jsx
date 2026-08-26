import { StrictMode } from 'react'
// Vercel Web Analytics. Patches history.pushState, so client-side
// navigation is reported without any per-route wiring.
inject()

import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { inject } from '@vercel/analytics'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
