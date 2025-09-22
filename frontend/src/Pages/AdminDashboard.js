import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
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
  const [availableEmergencies, setAvailableEmergencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [emergenciesLoading, setEmergenciesLoading] = useState(false)
  const [acceptingEmergency, setAcceptingEmergency] = useState(null)
  const [showAvailableCases, setShowAvailableCases] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    loadAdminData()
    loadSystemStats()
    loadRecentEmergencies()
    loadAvailableEmergencies()

    // Set up real-time subscription for emergencies
    const emergenciesSubscription = supabase
      .channel('emergencies_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'emergencies' },
        (payload) => {
          console.log('Emergency data changed:', payload)
          loadRecentEmergencies()
          loadAvailableEmergencies()
          loadSystemStats()
        }
      )
      .subscribe()

    return () => {
      clearInterval(timer)
      emergenciesSubscription.unsubscribe()
    }
  }, [])

  const loadAdminData = async () => {
    try {
      const token =
        localStorage.getItem('adminToken') || localStorage.getItem('token')
      if (!token) {
        navigate('/login')
        return
      }

      const { data, error } = await supabase
        .from('admin')
        .select(
          'id, first_name, last_name, email_address, last_login, calls_attended'
        )
        .single()

      if (error) {
        console.error('Error fetching admin:', error)
        return
      }

      setAdminData(data)
    } catch (error) {
      console.error('Error loading admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSystemStats = async () => {
    try {
      const { count: totalUsers, error: usersError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      if (usersError) {
        console.error('Error fetching users count:', usersError)
      }

      const { count: activeEmergencies, error: activeError } = await supabase
        .from('emergencies')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Reported', 'responding', 'pending'])

      if (activeError) {
        console.error('Error fetching active emergencies:', activeError)
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { count: totalCalls, error: callsError } = await supabase
        .from('emergencies')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())

      if (callsError) {
        console.error("Error fetching today's calls:", callsError)
      }

      const { count: resolvedToday, error: resolvedError } = await supabase
        .from('emergencies')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'resolved')
        .gte('updated_at', today.toISOString())

      if (resolvedError) {
        console.error('Error fetching resolved emergencies:', resolvedError)
      }

      setSystemStats({
        totalUsers: totalUsers || 0,
        activeEmergencies: activeEmergencies || 0,
        totalCalls: totalCalls || 0,
        resolvedToday: resolvedToday || 0,
      })
    } catch (error) {
      console.error('Error loading system stats:', error)
    }
  }

  const loadRecentEmergencies = async () => {
    try {
      setEmergenciesLoading(true)

      const { data: emergencies, error } = await supabase
        .from('emergencies')
        .select(
          `
          *,
          users (
            first_name,
            last_name,
            phone_number
          )
        `
        )
        .order('reported_time', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error fetching emergencies:', error)
        return
      }

      const formattedEmergencies =
        emergencies?.map((emergency) => ({
          id: emergency.id,
          type: emergency.type || emergency.emergency_type || 'Unknown',
          user_name: emergency.users
            ? `${emergency.users.first_name} ${emergency.users.last_name}`
            : 'Unknown User',
          user_phone: emergency.users?.phone_number || 'N/A',
          location: emergency.location || 'Unknown Location',
          time: formatTimeAgo(emergency.created_at),
          status: emergency.status || 'Unknown',
          priority: emergency.priority || 'Medium',
          handled_by: emergency.handled_by || 'Unassigned',
          created_at: emergency.created_at,
          rawData: emergency,
        })) || []

      setRecentEmergencies(formattedEmergencies)
    } catch (error) {
      console.error('Error loading recent emergencies:', error)
    } finally {
      setEmergenciesLoading(false)
    }
  }

  const loadAvailableEmergencies = async () => {
    try {
      // Priority order: Critical, High, Medium, Low
      const priorityOrder = {
        Critical: 4,
        High: 3,
        Medium: 2,
        Low: 1,
      }

      const { data: emergencies, error } = await supabase
        .from('emergencies')
        .select(
          `
          *,
          users (
            first_name,
            last_name,
            phone_number
          )
        `
        )
        .eq('status', 'Reported')
        .is('handled_by', null)
        .order('created_at', { ascending: true })
        .limit(10)

      if (error) {
        console.error('Error fetching available emergencies:', error)
        return
      }

      // Sort by priority (Critical first) and then by time
      const sortedEmergencies =
        emergencies
          ?.sort((a, b) => {
            const priorityA = priorityOrder[a.priority] || 0
            const priorityB = priorityOrder[b.priority] || 0

            if (priorityA !== priorityB) {
              return priorityB - priorityA // Higher priority first
            }

            // If same priority, sort by time (oldest first)
            return new Date(a.created_at) - new Date(b.created_at)
          })
          .slice(0, 5) || []

      const formattedEmergencies = sortedEmergencies.map((emergency) => ({
        id: emergency.id,
        type: emergency.type || emergency.emergency_type || 'Unknown',
        user_name: emergency.users
          ? `${emergency.users.first_name} ${emergency.users.last_name}`
          : 'Unknown User',
        user_phone: emergency.users?.phone_number || 'N/A',
        location: emergency.location || 'Unknown Location',
        time: formatTimeAgo(emergency.created_at),
        priority: emergency.priority || 'Medium',
        created_at: emergency.created_at,
        rawData: emergency,
      }))

      setAvailableEmergencies(formattedEmergencies)
    } catch (error) {
      console.error('Error loading available emergencies:', error)
    }
  }

  const formatTimeAgo = (timestamp) => {
    const now = new Date()
    const emergencyTime = new Date(timestamp)
    const diffInMinutes = Math.floor((now - emergencyTime) / (1000 * 60))

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes} mins ago`

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours} hours ago`

    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays} days ago`
  }

  const handleAcceptEmergency = async (emergencyId) => {
    if (!adminData?.id) {
      alert('Admin data not loaded. Please refresh and try again.')
      return
    }

    setAcceptingEmergency(emergencyId)

    try {
      // Use a transaction-like approach to prevent race conditions
      const { data: currentEmergency, error: fetchError } = await supabase
        .from('emergencies')
        .select('status, handled_by')
        .eq('id', emergencyId)
        .single()

      if (fetchError) {
        throw new Error('Failed to fetch current emergency status')
      }

      // Check if already accepted by someone else
      if (
        currentEmergency.status !== 'Reported' ||
        currentEmergency.handled_by !== null
      ) {
        alert('This emergency has already been accepted by another admin.')
        loadAvailableEmergencies()
        loadRecentEmergencies()
        return
      }

      // Attempt to update the emergency
      const { data: updatedEmergency, error: updateError } = await supabase
        .from('emergencies')
        .update({
          status: 'Accepted',
          handled_by: `${adminData.first_name} ${adminData.last_name}`,
          admin_id: adminData.id,
          accepted_at: new Date().toISOString(),
        })
        .eq('id', emergencyId)
        .eq('status', 'Reported') // Only update if still in 'Reported' status
        .is('handled_by', null) // Only update if not handled by anyone
        .select()

      if (updateError) {
        throw new Error('Failed to accept emergency')
      }

      if (!updatedEmergency || updatedEmergency.length === 0) {
        alert(
          'This emergency was just accepted by another admin. Please try another case.'
        )
        loadAvailableEmergencies()
        loadRecentEmergencies()
        return
      }

      // Update admin's calls_attended count
      await supabase
        .from('admin')
        .update({
          calls_attended: (adminData.calls_attended || 0) + 1,
        })
        .eq('id', adminData.id)

      alert('Emergency case accepted successfully!')

      // Refresh all data
      loadAvailableEmergencies()
      loadRecentEmergencies()
      loadSystemStats()
      loadAdminData()
    } catch (error) {
      console.error('Error accepting emergency:', error)
      alert('Failed to accept emergency. Please try again.')
    } finally {
      setAcceptingEmergency(null)
    }
  }

  const handleEmergencyAction = async (emergencyId, action) => {
    try {
      if (action === 'view') {
        console.log('Viewing emergency:', emergencyId)
        // Implement detailed view
      } else if (action === 'update') {
        console.log('Updating emergency:', emergencyId)
        // Implement status update
      }
    } catch (error) {
      console.error('Error handling emergency action:', error)
    }
  }

  const refreshEmergencies = () => {
    loadRecentEmergencies()
    loadAvailableEmergencies()
    loadSystemStats()
  }

  const handleProfile = () => {
    navigate('/admin-profile')
  }

  const handleSettings = () => {
    navigate('/admin-settings')
  }

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('userType')
    navigate('/login')
  }

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'admin-status-active'
      case 'accepted':
        return 'admin-status-accepted'
      case 'responding':
        return 'admin-status-responding'
      case 'resolved':
        return 'admin-status-resolved'
      case 'pending':
        return 'admin-status-pending'
      case 'reported':
        return 'admin-status-reported'
      default:
        return 'admin-status-default'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'admin-priority-critical'
      case 'high':
        return 'admin-priority-high'
      case 'medium':
        return 'admin-priority-medium'
      case 'low':
        return 'admin-priority-low'
      default:
        return 'admin-priority-default'
    }
  }

  const getEmergencyTypeIcon = (type) => {
    switch (type.toLowerCase()) {
      case 'medical':
        return '❤️'
      case 'fire':
        return '🔥'
      case 'police':
        return '👮'
      case 'accident':
        return '🚗'
      case 'natural disaster':
        return '🌪️'
      default:
        return '🚨'
    }
  }

  if (loading) {
    return (
      <div className="admin-admin-loading">
        <div className="admin-loading-spinner"></div>
        <p>Loading Admin Dashboard...</p>
      </div>
    )
  }

  return (
    <div className="admin-admin-dashboard">
      {/* Header - Same for all admin pages */}
      <header className="admin-admin-header">
        <div className="admin-admin-container">
          <div className="admin-header-content">
            <div className="admin-logo-section">
              <div className="admin-admin-logo">
                <span className="admin-admin-shield">🛡️</span>
              </div>
              <div className="admin-logo-text">
                <h1>Admin Control Panel</h1>
                <p>Emergency Response Management</p>
              </div>
            </div>
            <div className="admin-header-info">
              <div className="admin-admin-info">
                <span className="admin-welcome-text">
                  Welcome, {adminData?.first_name}
                </span>
                <span className="admin-admin-badge">Administrator</span>
              </div>
              <div className="admin-time-display">
                <span className="admin-time">
                  {currentTime.toLocaleTimeString()}
                </span>
                <span className="admin-date">
                  {currentTime.toLocaleDateString()}
                </span>
              </div>
              <div className="admin-alert-indicator">
                <span className="admin-alert-count">
                  {systemStats.activeEmergencies}
                </span>
                <span className="admin-alert-text">Active</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="admin-admin-navigation">
        <div className="admin-admin-container">
          <div className="admin-nav-links">
            <button className="admin-nav-link admin-active">Dashboard</button>
            <button className="admin-nav-link" onClick={handleProfile}>
              Profile
            </button>
            <button className="admin-nav-link" onClick={handleSettings}>
              Settings
            </button>
            <button
              className="admin-nav-link admin-logout-btn"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="admin-admin-main">
        <div className="admin-admin-container">
          {/* System Statistics */}
          <section className="admin-admin-stats-section">
            <h2>System Overview</h2>
            <div className="admin-admin-stats-grid">
              <div className="admin-admin-stat-card">
                <div className="admin-stat-icon admin-users-icon">👥</div>
                <div className="admin-stat-content">
                  <h3>Total Users</h3>
                  <div className="admin-stat-number">
                    {systemStats.totalUsers}
                  </div>
                  <p className="admin-stat-change">Registered users</p>
                </div>
              </div>

              <div className="admin-admin-stat-card">
                <div className="admin-stat-icon admin-emergency-icon">🚨</div>
                <div className="admin-stat-content">
                  <h3>Active Emergencies</h3>
                  <div className="admin-stat-number">
                    {systemStats.activeEmergencies}
                  </div>
                  <p className="admin-stat-change admin-urgent">
                    Requires attention
                  </p>
                </div>
              </div>

              <div className="admin-admin-stat-card">
                <div className="admin-stat-icon admin-calls-icon">📞</div>
                <div className="admin-stat-content">
                  <h3>Total Calls Today</h3>
                  <div className="admin-stat-number">
                    {systemStats.totalCalls}
                  </div>
                  <p className="admin-stat-change">Emergency calls</p>
                </div>
              </div>

              <div className="admin-admin-stat-card">
                <div className="admin-stat-icon admin-resolved-icon">✅</div>
                <div className="admin-stat-content">
                  <h3>Resolved Today</h3>
                  <div className="admin-stat-number">
                    {systemStats.resolvedToday}
                  </div>
                  <p className="admin-stat-change admin-positive">
                    Successfully handled
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Admin Performance */}
          <section className="admin-admin-performance">
            <div className="admin-section-header">
              <h3>Your Performance</h3>
              <span className="admin-performance-badge">Administrator</span>
            </div>
            <div className="admin-performance-card">
              <div className="admin-performance-stats">
                <div className="admin-performance-item">
                  <span className="admin-performance-label">
                    Calls Attended
                  </span>
                  <span className="admin-performance-value">
                    {adminData?.calls_attended || 0}
                  </span>
                </div>
                <div className="admin-performance-item">
                  <span className="admin-performance-label">Last Login</span>
                  <span className="admin-performance-value">
                    {adminData?.last_login
                      ? new Date(adminData.last_login).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
                <div className="admin-performance-item">
                  <span className="admin-performance-label">
                    Account Status
                  </span>
                  <span className="admin-performance-value admin-active-status">
                    Active
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Available Cases to Accept */}
          <section className="admin-admin-available-cases-section">
            <div className="admin-section-header">
              <h3>New Cases Requiring Response</h3>
              <div className="admin-section-actions">
                <span className="admin-available-count">
                  {availableEmergencies.length} Available
                </span>
                <button
                  className="admin-toggle-cases-btn"
                  onClick={() => setShowAvailableCases(!showAvailableCases)}
                >
                  {showAvailableCases ? 'Hide Cases' : 'Show Available Cases'}
                </button>
              </div>
            </div>

            {showAvailableCases && (
              <div className="admin-available-cases-grid">
                {availableEmergencies.length === 0 ? (
                  <div className="admin-no-available-cases">
                    <span className="admin-no-data-icon">✅</span>
                    <h4>No Cases Awaiting Response</h4>
                    <p>All emergency reports have been addressed</p>
                  </div>
                ) : (
                  availableEmergencies.map((emergency) => (
                    <div
                      key={emergency.id}
                      className="admin-available-case-card"
                    >
                      <div className="admin-case-header">
                        <div className="admin-case-type">
                          <span className="admin-case-icon">
                            {getEmergencyTypeIcon(emergency.type)}
                          </span>
                          <span className="admin-case-type-text">
                            {emergency.type}
                          </span>
                        </div>
                        <span
                          className={`admin-case-priority ${getPriorityColor(
                            emergency.priority
                          )}`}
                        >
                          {emergency.priority}
                        </span>
                      </div>

                      <div className="admin-case-details">
                        <div className="admin-case-detail">
                          <span className="admin-detail-label">Reporter:</span>
                          <span className="admin-detail-value">
                            {emergency.user_name}
                          </span>
                        </div>
                        <div className="admin-case-detail">
                          <span className="admin-detail-label">Phone:</span>
                          <span className="admin-detail-value">
                            {emergency.user_phone}
                          </span>
                        </div>
                        <div className="admin-case-detail">
                          <span className="admin-detail-label">Location:</span>
                          <span
                            className="admin-detail-value"
                            title={emergency.location}
                          >
                            {emergency.location.length > 30
                              ? emergency.location.substring(0, 30) + '...'
                              : emergency.location}
                          </span>
                        </div>
                        <div className="admin-case-detail">
                          <span className="admin-detail-label">Reported:</span>
                          <span className="admin-detail-value">
                            {emergency.time}
                          </span>
                        </div>
                      </div>

                      <div className="admin-case-actions">
                        <button
                          className={`admin-accept-case-btn ${
                            acceptingEmergency === emergency.id
                              ? 'admin-accepting'
                              : ''
                          }`}
                          onClick={() => handleAcceptEmergency(emergency.id)}
                          disabled={acceptingEmergency === emergency.id}
                        >
                          {acceptingEmergency === emergency.id
                            ? 'Accepting...'
                            : 'Accept Case'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>

          {/* Recent Emergencies */}
          <section className="admin-admin-emergencies-section">
            <div className="admin-section-header">
              <h3>Recent Emergency Reports</h3>
              <div className="admin-section-actions">
                <span className="admin-status-indicator">Live Updates</span>
                <button
                  className="admin-refresh-btn"
                  onClick={refreshEmergencies}
                  disabled={emergenciesLoading}
                >
                  {emergenciesLoading ? '🔄' : '↻'} Refresh
                </button>
              </div>
            </div>

            <div className="admin-admin-emergencies-table">
              <div className="admin-table-header">
                <div className="admin-header-cell">Type</div>
                <div className="admin-header-cell">User</div>
                <div className="admin-header-cell">Location</div>
                <div className="admin-header-cell">Time</div>
                <div className="admin-header-cell">Status</div>
                <div className="admin-header-cell">Priority</div>
                <div className="admin-header-cell">Assigned To</div>
                <div className="admin-header-cell">Actions</div>
              </div>

              {emergenciesLoading ? (
                <div className="admin-table-loading">
                  <div className="admin-loading-spinner"></div>
                  <p>Loading emergencies...</p>
                </div>
              ) : (
                recentEmergencies.map((emergency) => (
                  <div key={emergency.id} className="admin-table-row">
                    <div className="admin-table-cell">
                      <div className="admin-emergency-type">
                        <span className="admin-type-icon">
                          {getEmergencyTypeIcon(emergency.type)}
                        </span>
                        {emergency.type}
                      </div>
                    </div>
                    <div className="admin-table-cell">
                      <div className="admin-user-info">
                        <span className="admin-user-name">
                          {emergency.user_name}
                        </span>
                        {emergency.user_phone &&
                          emergency.user_phone !== 'N/A' && (
                            <span className="admin-user-phone">
                              {emergency.user_phone}
                            </span>
                          )}
                      </div>
                    </div>
                    <div className="admin-table-cell">
                      <span
                        className="admin-location"
                        title={emergency.location}
                      >
                        {emergency.location.length > 20
                          ? emergency.location.substring(0, 20) + '...'
                          : emergency.location}
                      </span>
                    </div>
                    <div className="admin-table-cell">
                      <span
                        className="admin-time-info"
                        title={new Date(emergency.created_at).toLocaleString()}
                      >
                        {emergency.time}
                      </span>
                    </div>
                    <div className="admin-table-cell">
                      <span
                        className={`admin-status-badge ${getStatusColor(
                          emergency.status
                        )}`}
                      >
                        {emergency.status.charAt(0).toUpperCase() +
                          emergency.status.slice(1)}
                      </span>
                    </div>
                    <div className="admin-table-cell">
                      <span
                        className={`admin-priority-badge ${getPriorityColor(
                          emergency.priority
                        )}`}
                      >
                        {emergency.priority.charAt(0).toUpperCase() +
                          emergency.priority.slice(1)}
                      </span>
                    </div>
                    <div className="admin-table-cell">
                      <span
                        className={`admin-assigned-to ${
                          emergency.handled_by === 'Unassigned'
                            ? 'admin-unassigned'
                            : 'admin-assigned'
                        }`}
                      >
                        {emergency.handled_by}
                      </span>
                    </div>
                    <div className="admin-table-cell">
                      {emergency.status !== 'Reported' ? (
                        <>
                          <button
                            className="admin-action-btn admin-view-btn"
                            onClick={() =>
                              handleEmergencyAction(emergency.id, 'view')
                            }
                            title="View emergency details"
                          >
                            View
                          </button>
                          <button
                            className="admin-action-btn admin-update-btn"
                            onClick={() =>
                              handleEmergencyAction(emergency.id, 'update')
                            }
                            title="Update emergency status"
                          >
                            Update
                          </button>
                        </>
                      ) : (
                        <span className="admin-new-case-indicator">
                          New Case
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {!emergenciesLoading && recentEmergencies.length === 0 && (
              <div className="admin-no-emergencies">
                <span className="admin-no-data-icon">📋</span>
                <h4>No Recent Emergencies</h4>
                <p>All emergency reports will appear here</p>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="admin-admin-footer">
        <div className="admin-container">
          <div className="admin-footer-content">
            <p>
              © {new Date().getFullYear()} Emergency Response Admin Panel |
              System Status: Online
            </p>
            <p className="admin-footer-subtitle">
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
