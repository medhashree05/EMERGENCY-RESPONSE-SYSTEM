import React, { useState, useEffect } from 'react'
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from 'react-router-dom'
import HomePage from './Pages/HomePage'
import Register from './Pages/Register'
import Login from './Pages/Login'
import Profile from './Pages/Profile'
import Dashboard from './Pages/Dashboard'
import Location from './Pages/Location'
import Settings from './Pages/Settings'
import ChatPage from './Pages/ChatPage'
import AdminDashboard from './Pages/AdminDashboard'
import 'leaflet/dist/leaflet.css'

function App() {
  const [userType, setUserType] = useState(null)

  // Simulate fetching userType (you can replace this with real auth logic)
  useEffect(() => {
    const storedUserType = localStorage.getItem('userType') // assume 'admin' or 'user'
    if (storedUserType) {
      setUserType(storedUserType)
    } else {
      setUserType('user') // fallback
    }
  }, [])

  if (!userType) return <div>Loading...</div> // Prevents flicker before userType is set

  return (
    <Router>
      <Routes>
        {/* Common Routes */}
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/chat" element={<ChatPage />} />

        {userType === 'admin' ? (
          <>
            <Route path="/" element={<Navigate to="/admin-dashboard" />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
            <Route path="/settings" element={<Settings />} />
          </>
        ) : (
          <>
            <Route path="/" element={<HomePage />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/location" element={<Location />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
          </>
        )}

        {/* Catch-all route */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  )
}

export default App
