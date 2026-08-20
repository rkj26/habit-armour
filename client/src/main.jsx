import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import './index.css'
// After index.css on purpose: Tailwind's preflight resets line-height and
// font rules that KaTeX depends on, so KaTeX has to win the cascade.
import 'katex/dist/katex.min.css'
import App from './App.jsx'
import { Toaster } from '@/components/shadcn/sonner'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <App />
      <Toaster richColors position="bottom-right" />
    </ThemeProvider>
  </StrictMode>,
)
