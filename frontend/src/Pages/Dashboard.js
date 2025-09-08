import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Dashboard.css'

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [userRole, setUserRole] = useState('user')
  const [loggedInUser, setLoggedInUser] = useState(null)
  const navigate = useNavigate()

  // ✅ Fetch user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser)
      setLoggedInUser(parsedUser)
      setUserRole(parsedUser.role || 'user') // Set role based on user data
    } else {
      navigate('/profile') // redirect if no user
    }
  }, [navigate])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleEmergencyClick = () => navigate('/')
  const handleProfile = () => navigate('/profile')
  const handleSettings = () => navigate('/settings')
  const handleLocation = () => navigate('/location')

  // Mock user emergencies
  const userEmergencies = [
    {
      id: 1,
      type: 'Medical',
      location: 'Green Park Colony',
      time: 'Today, 10:15 AM',
      status: 'Active',
      priority: 'High',
      dispatch: { unit: 'Ambulance 001', eta: '3 mins', arrival: 'Pending' },
    },
    {
      id: 2,
      type: 'Fire',
      location: 'Downtown Block C',
      time: 'Yesterday, 7:45 PM',
      status: 'Resolved',
      priority: 'Critical',
      dispatch: {
        unit: 'Fire Truck 002',
        eta: '6 mins',
        arrival: 'Arrived 7:51 PM',
      },
    },
    {
      id: 3,
      type: 'Accident',
      location: 'Highway Exit 21',
      time: 'Last Week',
      status: 'Resolved',
      priority: 'Medium',
      dispatch: {
        unit: 'Rescue Team 003',
        eta: '5 mins',
        arrival: 'Arrived on time',
      },
    },
  ]

  const activeUserEmergencies = userEmergencies.filter(
    (e) => e.status === 'Active' || e.status === 'Responding'
  )

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'status-active'
      case 'responding':
        return 'status-responding'
      case 'resolved':
        return 'status-resolved'
      default:
        return 'status-default'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'priority-critical'
      case 'high':
        return 'priority-high'
      case 'medium':
        return 'priority-medium'
      default:
        return 'priority-default'
    }
  }

  return (
    <div className="dashboard">
      {/* HEADER */}
      <header className="header">
        <div className="container header-content">
          <div className="logo-section">
            <div className="logo">
              <span className="shield-icon">🛡️</span>
            </div>
            <div className="logo-text">
              <h1>User Emergency Dashboard</h1>
              <p>Personalized Emergency Updates</p>
            </div>
          </div>

          <div className="header-info">
            <div className="user-info">
              <span className="welcome-text">
                Welcome, {loggedInUser?.name || 'Guest'}
              </span>
              <span
                className={`role-badge ${
                  userRole === 'user' ? 'user-role' : 'admin-role'
                }`}
              >
                {userRole}
              </span>
            </div>
            <div className="time-display">
              <span className="time">{currentTime.toLocaleTimeString()}</span>
              <span className="date">{currentTime.toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </header>

      {/* NAVIGATION */}
      <nav className="navigation">
        <div className="container nav-links">
          <button className="nav-link" onClick={handleEmergencyClick}>
            Report Emergency
          </button>
          <button className="nav-link" onClick={handleProfile}>
            Profile
          </button>
          <button className="nav-link" onClick={handleLocation}>
            Location
          </button>
          <button className="nav-link active">Dashboard</button>
          <button className="nav-link" onClick={handleSettings}>
            Settings
          </button>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      {/* ... SAME AS YOUR ORIGINAL CONTENT (NO CHANGES NEEDED) ... */}

      {/* FOOTER */}
      <footer className="footer">
        <div className="container footer-content">
          <p>© {new Date().getFullYear()} Emergency Response System</p>
          <p className="footer-subtitle">
            Last Updated: {currentTime.toLocaleString()}
          </p>
        </div>
      </footer>
    </div>
  )
}
