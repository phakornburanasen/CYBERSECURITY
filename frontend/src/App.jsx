import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import './HomePage.css'
import './LoginPage.css'
import HomePage from './HomePage'
import LoginPage from './LoginPage'
import ThreatIntel from './ThreatIntel'
import Analytics from './Analytics'

function App() {
  const [user, setUser] = useState(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    const token = localStorage.getItem('token')
    
    if (storedUser && token) {
      setUser(JSON.parse(storedUser))
    }
    setIsCheckingAuth(false)
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  if (isCheckingAuth) {
    return null; // ป้องกันการ render route ก่อนโหลดข้อมูลจาก localStorage
  }

  return (
    <Router basename="/CYBERSECURITY">
      <div className="cyber-login-container">
        <div className="cyber-grid"></div>
        <div className="cyber-particles"></div>
        
        <Routes>
          <Route 
            path="/login" 
            element={
              user ? <Navigate to="/homepage" /> : 
              <LoginPage onLogin={handleLogin} />
            } 
          />
          <Route 
            path="/homepage" 
            element={
              user ? <HomePage user={user} onLogout={handleLogout} /> : 
              <Navigate to="/login" />
            } 
          />
          <Route 
            path="/threat-intel" 
            element={
              user ? <ThreatIntel user={user} onLogout={handleLogout} /> : 
              <Navigate to="/login" />
            } 
          />
          <Route 
            path="/analytics" 
            element={
              user ? <Analytics user={user} onLogout={handleLogout} /> : 
              <Navigate to="/login" />
            } 
          />
          <Route 
            path="/" 
            element={<Navigate to={user ? "/homepage" : "/login"} />} 
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App
