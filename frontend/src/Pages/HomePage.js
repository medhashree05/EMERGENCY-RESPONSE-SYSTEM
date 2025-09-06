import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

function HomePage() {
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [user, setUser] = useState(null);
   const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is stored in localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleEmergencyClick = async () => {
  setEmergencyActive(true);

  try {
    const token = localStorage.getItem("token");
    if (token) {
      await fetch("http://localhost:8000/emergency/call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    }
  } catch (err) {
    console.error("Emergency call failed:", err);
  }

  setTimeout(() => setEmergencyActive(false), 3000);
};


  const handleRegister = () => {
    console.log('Register clicked');
    navigate("/register");
  };

  const handleLogin = () => {
    console.log('Login clicked');
    navigate("/login");
  };

  const handleTextChat = () => {
  navigate("/chat");
};
  const handleProfile = () => {
    console.log('Profile clicked');
    navigate("/profile");
  };
  const handleDashboard = () =>{
    console.log("dashboard clicked");
    navigate("/dashboard");
  }
  const handleLocation = () =>{
    console.log("location clicked");
    navigate("/location");
  }
  const handleSettings = () =>{
    console.log("settings clicked");
    navigate("/settings");
  }

  // New navigation handlers for additional services and quick actions
  const handleEnableLocation = () => {
    console.log("Enable location clicked");
    navigate("/location");
  };

  const handleViewStatus = () => {
    console.log("View status clicked");
    navigate("/dashboard");
  };

  const handleManageContacts = () => {
    console.log("Manage contacts clicked");
    navigate("/profile");
  };

  const handleReportEmergency = () => {
    console.log("Report emergency clicked");
    navigate("/chat");
  };

  const handleLiveUpdates = () => {
    console.log("Live updates clicked");
    navigate("/dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
    navigate('/');
  };

  return (
    <div className="homepage">
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
                <p>24/7 Emergency Services</p>
              </div>
            </div>
            <div className="header-actions">
              <button className="text-chat-btn" onClick={handleTextChat}>
                💬 Text Chat
              </button>
               {user ? (
                <div className="profile-dropdown" ref={dropdownRef}>
                  <button
                    className="profile-btn"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                  >
                    👤 {user.first_name || user.email} ▾
                  </button>
                  {dropdownOpen && (
                    <div className="dropdown-menu">
                      <button onClick={handleProfile}>View Profile</button>
                      <button onClick={handleDashboard}>Dashboard</button>
                      <button onClick={handleLogout}>Logout</button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <button className="login-btn" onClick={handleLogin}>
                    Login
                  </button>
                  <button className="register-btn" onClick={handleRegister}>
                    Register
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="navigation">
        <div className="container">
          <div className="nav-links">
            <button className="nav-link active">Emergency</button>
            <button className="nav-link" onClick={handleProfile}>
              Profile
            </button>
            <button className="nav-link" onClick={handleLocation}>Location</button>
            <button className="nav-link" onClick={handleDashboard}>Dashboard</button>
            <button className="nav-link" onClick={handleSettings}>Settings</button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <div className="container">
          {/* Emergency Panic Button */}
          <section className="panic-button-section">
            <h2>Emergency Panic Button</h2>
            <p className="section-subtitle">Press and hold for immediate emergency assistance</p>
            
            <button 
              onClick={handleEmergencyClick}
              className={`panic-button ${emergencyActive ? 'active' : ''}`}
            >
              ⚠️ {emergencyActive ? 'EMERGENCY ACTIVATED' : 'EMERGENCY'}
            </button>
            
            <p className="panic-button-info">
              {emergencyActive 
                ? 'Emergency services have been alerted and your location shared'
                : 'This will immediately alert emergency services and share your location'
              }
            </p>
          </section>

          {/* Emergency Services */}
          <section className="emergency-services">
            <h3>Emergency Services</h3>
            
            <div className="services-grid">
              {/* Police */}
              <div className="service-card">
                <div className="service-icon police-icon">🛡️</div>
                <h4>Police</h4>
                <p>Criminal activity, theft, violence, suspicious behavior</p>
                <button className="service-btn police-btn">Need Police Assistance</button>
              </div>

              {/* Medical */}
              <div className="service-card">
                <div className="service-icon medical-icon">❤️</div>
                <h4>Medical</h4>
                <p>Injuries, illness, cardiac events, breathing problems</p>
                <button className="service-btn medical-btn">Need Medical Assistance</button>
              </div>

              {/* Fire */}
              <div className="service-card">
                <div className="service-icon fire-icon">🔥</div>
                <h4>Fire</h4>
                <p>Fire, smoke, gas leaks, hazardous materials</p>
                <button className="service-btn fire-btn">Need Fire assistance</button>
              </div>

              {/* Accident */}
              <div className="service-card">
                <div className="service-icon accident-icon">🚗</div>
                <h4>Accident</h4>
                <p>Vehicle accidents, collisions, traffic incidents</p>
                <button className="service-btn accident-btn">Call Accident</button>
              </div>
            </div>
          </section>

          {/* Additional Services */}
          <section className="additional-services">
            <div className="additional-grid">
              <div className="additional-card">
                <div className="additional-header">
                  <span className="additional-icon">📍</span>
                  <h4>Live Location</h4>
                </div>
                <p>Real-time GPS tracking and location sharing with emergency responders</p>
                <button className="additional-link" onClick={handleEnableLocation}>Enable Location →</button>
              </div>

              <div className="additional-card">
                <div className="additional-header">
                  <span className="additional-icon">⏱️</span>
                  <h4>Response Time</h4>
                </div>
                <p>Track emergency response units and estimated arrival times</p>
                <button className="additional-link" onClick={handleViewStatus}>View Status →</button>
              </div>

              <div className="additional-card">
                <div className="additional-header">
                  <span className="additional-icon">👥</span>
                  <h4>Emergency Contacts</h4>
                </div>
                <p>Manage your emergency contact list and notification preferences</p>
                <button className="additional-link" onClick={handleManageContacts}>Manage Contacts →</button>
              </div>
            </div>
          </section>

          {/* Quick Actions */}
          <section className="quick-actions">
            <h3>Quick Actions</h3>
            <div className="quick-actions-grid">
              <button className="quick-action-btn" onClick={handleReportEmergency}>📱 Report Emergency</button>
              <button className="quick-action-btn" onClick={handleLiveUpdates}>📊 Live Updates</button>
              <button className="quick-action-btn" onClick={handleSettings}>⚙️ Settings</button>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <p>© {new Date().getFullYear()} Emergency Response System | All Rights Reserved</p>
            <p className="footer-subtitle">Available 24/7 • Multilingual Support • Instant Response</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;