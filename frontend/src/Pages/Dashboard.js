import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeAlerts, setActiveAlerts] = useState(3);
  const [responseUnits, setResponseUnits] = useState(12);
  const [userRole, setUserRole] = useState('user'); // 'user' or 'admin'
  const [loggedInUser] = useState({ name: 'John Doe', role: 'user' }); // Mock logged in user
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Set user role based on logged in user
    setUserRole(loggedInUser.role);

    return () => clearInterval(timer);
  }, [loggedInUser]);

  const handleEmergencyClick = () => {
    navigate("/");
  };

  const handleProfile = () => {
    navigate("/profile");
  };

  const handleSettings = () => {
    navigate("/settings");
  };

  const handleLocation = () => {
    navigate("/location");
  };

  const toggleRole = () => {
    setUserRole(userRole === 'user' ? 'admin' : 'user');
  };

  const recentEmergencies = [
    { id: 1, type: 'Medical', location: 'Downtown Area', time: '2 mins ago', status: 'Active', priority: 'High' },
    { id: 2, type: 'Fire', location: 'Residential Block', time: '8 mins ago', status: 'Responding', priority: 'Critical' },
    { id: 3, type: 'Police', location: 'Shopping Mall', time: '15 mins ago', status: 'Resolved', priority: 'Medium' },
    { id: 4, type: 'Accident', location: 'Highway Junction', time: '23 mins ago', status: 'Active', priority: 'High' },
  ];

  // Filter active emergencies for user dashboard
  const activeEmergencies = recentEmergencies.filter(emergency => 
    emergency.status === 'Active' || emergency.status === 'Responding'
  );

  const responseTeams = [
    { id: 1, unit: 'Ambulance 001', status: 'Available', location: 'Station A', eta: '3 mins' },
    { id: 2, unit: 'Fire Truck 002', status: 'En Route', location: 'Downtown', eta: '7 mins' },
    { id: 3, unit: 'Police Car 015', status: 'Busy', location: 'Mall Area', eta: '12 mins' },
    { id: 4, unit: 'Rescue Team 003', status: 'Available', location: 'Station B', eta: '5 mins' },
  ];

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'active': return 'status-active';
      case 'responding': return 'status-responding';
      case 'resolved': return 'status-resolved';
      case 'available': return 'status-available';
      case 'en route': return 'status-enroute';
      case 'busy': return 'status-busy';
      default: return 'status-default';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority.toLowerCase()) {
      case 'critical': return 'priority-critical';
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return 'priority-default';
    }
  };

  // User Dashboard Component
  // User Dashboard Component
