import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Settings.css';

function Settings() {
  const navigate = useNavigate();
  
  // State for various settings
  const [notifications, setNotifications] = useState({
    emergencyAlerts: true,
    locationSharing: false,
    smsAlerts: true,
    emailAlerts: false,
    pushNotifications: true
  });

  const [privacy, setPrivacy] = useState({
    shareLocationWithContacts: false,
    allowDataCollection: true,
    anonymousReporting: true,
    autoLocationSharing: false
  });

  const [emergency, setEmergency] = useState({
    autoDialEmergency: false,
    silentAlarm: true,
    vibrationAlerts: true,
    audioAlerts: true,
    flashlightSignal: false
  });

  const [profile, setProfile] = useState({
    name: 'John Doe',
    phone: '+1 (555) 123-4567',
    email: 'john.doe@email.com',
    emergencyContact: 'Jane Doe',
    medicalInfo: 'No known allergies'
  });

  const [language, setLanguage] = useState('english');
  const [theme, setTheme] = useState('dark');
  const [activeSection, setActiveSection] = useState(null);

  const handleNotificationChange = (key) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handlePrivacyChange = (key) => {
    setPrivacy(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleEmergencyChange = (key) => {
    setEmergency(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleProfileChange = (key, value) => {
    setProfile(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveSettings = () => {
    // Simulate saving settings
    alert('Settings saved successfully!');
  };

  const handleResetSettings = () => {
    if (window.confirm('Are you sure you want to reset all settings to default?')) {
      // Reset to default values
      setNotifications({
        emergencyAlerts: true,
        locationSharing: false,
        smsAlerts: true,
        emailAlerts: false,
        pushNotifications: true
      });
      setPrivacy({
        shareLocationWithContacts: false,
        allowDataCollection: true,
        anonymousReporting: true,
        autoLocationSharing: false
      });
      setEmergency({
        autoDialEmergency: false,
        silentAlarm: true,
        vibrationAlerts: true,
        audioAlerts: true,
        flashlightSignal: false
      });
      setLanguage('english');
      setTheme('dark');
      alert('Settings reset to default!');
    }
  };

  const handleExportData = () => {
    const data = {
      profile,
      notifications,
      privacy,
      emergency,
      language,
      theme
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'emergency-system-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSection = (section) => {
    setActiveSection(activeSection === section ? null : section);
  };

  return (
    <div className="settings-page">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="logo-section">
              <div className="logo">
                <span className="shield-icon">🛡️</span>
              </div>
              <div className="logo-text">
                <h1>Emergency Response System</h1>
                <p>Settings & Preferences</p>
              </div>
            </div>
            <div className="header-actions">
              <button className="back-btn" onClick={() => navigate('/')}>
                ← Back to Home
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="navigation">
        <div className="container">
          <div className="nav-links">
            <button className="nav-link" onClick={() => navigate('/')}>Emergency</button>
            <button className="nav-link" onClick={() => navigate('/profile')}>Profile</button>
            <button className="nav-link" onClick={() => navigate('/location')}>Location</button>
            <button className="nav-link" onClick={() => navigate('/dashboard')}>Dashboard</button>
            <button className="nav-link active">Settings</button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <div className="container">
          <h2>Settings</h2>

          {/* Profile Settings */}
          <section className="settings-section">
            <div 
              className="section-header" 
              onClick={() => toggleSection('profile')}
            >
              <div className="section-title">
                <span className="section-icon">👤</span>
                <h3>Profile Information</h3>
              </div>
              <span className={`toggle-arrow ${activeSection === 'profile' ? 'active' : ''}`}>
                ▼
              </span>
            </div>
            {activeSection === 'profile' && (
              <div className="section-content">
                <div className="settings-grid">
                  <div className="setting-item">
                    <label>Full Name</label>
                    <input 
                      type="text" 
                      value={profile.name}
                      onChange={(e) => handleProfileChange('name', e.target.value)}
                      className="setting-input"
                    />
                  </div>
                  <div className="setting-item">
                    <label>Phone Number</label>
                    <input 
                      type="tel" 
                      value={profile.phone}
                      onChange={(e) => handleProfileChange('phone', e.target.value)}
                      className="setting-input"
                    />
                  </div>
                  <div className="setting-item">
                    <label>Email Address</label>
                    <input 
                      type="email" 
                      value={profile.email}
                      onChange={(e) => handleProfileChange('email', e.target.value)}
                      className="setting-input"
                    />
                  </div>
                  <div className="setting-item">
                    <label>Emergency Contact</label>
                    <input 
                      type="text" 
                      value={profile.emergencyContact}
                      onChange={(e) => handleProfileChange('emergencyContact', e.target.value)}
                      className="setting-input"
                    />
                  </div>
                  <div className="setting-item full-width">
                    <label>Medical Information</label>
                    <textarea 
                      value={profile.medicalInfo}
                      onChange={(e) => handleProfileChange('medicalInfo', e.target.value)}
                      className="setting-textarea"
                      placeholder="Allergies, medical conditions, medications..."
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Notification Settings */}
          <section className="settings-section">
            <div 
              className="section-header" 
              onClick={() => toggleSection('notifications')}
            >
              <div className="section-title">
                <span className="section-icon">🔔</span>
                <h3>Notification Settings</h3>
              </div>
              <span className={`toggle-arrow ${activeSection === 'notifications' ? 'active' : ''}`}>
                ▼
              </span>
            </div>
            {activeSection === 'notifications' && (
              <div className="section-content">
                <div className="settings-list">
                  {Object.entries(notifications).map(([key, value]) => (
                    <div key={key} className="setting-toggle">
                      <div className="toggle-info">
                        <h4>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h4>
                        <p>
                          {key === 'emergencyAlerts' && 'Receive alerts for emergency situations'}
                          {key === 'locationSharing' && 'Allow sharing your location with emergency services'}
                          {key === 'smsAlerts' && 'Receive emergency notifications via SMS'}
                          {key === 'emailAlerts' && 'Receive emergency updates via email'}
                          {key === 'pushNotifications' && 'Receive push notifications on your device'}
                        </p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={() => handleNotificationChange(key)}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Privacy Settings */}
          <section className="settings-section">
            <div 
              className="section-header" 
              onClick={() => toggleSection('privacy')}
            >
              <div className="section-title">
                <span className="section-icon">🔒</span>
                <h3>Privacy & Security</h3>
              </div>
              <span className={`toggle-arrow ${activeSection === 'privacy' ? 'active' : ''}`}>
                ▼
              </span>
            </div>
            {activeSection === 'privacy' && (
              <div className="section-content">
                <div className="settings-list">
                  {Object.entries(privacy).map(([key, value]) => (
                    <div key={key} className="setting-toggle">
                      <div className="toggle-info">
                        <h4>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h4>
                        <p>
                          {key === 'shareLocationWithContacts' && 'Share your location with emergency contacts'}
                          {key === 'allowDataCollection' && 'Allow anonymous data collection for service improvement'}
                          {key === 'anonymousReporting' && 'Send anonymous usage reports'}
                          {key === 'autoLocationSharing' && 'Automatically share location during emergencies'}
                        </p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={() => handlePrivacyChange(key)}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Emergency Settings */}
          <section className="settings-section">
            <div 
              className="section-header" 
              onClick={() => toggleSection('emergency')}
            >
              <div className="section-title">
                <span className="section-icon">🚨</span>
                <h3>Emergency Behavior</h3>
              </div>
              <span className={`toggle-arrow ${activeSection === 'emergency' ? 'active' : ''}`}>
                ▼
              </span>
            </div>
            {activeSection === 'emergency' && (
              <div className="section-content">
                <div className="settings-list">
                  {Object.entries(emergency).map(([key, value]) => (
                    <div key={key} className="setting-toggle">
                      <div className="toggle-info">
                        <h4>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h4>
                        <p>
                          {key === 'autoDialEmergency' && 'Automatically dial emergency services when panic button is pressed'}
                          {key === 'silentAlarm' && 'Enable silent alarm mode for discrete emergency alerts'}
                          {key === 'vibrationAlerts' && 'Use device vibration for emergency alerts'}
                          {key === 'audioAlerts' && 'Play audio alerts for emergency notifications'}
                          {key === 'flashlightSignal' && 'Use flashlight to signal during emergencies'}
                        </p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={() => handleEmergencyChange(key)}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* App Settings */}
          <section className="settings-section">
            <div 
              className="section-header" 
              onClick={() => toggleSection('app')}
            >
              <div className="section-title">
                <span className="section-icon">⚙️</span>
                <h3>App Settings</h3>
              </div>
              <span className={`toggle-arrow ${activeSection === 'app' ? 'active' : ''}`}>
                ▼
              </span>
            </div>
            {activeSection === 'app' && (
              <div className="section-content">
                <div className="settings-grid">
                  <div className="setting-item">
                    <label>Language</label>
                    <select 
                      value={language} 
                      onChange={(e) => setLanguage(e.target.value)}
                      className="setting-select"
                    >
                      <option value="english">English</option>
                      <option value="spanish">Español</option>
                      <option value="french">Français</option>
                      <option value="german">Deutsch</option>
                      <option value="chinese">中文</option>
                    </select>
                  </div>
                  <div className="setting-item">
                    <label>Theme</label>
                    <select 
                      value={theme} 
                      onChange={(e) => setTheme(e.target.value)}
                      className="setting-select"
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Action Buttons */}
          <section className="settings-actions">
            <div className="action-buttons">
              <button className="save-btn" onClick={handleSaveSettings}>
                💾 Save Settings
              </button>
              <button className="export-btn" onClick={handleExportData}>
                📤 Export Data
              </button>
              <button className="reset-btn" onClick={handleResetSettings}>
                🔄 Reset to Default
              </button>
            </div>
          </section>

          {/* System Information */}
          <section className="system-info">
            <h3>System Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">App Version</span>
                <span className="info-value">2.1.0</span>
              </div>
              <div className="info-item">
                <span className="info-label">Last Updated</span>
                <span className="info-value">{new Date().toLocaleDateString()}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Device ID</span>
                <span className="info-value">ERS-{Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Server Status</span>
                <span className="info-value status-online">🟢 Online</span>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <p>© {new Date().getFullYear()} Emergency Response System | All Rights Reserved</p>
            <p className="footer-subtitle">Your privacy and security are our top priority</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Settings;