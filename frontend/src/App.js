import React, { useState, useEffect } from 'react'
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  useLocation,
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
import AdminProfile from './Pages/AdminProfile'
import AdminSettings from './Pages/AdminSettings'
import DispatchRegister from './Pages/DispatchRegister'
import DispatchDashboard from './Pages/DispatchDashboard'
import DispatchProfile from './Pages/DispatchProfile'
import 'leaflet/dist/leaflet.css'

// Debug component to track navigation
function NavigationDebug() {
  const location = useLocation()

  useEffect(() => {
    console.log('Navigation to:', location.pathname)
  }, [location])

  return null
}

function App() {
  const [userType, setUserType] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    console.log('App useEffect - checking userType')

    // Add a small delay to prevent immediate redirects
    setTimeout(() => {
      const storedUserType = localStorage.getItem('userType')
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('adminToken') ||
        localStorage.getItem('dispatchToken')

      console.log('Stored userType:', storedUserType)
      console.log('Token exists:', !!token)

      if (storedUserType && token) {
        setUserType(storedUserType)
        console.log('Setting userType to:', storedUserType)
      } else {
        console.log('No valid auth, clearing storage')
        localStorage.removeItem('userType')
        localStorage.removeItem('token')
        localStorage.removeItem('adminToken')
        localStorage.removeItem('dispatchToken')
        localStorage.removeItem('user')
        setUserType('guest') // Use 'guest' instead of null
      }

      setIsLoading(false)
    }, 100)
  }, [])

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background:
            'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f172a 100%)',
          color: 'white',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        Loading...
      </div>
    )
  }

  console.log('Rendering App with userType:', userType)

  return (
    <Router>
      <NavigationDebug />
      <Routes>
        {/* Always accessible routes */}
        <Route path="/register" element={<Register />} />
        <Route path="/dispatchregister" element={<DispatchRegister />} />
        <Route path="/login" element={<Login />} />

        {userType === 'admin' ? (
          <>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
            <Route path="/admin-profile" element={<AdminProfile />} />
            <Route path="/admin-settings" element={<AdminSettings />} />
          </>
        ) : userType === 'dispatch' ? (
          <>
            <Route path="/" element={<DispatchDashboard />} />
            <Route path="/dispatch-dashboard" element={<DispatchDashboard />} />
            <Route path="/dispatch-profile" element={<DispatchProfile />} />
          </>
        ) : userType === 'user' ? (
          <>
            <Route path="/" element={<HomePage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/location" element={<Location />} />
            <Route path="/chat" element={<ChatPage />} />
          </>
        ) : (
          <>
            {/* Guest user - only login/register available */}
            <Route path="/" element={<Login />} />
            <Route path="*" element={<Login />} />
          </>
        )}
      </Routes>
    </Router>
  )
}

export default App
