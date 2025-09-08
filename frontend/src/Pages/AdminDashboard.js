import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './AdminDashboard.css'

function AdminDashboard() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [adminData, setAdminData] = useState(null)
  const [systemStats, setSystemStats] = useState({
    totalUsers: 0,
    activeEmergencies: 0,
    totalCalls: 0,
    resolvedToday: 0,
  })
  const [recentEmergencies, setRecentEmergencies] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    // Load admin data and system statistics
    loadAdminData()
    loadSystemStats()
    loadRecentEmergencies()

    return () => clearInterval(timer)
  }, [])

  const loadAdminData = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      if (!token) {
        navigate('/admin/login')
        return
      }

      // Mock admin data - replace with actual API call
      setAdminData({
        id: 1,
        first_name: 'Admin',
        last_name: 'User',
        email_address: 'admin@emergency.com',
        last_login: new Date().toISOString(),
        calls_attended: 125,
      })
    } catch (error) {
      console.error('Error loading admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSystemStats = async () => {
    try {
      // Mock system stats - replace with actual API calls
      setSystemStats({
        totalUsers: 1247,
        activeEmergencies: 3,
        totalCalls: 89,
        resolvedToday: 12,
      })
    } catch (error) {
      console.error('Error loading system stats:', error)
    }
  }

  const loadRecentEmergencies = async () => {
    try {
      // Mock recent emergencies - replace with actual API call
      setRecentEmergencies([
        {
          id: 1,
          type: 'Medical',
          user_name: 'John Smith',
          location: 'Downtown Area',
          time: '5 mins ago',
          status: 'Active',
          priority: 'High',
        },
        {
          id: 2,
          type: 'Fire',
          user_name: 'Sarah Johnson',
          location: 'Residential Block',
          time: '12 mins ago',
          status: 'Responding',
          priority: 'Critical',
        },
        {
          id: 3,
          type: 'Police',
          user_name: 'Mike Davis',
          location: 'Shopping Mall',
          time: '25 mins ago',
          status: 'Resolved',
          priority: 'Medium',
        },
      ])
    } catch (error) {
      console.error('Error loading recent emergencies:', error)
    }
  }

  const handleProfile = () => {
    navigate('/admin/profile')
  }

  const handleSettings = () => {
    navigate('/admin/settings')
  }

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    navigate('/admin/login')
  }

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
      case 'low':
        return 'priority-low'
      default:
        return 'priority-default'
    }
  }

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>
        <p>Loading Admin Dashboard...</p>
      </div>
    )
  }

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <header className="admin-header">
        <div className="container">
          <div className="header-content">
            <div className="logo-section">
              <div className="admin-logo">
                <span className="admin-shield">🛡️</span>
              </div>
              <div className="logo-text">
                <h1>Admin Control Panel</h1>
                <p>Emergency Response Management</p>
              </div>
            </div>
            <div className="header-info">
              <div className="admin-info">
                <span className="welcome-text">
                  Welcome, {adminData?.first_name}
                </span>
                <span className="admin-badge">Administrator</span>
              </div>
              <div className="time-display">
                <span className="time">{currentTime.toLocaleTimeString()}</span>
                <span className="date">{currentTime.toLocaleDateString()}</span>
              </div>
              <div className="alert-indicator">
                <span className="alert-count">
                  {systemStats.activeEmergencies}
                </span>
                <span className="alert-text">Active</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="admin-navigation">
        <div className="container">
          <div className="nav-links">
            <button className="nav-link active">Dashboard</button>
            <button className="nav-link" onClick={handleProfile}>
              Profile
            </button>
            <button className="nav-link" onClick={handleSettings}>
              Settings
            </button>
            <button className="nav-link logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="admin-main">
        <div className="container">
          {/* System Statistics */}
          <section className="admin-stats-section">
            <h2>System Overview</h2>
            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <div className="stat-icon users-icon">👥</div>
                <div className="stat-content">
                  <h3>Total Users</h3>
                  <div className="stat-number">{systemStats.totalUsers}</div>
                  <p className="stat-change">Registered users</p>
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="stat-icon emergency-icon">🚨</div>
                <div className="stat-content">
                  <h3>Active Emergencies</h3>
                  <div className="stat-number">
                    {systemStats.activeEmergencies}
                  </div>
                  <p className="stat-change urgent">Requires attention</p>
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="stat-icon calls-icon">📞</div>
                <div className="stat-content">
                  <h3>Total Calls Today</h3>
                  <div className="stat-number">{systemStats.totalCalls}</div>
                  <p className="stat-change">Emergency calls</p>
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="stat-icon resolved-icon">✅</div>
                <div className="stat-content">
                  <h3>Resolved Today</h3>
                  <div className="stat-number">{systemStats.resolvedToday}</div>
                  <p className="stat-change positive">Successfully handled</p>
                </div>
              </div>
            </div>
          </section>

          {/* Admin Performance */}
          <section className="admin-performance">
            <div className="section-header">
              <h3>Your Performance</h3>
              <span className="performance-badge">Administrator</span>
            </div>
            <div className="performance-card">
              <div className="performance-stats">
                <div className="performance-item">
                  <span className="performance-label">Calls Attended</span>
                  <span className="performance-value">
                    {adminData?.calls_attended || 0}
                  </span>
                </div>
                <div className="performance-item">
                  <span className="performance-label">Last Login</span>
                  <span className="performance-value">
                    {adminData?.last_login
                      ? new Date(adminData.last_login).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
                <div className="performance-item">
                  <span className="performance-label">Account Status</span>
                  <span className="performance-value active-status">
                    Active
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Recent Emergencies */}
          <section className="admin-emergencies-section">
            <div className="section-header">
              <h3>Recent Emergency Reports</h3>
              <span className="status-indicator">Live Updates</span>
            </div>

            <div className="admin-emergencies-table">
              <div className="table-header">
                <div className="header-cell">Type</div>
                <div className="header-cell">User</div>
                <div className="header-cell">Location</div>
                <div className="header-cell">Time</div>
                <div className="header-cell">Status</div>
                <div className="header-cell">Priority</div>
                <div className="header-cell">Actions</div>
              </div>

              {recentEmergencies.map((emergency) => (
                <div key={emergency.id} className="table-row">
                  <div className="table-cell">
                    <div className="emergency-type">
                      {emergency.type === 'Medical' && (
                        <span className="type-icon">❤️</span>
                      )}
                      {emergency.type === 'Fire' && (
                        <span className="type-icon">🔥</span>
                      )}
                      {emergency.type === 'Police' && (
                        <span className="type-icon">👮</span>
                      )}
                      {emergency.type === 'Accident' && (
                        <span className="type-icon">🚗</span>
                      )}
                      {emergency.type}
                    </div>
                  </div>
                  <div className="table-cell">{emergency.user_name}</div>
                  <div className="table-cell">{emergency.location}</div>
                  <div className="table-cell">{emergency.time}</div>
                  <div className="table-cell">
                    <span
                      className={`status-badge ${getStatusColor(
                        emergency.status
                      )}`}
                    >
                      {emergency.status}
                    </span>
                  </div>
                  <div className="table-cell">
                    <span
                      className={`priority-badge ${getPriorityColor(
                        emergency.priority
                      )}`}
                    >
                      {emergency.priority}
                    </span>
                  </div>
                  <div className="table-cell">
                    <button className="action-btn view-btn">View</button>
                    <button className="action-btn update-btn">Update</button>
                  </div>
                </div>
              ))}
            </div>

            {recentEmergencies.length === 0 && (
              <div className="no-emergencies">
                <span className="no-data-icon">📋</span>
                <h4>No Recent Emergencies</h4>
                <p>All emergency reports will appear here</p>
              </div>
            )}
          </section>

          {/* Quick Actions */}
          <section className="admin-quick-actions">
            <h3>Quick Administrative Actions</h3>
            <div className="quick-actions-grid">
              <button className="quick-action-btn">📊 System Reports</button>
              <button className="quick-action-btn">🚨 Broadcast Alert</button>
              <button className="quick-action-btn">👥 User Management</button>
              <button className="quick-action-btn">📞 Call History</button>
              <button className="quick-action-btn">⚙️ System Settings</button>
              <button className="quick-action-btn">📈 Analytics</button>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="admin-footer">
        <div className="container">
          <div className="footer-content">
            <p>
              © {new Date().getFullYear()} Emergency Response Admin Panel |
              System Status: Online
            </p>
            <p className="footer-subtitle">
              Admin: {adminData?.email_address} | Last Updated:{' '}
              {currentTime.toLocaleString()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default AdminDashboard