const UserDashboard = () => {
  // Mock user emergencies (you can later fetch these from backend)
  const userEmergencies = [
    {
      id: 1,
      type: "Medical",
      location: "Green Park Colony",
      time: "Today, 10:15 AM",
      status: "Active",
      priority: "High",
      dispatch: { unit: "Ambulance 001", eta: "3 mins", arrival: "Pending" },
    },
    {
      id: 2,
      type: "Fire",
      location: "Downtown Block C",
      time: "Yesterday, 7:45 PM",
      status: "Resolved",
      priority: "Critical",
      dispatch: { unit: "Fire Truck 002", eta: "6 mins", arrival: "Arrived 7:51 PM" },
    },
    {
      id: 3,
      type: "Accident",
      location: "Highway Exit 21",
      time: "Last Week",
      status: "Resolved",
      priority: "Medium",
      dispatch: { unit: "Rescue Team 003", eta: "5 mins", arrival: "Arrived on time" },
    },
  ];

  const activeUserEmergencies = userEmergencies.filter(
    (e) => e.status === "Active" || e.status === "Responding"
  );

  return (
    <div className="dashboard user-dashboard">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="logo-section">
              <div className="logo"><span className="shield-icon">🛡️</span></div>
              <div className="logo-text">
                <h1>User Emergency Dashboard</h1>
                <p>Personalized Emergency Updates</p>
              </div>
            </div>
            <div className="header-info">
              <div className="user-info">
                <span className="welcome-text">Welcome, {loggedInUser.name}</span>
                <span className="role-badge user-role">User</span>
              </div>
              <div className="time-display">
                <span className="time">{currentTime.toLocaleTimeString()}</span>
                <span className="date">{currentTime.toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="navigation">
        <div className="container">
          <div className="nav-links">
            <button className="nav-link" onClick={handleEmergencyClick}> Report Emergency </button>
            <button className="nav-link" onClick={handleProfile}> Profile </button>
            <button className="nav-link" onClick={handleLocation}> Location </button>
            <button className="nav-link active">Dashboard</button>
            <button className='nav-link' onClick={handleSettings}>Settings</button>
            <button className="nav-link demo-toggle" onClick={toggleRole}> Switch to Admin </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <div className="container">

          {/* Active User Emergencies */}
          <section className="emergencies-section">
            <div className="section-header">
              <h3>Your Active Emergencies</h3>
              <span className="status-indicator">Tracking Dispatch</span>
            </div>

            <div className="emergency-cards">
              {activeUserEmergencies.map((emergency) => (
                <div key={emergency.id} className="emergency-card">
                  <div className="emergency-header">
                    <div className="emergency-type">
                      {emergency.type === "Medical" && <span className="type-icon">❤️</span>}
                      {emergency.type === "Fire" && <span className="type-icon">🔥</span>}
                      {emergency.type === "Police" && <span className="type-icon">🚔</span>}
                      {emergency.type === "Accident" && <span className="type-icon">🚗</span>}
                      <span className="type-text">{emergency.type} Emergency</span>
                    </div>
                    <span className={`status-badge ${getStatusColor(emergency.status)}`}>
                      {emergency.status}
                    </span>
                  </div>

                  <div className="emergency-details">
                    <p><span className="detail-icon">📍</span><strong>Location:</strong> {emergency.location}</p>
                    <p><span className="detail-icon">⏰</span><strong>Reported:</strong> {emergency.time}</p>
                    <p><span className="detail-icon">⚠️</span><strong>Priority:</strong> 
                      <span className={`priority-badge ${getPriorityColor(emergency.priority)}`}>
                        {emergency.priority}
                      </span>
                    </p>
                    <p><span className="detail-icon">🚑</span><strong>Dispatch:</strong> {emergency.dispatch.unit}</p>
                    <p><span className="detail-icon">⏳</span><strong>ETA:</strong> {emergency.dispatch.eta}</p>
                    <p><span className="detail-icon">✅</span><strong>Arrival:</strong> {emergency.dispatch.arrival}</p>
                  </div>

                  <div className="emergency-actions">
                    <button className="emergency-btn">Track Unit</button>
                    <button className="emergency-btn secondary">View Updates</button>
                  </div>
                </div>
              ))}
            </div>

            {activeUserEmergencies.length === 0 && (
              <div className="no-emergencies">
                <span className="safe-icon">✅</span>
                <h4>No Active Emergencies</h4>
                <p>You haven’t reported any current emergencies</p>
              </div>
            )}
          </section>

          {/* Emergency History */}
          <section className="history-section">
            <div className="section-header">
              <h3>Emergency History</h3>
              <span className="status-indicator">Past Reports</span>
            </div>
            <div className="history-table">
              <div className="table-header">
                <div className="header-cell">Type</div>
                <div className="header-cell">Location</div>
                <div className="header-cell">Reported</div>
                <div className="header-cell">Status</div>
                <div className="header-cell">Dispatch</div>
                <div className="header-cell">Arrival</div>
              </div>
              {userEmergencies.map((e) => (
                <div key={e.id} className="table-row">
                  <div className="table-cell">{e.type}</div>
                  <div className="table-cell">{e.location}</div>
                  <div className="table-cell">{e.time}</div>
                  <div className="table-cell">
                    <span className={`status-badge ${getStatusColor(e.status)}`}>{e.status}</span>
                  </div>
                  <div className="table-cell">{e.dispatch.unit}</div>
                  <div className="table-cell">{e.dispatch.arrival}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Safety Tips */}
          <section className="safety-section">
            <h3>Safety Information</h3>
            <div className="safety-grid">
              <div className="safety-card">
                <span className="safety-icon">📞</span>
                <h4>Emergency Contacts</h4>
                <p>Police: 911 | Fire: 911 | Medical: 911</p>
              </div>
              <div className="safety-card">
                <span className="safety-icon">📍</span>
                <h4>Evacuation Routes</h4>
                <p>Know your nearest exits and meeting points</p>
              </div>
              <div className="safety-card">
                <span className="safety-icon">🎒</span>
                <h4>Emergency Kit</h4>
                <p>Keep supplies ready: water, food, flashlight</p>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <p>© {new Date().getFullYear()} Emergency Response System | Status: Online</p>
            <p className="footer-subtitle">Last Updated: {currentTime.toLocaleString()}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
  // Admin Dashboard Component (Original Dashboard)
  const AdminDashboard = () => (
    <div className="dashboard admin-dashboard">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="logo-section">
              <div className="logo">
                <span className="shield-icon">🛡️</span>
              </div>
              <div className="logo-text">
                <h1>Emergency Dashboard</h1>
                <p>Administrative Control Panel</p>
              </div>
            </div>
            <div className="header-info">
              <div className="user-info">
                <span className="welcome-text">Admin: {loggedInUser.name}</span>
                <span className="role-badge admin-role">Administrator</span>
              </div>
              <div className="time-display">
                <span className="time">{currentTime.toLocaleTimeString()}</span>
                <span className="date">{currentTime.toLocaleDateString()}</span>
              </div>
              <div className="alert-indicator">
                <span className="alert-count">{activeAlerts}</span>
                <span className="alert-text">Active Alerts</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="navigation">
        <div className="container">
          <div className="nav-links">
            <button className="nav-link" onClick={handleEmergencyClick}>
              Emergency
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
            <button className="nav-link demo-toggle" onClick={toggleRole}>
              Switch to User
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <div className="container">
          {/* Stats Overview */}
          <section className="stats-section">
            <h2>System Overview</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon emergency-icon">⚠️</div>
                <div className="stat-content">
                  <h3>Active Emergencies</h3>
                  <div className="stat-number">3</div>
                  <p className="stat-change positive">+2 from last hour</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon units-icon">🚑</div>
                <div className="stat-content">
                  <h3>Response Units</h3>
                  <div className="stat-number">{responseUnits}</div>
                  <p className="stat-change neutral">8 available</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon time-icon">⏱️</div>
                <div className="stat-content">
                  <h3>Avg Response Time</h3>
                  <div className="stat-number">4.2 min</div>
                  <p className="stat-change positive">-30s improved</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon resolved-icon">✅</div>
                <div className="stat-content">
                  <h3>Resolved Today</h3>
                  <div className="stat-number">47</div>
                  <p className="stat-change positive">+12% from yesterday</p>
                </div>
              </div>
            </div>
          </section>

          {/* Recent Emergencies */}
          <section className="emergencies-section">
            <div className="section-header">
              <h3>Recent Emergencies</h3>
              <button className="view-all-btn">View All →</button>
            </div>
            
            <div className="emergencies-table">
              <div className="table-header">
                <div className="header-cell">Type</div>
                <div className="header-cell">Location</div>
                <div className="header-cell">Time</div>
                <div className="header-cell">Status</div>
                <div className="header-cell">Priority</div>
                <div className="header-cell">Actions</div>
              </div>
              
              {recentEmergencies.map(emergency => (
                <div key={emergency.id} className="table-row">
                  <div className="table-cell">
                    <div className="emergency-type">
                      {emergency.type === 'Medical' && <span className="type-icon">❤️</span>}
                      {emergency.type === 'Fire' && <span className="type-icon">🔥</span>}
                      {emergency.type === 'Police' && <span className="type-icon">🛡️</span>}
                      {emergency.type === 'Accident' && <span className="type-icon">🚗</span>}
                      {emergency.type}
                    </div>
                  </div>
                  <div className="table-cell">{emergency.location}</div>
                  <div className="table-cell">{emergency.time}</div>
                  <div className="table-cell">
                    <span className={`status-badge ${getStatusColor(emergency.status)}`}>
                      {emergency.status}
                    </span>
                  </div>
                  <div className="table-cell">
                    <span className={`priority-badge ${getPriorityColor(emergency.priority)}`}>
                      {emergency.priority}
                    </span>
                  </div>
                  <div className="table-cell">
                    <button className="action-btn">View</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Response Teams */}
          <section className="teams-section">
            <div className="section-header">
              <h3>Response Teams Status</h3>
              <button className="manage-btn">Manage Teams</button>
            </div>
            
            <div className="teams-grid">
              {responseTeams.map(team => (
                <div key={team.id} className="team-card">
                  <div className="team-header">
                    <h4>{team.unit}</h4>
                    <span className={`team-status ${getStatusColor(team.status)}`}>
                      {team.status}
                    </span>
                  </div>
                  <div className="team-details">
                    <p><span className="detail-label">Location:</span> {team.location}</p>
                    <p><span className="detail-label">ETA:</span> {team.eta}</p>
                  </div>
                  <div className="team-actions">
                    <button className="team-btn contact-btn">📞 Contact</button>
                    <button className="team-btn track-btn">📍 Track</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Actions */}
          <section className="quick-actions">
            <h3>Quick Actions</h3>
            <div className="quick-actions-grid">
              <button className="quick-action-btn">📊 Generate Report</button>
              <button className="quick-action-btn">🚨 Broadcast Alert</button>
              <button className="quick-action-btn">📋 Update Status</button>
              <button className="quick-action-btn">⚙️ System Settings</button>
              <button className="quick-action-btn">👥 Manage Users</button>
              <button className="quick-action-btn">📈 View Analytics</button>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <p>© {new Date().getFullYear()} Emergency Response Dashboard | System Status: Online</p>
            <p className="footer-subtitle">Last Updated: {currentTime.toLocaleString()} • Version 2.1.0</p>
          </div>
        </div>
      </footer>
    </div>
  );

  // Render appropriate dashboard based on user role
  return userRole === 'admin' ? <AdminDashboard /> : <UserDashboard />;
}

export default Dashboard;