import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './realtime.css'
import './responsive.css'
import './profile.css'
import './admin.css'
import './site-theme.css'
import './tailwind.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
