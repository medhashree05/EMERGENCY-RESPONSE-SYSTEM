import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './AdminSettings.css'

function AdminSettings() {
  const [activeTab, setActiveTab] = useState('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // Header state
const [currentTime, setCurrentTime] = useState(new Date())
const [systemStats, setSystemStats] = useState({ activeEmergencies: 0 })

useEffect(() => {
  const timer = setInterval(() => {
    setCurrentTime(new Date())
  }, 1000)

  // simulate system stats fetch
  setSystemStats({ activeEmergencies: 3 })

  return () => clearInterval(timer)
}, [])

  
  // General Settings
  const [generalSettings, setGeneralSettings] = useState({
    systemName: 'Emergency Response System',
    timezone: 'UTC',
    language: 'en',
    dateFormat: 'MM/dd/yyyy',
    timeFormat: '12-hour',
    maxLoginAttempts: 5,
    sessionTimeout: 30,
    autoLogout: true
  })

  // Security Settings
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    passwordComplexity: 'medium',
    forcePasswordChange: 90,
    ipWhitelist: '',
    auditLogging: true,
    encryptionLevel: 'AES-256'
  })

  // Notification Settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    emergencyAlerts: true,
    systemUpdates: true,
    maintenanceAlerts: true,
    emergencyContactEmail: '',
    backupContactEmail: ''
  })

  // System Settings
  const [systemSettings, setSystemSettings] = useState({
    maintenanceMode: false,
    debugMode: false,
    maxFileUploadSize: 10,
    cacheTimeout: 60,
    backupFrequency: 'daily',
    logRetention: 30,
    performanceMonitoring: true
  })

  const navigate = useNavigate()

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken')
      if (!token) {
        navigate('/login')
        return
      }

      // Mock API calls - replace with actual API endpoints
      // In a real application, you would make separate API calls for each settings category
      setLoading(false)
    } catch (error) {
      console.error('Error loading settings:', error)
      setLoading(false)
    }
  }

  const handleGeneralChange = (field, value) => {
    setGeneralSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSecurityChange = (field, value) => {
    setSecuritySettings(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleNotificationChange = (field, value) => {
    setNotificationSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSystemChange = (field, value) => {
    setSystemSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const saveSettings = async () => {
    setSaving(true)
    
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken')
      
      const settingsData = {
        general: generalSettings,
        security: securitySettings,
        notifications: notificationSettings,
        system: systemSettings
      }

      // Mock API call - replace with actual API endpoint
      const response = await fetch('http://localhost:8000/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settingsData)
      })

      if (response.ok) {
        alert('Settings saved successfully!')
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = () => {
    if (window.confirm('Are you sure you want to reset all settings to default values? This action cannot be undone.')) {
      // Reset all settings to default values
      setGeneralSettings({
        systemName: 'Emergency Response System',
        timezone: 'UTC',
        language: 'en',
        dateFormat: 'MM/dd/yyyy',
        timeFormat: '12-hour',
        maxLoginAttempts: 5,
        sessionTimeout: 30,
        autoLogout: true
      })

      setSecuritySettings({
        twoFactorAuth: false,
        passwordComplexity: 'medium',
        forcePasswordChange: 90,
        ipWhitelist: '',
        auditLogging: true,
        encryptionLevel: 'AES-256'
      })

      setNotificationSettings({
        emailNotifications: true,
        smsNotifications: false,
        emergencyAlerts: true,
        systemUpdates: true,
        maintenanceAlerts: true,
        emergencyContactEmail: '',
        backupContactEmail: ''
      })

      setSystemSettings({
        maintenanceMode: false,
        debugMode: false,
        maxFileUploadSize: 10,
        cacheTimeout: 60,
        backupFrequency: 'daily',
        logRetention: 30,
        performanceMonitoring: true
      })

      alert('Settings have been reset to default values.')
    }
  }

  const handleBackToDashboard = () => {
    navigate('/admin-dashboard')
  }

  const handleProfile = () => {
    navigate('/admin-profile')
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
        <p>Loading Admin Settings...</p>
      </div>
    )
  }

  const renderGeneralSettings = () => (
    <div className="admin-settings-section">
      <h3>General System Settings</h3>
      <div className="settings-grid">
        <div className="setting-item">
          <label>System Name</label>
          <input
            type="text"
            value={generalSettings.systemName}
            onChange={(e) => handleGeneralChange('systemName', e.target.value)}
            placeholder="Enter system name"
          />
        </div>

        <div className="setting-item">
          <label>Timezone</label>
          <select
            value={generalSettings.timezone}
            onChange={(e) => handleGeneralChange('timezone', e.target.value)}
          >
            <option value="UTC">UTC</option>
            <option value="EST">Eastern Time</option>
            <option value="PST">Pacific Time</option>
            <option value="CST">Central Time</option>
            <option value="MST">Mountain Time</option>
          </select>
        </div>

        <div className="setting-item">
          <label>Language</label>
          <select
            value={generalSettings.language}
            onChange={(e) => handleGeneralChange('language', e.target.value)}
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </div>

        <div className="setting-item">
          <label>Date Format</label>
          <select
            value={generalSettings.dateFormat}
            onChange={(e) => handleGeneralChange('dateFormat', e.target.value)}
          >
            <option value="MM/dd/yyyy">MM/DD/YYYY</option>
            <option value="dd/MM/yyyy">DD/MM/YYYY</option>
            <option value="yyyy-MM-dd">YYYY-MM-DD</option>
          </select>
        </div>

        <div className="setting-item">
          <label>Time Format</label>
          <select
            value={generalSettings.timeFormat}
            onChange={(e) => handleGeneralChange('timeFormat', e.target.value)}
          >
            <option value="12-hour">12 Hour</option>
            <option value="24-hour">24 Hour</option>
          </select>
        </div>

        <div className="setting-item">
          <label>Max Login Attempts</label>
          <input
            type="number"
            min="3"
            max="10"
            value={generalSettings.maxLoginAttempts}
            onChange={(e) => handleGeneralChange('maxLoginAttempts', parseInt(e.target.value))}
          />
        </div>

        <div className="setting-item">
          <label>Session Timeout (minutes)</label>
          <input
            type="number"
            min="5"
            max="120"
            value={generalSettings.sessionTimeout}
            onChange={(e) => handleGeneralChange('sessionTimeout', parseInt(e.target.value))}
          />
        </div>

        <div className="setting-item checkbox-item">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={generalSettings.autoLogout}
              onChange={(e) => handleGeneralChange('autoLogout', e.target.checked)}
            />
            <span className="checkmark"></span>
            Auto Logout on Inactivity
          </label>
        </div>
      </div>
    </div>
  )

  const renderSecuritySettings = () => (
    <div className="admin-settings-section">
      <h3>Security & Authentication</h3>
      <div className="settings-grid">
        <div className="setting-item checkbox-item">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={securitySettings.twoFactorAuth}
              onChange={(e) => handleSecurityChange('twoFactorAuth', e.target.checked)}
            />
            <span className="checkmark"></span>
            Enable Two-Factor Authentication
          </label>
          <p className="setting-description">Require additional verification for admin logins</p>
        </div>

        <div className="setting-item">
          <label>Password Complexity</label>
          <select
            value={securitySettings.passwordComplexity}
            onChange={(e) => handleSecurityChange('passwordComplexity', e.target.value)}
          >
            <option value="low">Low (8+ characters)</option>
            <option value="medium">Medium (8+ chars, numbers, symbols)</option>
            <option value="high">High (12+ chars, mixed case, numbers, symbols)</option>
          </select>
        </div>

        <div className="setting-item">
          <label>Force Password Change (days)</label>
          <input
            type="number"
            min="30"
            max="365"
            value={securitySettings.forcePasswordChange}
            onChange={(e) => handleSecurityChange('forcePasswordChange', parseInt(e.target.value))}
          />
        </div>

        <div className="setting-item">
          <label>IP Whitelist</label>
          <textarea
            value={securitySettings.ipWhitelist}
            onChange={(e) => handleSecurityChange('ipWhitelist', e.target.value)}
            placeholder="Enter IP addresses (one per line)"
            rows="3"
          />
          <p className="setting-description">Leave empty to allow all IPs</p>
        </div>

        <div className="setting-item checkbox-item">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={securitySettings.auditLogging}
              onChange={(e) => handleSecurityChange('auditLogging', e.target.checked)}
            />
            <span className="checkmark"></span>
            Enable Audit Logging
          </label>
        </div>

        <div className="setting-item">
          <label>Encryption Level</label>
          <select
            value={securitySettings.encryptionLevel}
            onChange={(e) => handleSecurityChange('encryptionLevel', e.target.value)}
          >
            <option value="AES-128">AES-128</option>
            <option value="AES-256">AES-256</option>
            <option value="AES-512">AES-512</option>
          </select>
        </div>
      </div>
    </div>
  )

  const renderNotificationSettings = () => (
    <div className="admin-settings-section">
      <h3>Notifications & Alerts</h3>
      <div className="settings-grid">
        <div className="setting-item checkbox-item">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={notificationSettings.emailNotifications}
              onChange={(e) => handleNotificationChange('emailNotifications', e.target.checked)}
            />
            <span className="checkmark"></span>
            Email Notifications
          </label>
        </div>

        <div className="setting-item checkbox-item">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={notificationSettings.smsNotifications}
              onChange={(e) => handleNotificationChange('smsNotifications', e.target.checked)}
            />
            <span className="checkmark"></span>
            SMS Notifications
          </label>
        </div>

        <div className="setting-item checkbox-item">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={notificationSettings.emergencyAlerts}
              onChange={(e) => handleNotificationChange('emergencyAlerts', e.target.checked)}
            />
            <span className="checkmark"></span>
            Emergency Alerts (Critical)
          </label>
        </div>

        <div className="setting-item checkbox-item">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={notificationSettings.systemUpdates}
              onChange={(e) => handleNotificationChange('systemUpdates', e.target.checked)}
            />
            <span className="checkmark"></span>
            System Update Notifications
          </label>
        </div>

        <div className="setting-item checkbox-item">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={notificationSettings.maintenanceAlerts}
              onChange={(e) => handleNotificationChange('maintenanceAlerts', e.target.checked)}
            />
            <span className="checkmark"></span>
            Maintenance Alerts
          </label>
        </div>

        <div className="setting-item">
          <label>Emergency Contact Email</label>
          <input
            type="email"
            value={notificationSettings.emergencyContactEmail}
            onChange={(e) => handleNotificationChange('emergencyContactEmail', e.target.value)}
            placeholder="emergency@yourorg.com"
          />
        </div>

        <div className="setting-item">
          <label>Backup Contact Email</label>
          <input
            type="email"
            value={notificationSettings.backupContactEmail}
            onChange={(e) => handleNotificationChange('backupContactEmail', e.target.value)}
            placeholder="backup@yourorg.com"
          />
        </div>
      </div>
    </div>
  )

  const renderSystemSettings = () => (
    <div className="admin-settings-section">
      <h3>System Configuration</h3>
      <div className="settings-grid">
        <div className="setting-item checkbox-item danger-zone">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={systemSettings.maintenanceMode}
              onChange={(e) => handleSystemChange('maintenanceMode', e.target.checked)}
            />
            <span className="checkmark"></span>
            Maintenance Mode
          </label>
          <p className="setting-description warning">⚠️ This will disable user access to the system</p>
        </div>

        <div className="setting-item checkbox-item">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={systemSettings.debugMode}
              onChange={(e) => handleSystemChange('debugMode', e.target.checked)}
            />
            <span className="checkmark"></span>
            Debug Mode
          </label>
          <p className="setting-description">Enable detailed logging for troubleshooting</p>
        </div>

        <div className="setting-item">
          <label>Max File Upload Size (MB)</label>
          <input
            type="number"
            min="1"
            max="100"
            value={systemSettings.maxFileUploadSize}
            onChange={(e) => handleSystemChange('maxFileUploadSize', parseInt(e.target.value))}
          />
        </div>

        <div className="setting-item">
          <label>Cache Timeout (minutes)</label>
          <input
            type="number"
            min="5"
            max="1440"
            value={systemSettings.cacheTimeout}
            onChange={(e) => handleSystemChange('cacheTimeout', parseInt(e.target.value))}
          />
        </div>

        <div className="setting-item">
          <label>Backup Frequency</label>
          <select
            value={systemSettings.backupFrequency}
            onChange={(e) => handleSystemChange('backupFrequency', e.target.value)}
          >
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div className="setting-item">
          <label>Log Retention (days)</label>
          <input
            type="number"
            min="7"
            max="365"
            value={systemSettings.logRetention}
            onChange={(e) => handleSystemChange('logRetention', parseInt(e.target.value))}
          />
        </div>

        <div className="setting-item checkbox-item">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={systemSettings.performanceMonitoring}
              onChange={(e) => handleSystemChange('performanceMonitoring', e.target.checked)}
            />
            <span className="checkmark"></span>
            Performance Monitoring
          </label>
        </div>
      </div>
    </div>
  )

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralSettings()
      case 'security':
        return renderSecuritySettings()
      case 'notifications':
        return renderNotificationSettings()
      case 'system':
        return renderSystemSettings()
      default:
        return renderGeneralSettings()
    }
  }

  return (
    <div className="admin-settings">
      {/* Header */}
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
        <div className="admin-info">
          <span className="welcome-text">Welcome, Admin</span>
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
      <button className="nav-link" onClick={handleBackToDashboard}>Dashboard</button>
      <button className="nav-link" onClick={handleProfile}>Profile</button>
      <button className="nav-link">Settings</button>
      <button className="nav-link logout-btn" onClick={handleLogout}>Logout</button>
    </div>
  </div>
</nav>


      {/* Main Content */}
      <main className="settings-main">
        <div className="admin-container">
          {/* Settings Navigation */}
          <div className="settings-navigation">
            <button
              className={`nav-tab ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              🔧 General
            </button>
            <button
              className={`nav-tab ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              🔒 Security
            </button>
            <button
              className={`nav-tab ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              🔔 Notifications
            </button>
            <button
              className={`nav-tab ${activeTab === 'system' ? 'active' : ''}`}
              onClick={() => setActiveTab('system')}
            >
              ⚙️ System
            </button>
          </div>

          {/* Settings Content */}
          <div className="admin-settings-content">
            {renderActiveTabContent()}

            {/* Action Buttons */}
            <div className="admin-settings-actions">
              <button
                className="admin-save-settings-btn"
                onClick={saveSettings}
                disabled={saving}
              >
                {saving ? '💾 Saving...' : '💾 Save All Settings'}
              </button>
              <button
                className="reset-settings-btn"
                onClick={resetToDefaults}
              >
                🔄 Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="admin-footer">
        <div className="admin-container">
          <div className="footer-content">
            <p>© {new Date().getFullYear()} Emergency Response System | Admin Settings Panel</p>
            <p className="footer-subtitle">
              Last Updated: {new Date().toLocaleString()} | Active Tab: {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default AdminSettings