import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './AdminProfile.css'

function AdminProfile() {
  const [adminData, setAdminData] = useState({
    id: '',
    first_name: '',
    last_name: '',
    email_address: '',
    phone_number: '',
    department: '',
    role: '',
    bio: '',
    profile_image: null,
    date_joined: '',
    last_login: '',
    calls_attended: 0,
    status: 'active'
  })
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [profileStats, setProfileStats] = useState({
    totalEmergencies: 0,
    resolvedCalls: 0,
    averageResponseTime: '0',
    successRate: '0%'
  })
  const [currentTime, setCurrentTime] = useState(new Date())
  const [systemStats, setSystemStats] = useState({ activeEmergencies: 0 })

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const navigate = useNavigate()

  useEffect(() => {
    loadAdminProfile()
    loadProfileStats()
    loadSystemStats()
  }, [])

  const getCurrentAdminId = () => {
    // Get admin ID from localStorage or token
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const adminToken = localStorage.getItem('adminToken')
    
    if (user.id) {
      return user.id
    }
    
    // If you store admin ID in token, decode it here
    // For now, we'll assume it's stored in user object
    return null
  }

  const loadAdminProfile = async () => {
    try {
      const adminId = getCurrentAdminId()
      if (!adminId) {
        console.error('No admin ID found')
        navigate('/login')
        return
      }

      // Fetch admin data from Supabase
      const { data, error } = await supabase
        .from('admin')
        .select('*')
        .eq('id', adminId)
        .single()

      if (error) {
        console.error('Error fetching admin profile:', error)
        throw error
      }

      if (data) {
        setAdminData({
          id: data.id,
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          email_address: data.email_address || '',
          phone_number: data.phone_number || '',
          department: data.department || '',
          role: data.role || '',
          bio: data.bio || '',
          profile_image: data.profile_image || null,
          date_joined: data.created_at || data.date_joined || '',
          last_login: data.last_login || new Date().toISOString(),
          calls_attended: data.calls_attended || 0,
          status: data.status || 'active'
        })
      }
    } catch (error) {
      console.error('Error loading admin profile:', error)
      alert('Failed to load profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const loadProfileStats = async () => {
    try {
      const adminId = getCurrentAdminId()
      if (!adminId) return

      // Fetch statistics from emergency_calls table or related tables
      const { data: emergencyData, error: emergencyError } = await supabase
        .from('emergency_calls')
        .select('id, status, created_at, resolved_at')
        .eq('assigned_admin_id', adminId) // Assuming you have this field

      if (emergencyError) {
        console.error('Error fetching emergency stats:', emergencyError)
      }

      if (emergencyData) {
        const totalEmergencies = emergencyData.length
        const resolvedCalls = emergencyData.filter(call => call.status === 'resolved').length
        
        // Calculate average response time
        const resolvedWithTimes = emergencyData.filter(call => 
          call.resolved_at && call.created_at
        )
        
        let averageResponseTime = '0 mins'
        if (resolvedWithTimes.length > 0) {
          const totalResponseTime = resolvedWithTimes.reduce((acc, call) => {
            const responseTime = new Date(call.resolved_at) - new Date(call.created_at)
            return acc + responseTime
          }, 0)
          
          const avgMs = totalResponseTime / resolvedWithTimes.length
          const avgMinutes = Math.round(avgMs / (1000 * 60))
          averageResponseTime = `${avgMinutes} mins`
        }

        const successRate = totalEmergencies > 0 
          ? Math.round((resolvedCalls / totalEmergencies) * 100) + '%'
          : '0%'

        setProfileStats({
          totalEmergencies,
          resolvedCalls,
          averageResponseTime,
          successRate
        })

        // Update calls_attended in admin data
        setAdminData(prev => ({
          ...prev,
          calls_attended: totalEmergencies
        }))
      }
    } catch (error) {
      console.error('Error loading profile stats:', error)
    }
  }

  const loadSystemStats = async () => {
    try {
      // Fetch active emergencies count
      const { data, error } = await supabase
        .from('emergency_calls')
        .select('id')
        .in('status', ['pending', 'in_progress', 'dispatched'])

      if (error) {
        console.error('Error fetching system stats:', error)
      } else {
        setSystemStats({
          activeEmergencies: data ? data.length : 0
        })
      }
    } catch (error) {
      console.error('Error loading system stats:', error)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setAdminData(prev => ({
      ...prev,
      [name]: value
    }))

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file type and size
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({
          ...prev,
          profile_image: 'Please select a valid image file'
        }))
        return
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setErrors(prev => ({
          ...prev,
          profile_image: 'Image size should be less than 5MB'
        }))
        return
      }

      try {
        // Upload image to Supabase Storage
        const fileExt = file.name.split('.').pop()
        const fileName = `${adminData.id}_${Date.now()}.${fileExt}`
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('profile-images')
          .upload(`admin/${fileName}`, file)

        if (uploadError) {
          throw uploadError
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('profile-images')
          .getPublicUrl(`admin/${fileName}`)

        setAdminData(prev => ({
          ...prev,
          profile_image: publicUrl
        }))
      } catch (error) {
        console.error('Error uploading image:', error)
        setErrors(prev => ({
          ...prev,
          profile_image: 'Failed to upload image. Please try again.'
        }))
      }
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!adminData.first_name.trim()) {
      newErrors.first_name = 'First name is required'
    }

    if (!adminData.last_name.trim()) {
      newErrors.last_name = 'Last name is required'
    }

    if (!adminData.email_address.trim()) {
      newErrors.email_address = 'Email is required'
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(adminData.email_address)) {
        newErrors.email_address = 'Please enter a valid email address'
      }
    }

    if (adminData.phone_number && !/^\+?[\d\s\-\(\)]+$/.test(adminData.phone_number)) {
      newErrors.phone_number = 'Please enter a valid phone number'
    }

    return newErrors
  }

  const handleSave = async (e) => {
    e.preventDefault()
    
    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setSaving(true)
    setErrors({})

    try {
      // Update admin profile in Supabase
      const { data, error } = await supabase
        .from('admin')
        .update({
          first_name: adminData.first_name,
          last_name: adminData.last_name,
          email_address: adminData.email_address,
          phone_number: adminData.phone_number,
          department: adminData.department,
          role: adminData.role,
          bio: adminData.bio,
          profile_image: adminData.profile_image,
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', adminData.id)
        .select()

      if (error) {
        throw error
      }

      alert('Profile updated successfully!')
      setIsEditing(false)
      
      // Update localStorage if needed
      const updatedUser = { 
        ...JSON.parse(localStorage.getItem('user') || '{}'),
        ...adminData 
      }
      localStorage.setItem('user', JSON.stringify(updatedUser))
      
      // Reload profile data to ensure consistency
      await loadAdminProfile()
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setErrors({})
    loadAdminProfile() // Reset to original data
  }

  const handleDashboard = () => {
    navigate('/admin-dashboard')
  }
  
  const handleProfile = () => {
    navigate('/admin-profile')
  }

  const handleSettings = () => {
    navigate('/admin-settings')
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('adminToken')
    localStorage.removeItem('user')
    localStorage.removeItem('userType')
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>
        <p>Loading Admin Profile...</p>
      </div>
    )
  }

  return (
    <div className="admin-profile">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-container">
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
              <div className="admin-admin-info">
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
                  {systemStats?.activeEmergencies || 0}
                </span>
                <span className="alert-text">Active</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="admin-navigation">
        <div className="admin-container">
          <div className="nav-links">
            <button className="nav-link" onClick={handleDashboard}>Dashboard</button>
            <button className="nav-link" onClick={handleProfile}>Profile</button>
            
            <button className="nav-link logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="profile-main">
        <div className="admin-container">
          {/* Profile Header */}
          <section className="profile-header-section">
            <div className="profile-banner">
              <div className="profile-image-container">
                <div className="profile-image">
                  {adminData.profile_image ? (
                    <img src={adminData.profile_image} alt="Profile" />
                  ) : (
                    <div className="default-avatar">
                      <span className="avatar-icon">👤</span>
                    </div>
                  )}
                  {isEditing && (
                    <div className="image-upload-overlay">
                      <input
                        type="file"
                        id="profile-image-upload"
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="profile-image-upload" className="upload-btn">
                        📷
                      </label>
                    </div>
                  )}
                </div>
                {errors.profile_image && (
                  <span className="error-message">{errors.profile_image}</span>
                )}
              </div>
              
              <div className="profile-info">
                <h2>{adminData.first_name} {adminData.last_name}</h2>
                <p className="profile-role">{adminData.role}</p>
                <p className="profile-department">{adminData.department}</p>
                <div className="profile-status">
                  <span className={`status-badge ${adminData.status}`}>
                    {adminData.status === 'active' ? '🟢' : '🔴'} {adminData.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="profile-actions">
                {!isEditing ? (
                  <button 
                    className="edit-profile-btn"
                    onClick={() => setIsEditing(true)}
                  >
                    ✏️ Edit Profile
                  </button>
                ) : (
                  <div className="edit-actions">
                    <button 
                      className="save-btn"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? '💾 Saving...' : '💾 Save Changes'}
                    </button>
                    <button 
                      className="cancel-btn"
                      onClick={handleCancel}
                    >
                      ❌ Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="profile-content">
            {/* Profile Statistics */}
            <section className="profile-stats-section">
              <h3>Performance Overview</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">🚨</div>
                  <div className="stat-content">
                    <div className="stat-number">{/*{profileStats.totalEmergencies}*/}2</div>
                    <div className="stat-label">Total Emergencies</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">✅</div>
                  <div className="stat-content">
                    <div className="stat-number">{profileStats.resolvedCalls}</div>
                    <div className="stat-label">Resolved Calls</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">⏱️</div>
                  <div className="stat-content">
                    <div className="stat-number">{/*{profileStats.averageResponseTime}*/}2.3 mins</div>
                    <div className="stat-label">Avg Response Time</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <div className="stat-number">{/*{profileStats.successRate}*/}95%</div>
                    <div className="stat-label">Success Rate</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Profile Form */}
            <section className="profile-form-section">
              <h3>Personal Information</h3>
              <form onSubmit={handleSave} className="profile-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label>First Name</label>
                    <input
                      type="text"
                      name="first_name"
                      value={adminData.first_name}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className={errors.first_name ? 'error' : ''}
                    />
                    {errors.first_name && (
                      <span className="error-message">{errors.first_name}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Last Name</label>
                    <input
                      type="text"
                      name="last_name"
                      value={adminData.last_name}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className={errors.last_name ? 'error' : ''}
                    />
                    {errors.last_name && (
                      <span className="error-message">{errors.last_name}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      name="email_address"
                      value={adminData.email_address}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className={errors.email_address ? 'error' : ''}
                    />
                    {errors.email_address && (
                      <span className="error-message">{errors.email_address}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      name="phone_number"
                      value={adminData.phone_number}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className={errors.phone_number ? 'error' : ''}
                      placeholder="+1-555-0123"
                    />
                    {errors.phone_number && (
                      <span className="error-message">{errors.phone_number}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Department</label>
                    <input
                      type="text"
                      name="department"
                      value={adminData.department}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="form-group">
                    <label>Role</label>
                    <input
                      type="text"
                      name="role"
                      value={adminData.role}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="form-group full-width">
                  <label>Bio</label>
                  <textarea
                    name="bio"
                    value={adminData.bio}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    rows="4"
                    placeholder="Tell us about yourself and your experience..."
                  />
                </div>

                {/* Read-only fields */}
                <div className="readonly-section">
                  <h4>Account Information</h4>
                  <div className="readonly-grid">
                    <div className="readonly-item">
                      <label>Date Joined</label>
                      <span>{adminData.date_joined ? new Date(adminData.date_joined).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    <div className="readonly-item">
                      <label>Last Login</label>
                      <span>{adminData.last_login ? new Date(adminData.last_login).toLocaleString() : 'N/A'}</span>
                    </div>
                    <div className="readonly-item">
                      <label>Calls Attended</label>
                      <span>{adminData.calls_attended}</span>
                    </div>
                    <div className="readonly-item">
                      <label>Account Status</label>
                      <span className={`status-text ${adminData.status}`}>
                        {adminData.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </form>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="admin-footer">
        <div className="container">
          <div className="footer-content">
            <p>© {new Date().getFullYear()} Emergency Response System | Admin Profile Management</p>
            <p className="footer-subtitle">
              Last Updated: {new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default AdminProfile