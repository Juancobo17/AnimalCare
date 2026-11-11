import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './paneles.css'
import './cabecera.css'
import './inicio.css'
import './pantallas.css'
import './agendar.css'
import './toast.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
