import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Profile.css';

function Profile() {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    address: '123 Main Street, City, State 12345',
    dateOfBirth: '1990-05-15',
    bloodType: 'O+',
    medicalConditions: 'None',
    emergencyContact1: 'Jane Doe - Wife - +1 (555) 987-6543',
    emergencyContact2: 'Bob Smith - Brother - +1 (555) 456-7890',
    preferredHospital: 'City General Hospital'
  });

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    setIsEditing(false);
    console.log('Profile saved:', profileData);
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset to original data if needed
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <div className="profile-page">
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
                <p>User Profile Management</p>
              </div>
            </div>
            <div className="header-actions">
              <button className="back-btn" onClick={handleBackToHome}>
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
            <button className="nav-link active">Profile</button>
            <button className="nav-link" onClick={() => navigate('/location')}>Location</button>
            <button className="nav-link" onClick={() => navigate('/dashboard')}>Dashboard</button>
            <button className="nav-link" onClick={() => navigate('/settings')}>Settings</button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <div className="container">
          {/* Profile Header */}
          <section className="profile-header">
            <div className="profile-avatar">
              <div className="avatar-circle">
                <span className="avatar-initials">
                  {profileData.firstName.charAt(0)}{profileData.lastName.charAt(0)}
                </span>
              </div>
              <button className="change-photo-btn">📷 Change Photo</button>
            </div>
            <div className="profile-info">
              <h2>{profileData.firstName} {profileData.lastName}</h2>
              <p className="profile-email">{profileData.email}</p>
              <div className="profile-actions">
                {!isEditing ? (
                  <button className="edit-btn" onClick={() => setIsEditing(true)}>
                    ✏️ Edit Profile
                  </button>
                ) : (
                  <div className="edit-actions">
                    <button className="save-btn" onClick={handleSave}>
                      ✅ Save Changes
                    </button>
                    <button className="cancel-btn" onClick={handleCancel}>
                      ❌ Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Profile Form */}
          <section className="profile-form">
            <div className="form-grid">
              {/* Personal Information */}
              <div className="form-section">
                <h3>Personal Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name</label>
                    <input
                      type="text"
                      value={profileData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      disabled={!isEditing}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input
                      type="text"
                      value={profileData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      disabled={!isEditing}
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={!isEditing}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    disabled={!isEditing}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <textarea
                    value={profileData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    disabled={!isEditing}
                    className="form-textarea"
                    rows="3"
                  />
                </div>
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    value={profileData.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                    disabled={!isEditing}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Medical Information */}
              <div className="form-section">
                <h3>Medical Information</h3>
                <div className="form-group">
                  <label>Blood Type</label>
                  <select
                    value={profileData.bloodType}
                    onChange={(e) => handleInputChange('bloodType', e.target.value)}
                    disabled={!isEditing}
                    className="form-select"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Medical Conditions</label>
                  <textarea
                    value={profileData.medicalConditions}
                    onChange={(e) => handleInputChange('medicalConditions', e.target.value)}
                    disabled={!isEditing}
                    className="form-textarea"
                    rows="3"
                    placeholder="List any medical conditions, allergies, or medications..."
                  />
                </div>
                <div className="form-group">
                  <label>Preferred Hospital</label>
                  <input
                    type="text"
                    value={profileData.preferredHospital}
                    onChange={(e) => handleInputChange('preferredHospital', e.target.value)}
                    disabled={!isEditing}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Emergency Contacts */}
              <div className="form-section full-width">
                <h3>Emergency Contacts</h3>
                <div className="form-group">
                  <label>Primary Emergency Contact</label>
                  <input
                    type="text"
                    value={profileData.emergencyContact1}
                    onChange={(e) => handleInputChange('emergencyContact1', e.target.value)}
                    disabled={!isEditing}
                    className="form-input"
                    placeholder="Name - Relationship - Phone Number"
                  />
                </div>
                <div className="form-group">
                  <label>Secondary Emergency Contact</label>
                  <input
                    type="text"
                    value={profileData.emergencyContact2}
                    onChange={(e) => handleInputChange('emergencyContact2', e.target.value)}
                    disabled={!isEditing}
                    className="form-input"
                    placeholder="Name - Relationship - Phone Number"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Profile Stats */}
          <section className="profile-stats">
            <h3>Account Statistics</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📞</div>
                <div className="stat-content">
                  <h4>Emergency Calls</h4>
                  <p className="stat-number">3</p>
                  <p className="stat-subtitle">Total calls made</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⏱️</div>
                <div className="stat-content">
                  <h4>Avg Response Time</h4>
                  <p className="stat-number">4.2 min</p>
                  <p className="stat-subtitle">Emergency response</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📍</div>
                <div className="stat-content">
                  <h4>Location Accuracy</h4>
                  <p className="stat-number">98%</p>
                  <p className="stat-subtitle">GPS precision</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🛡️</div>
                <div className="stat-content">
                  <h4>Account Status</h4>
                  <p className="stat-number">Active</p>
                  <p className="stat-subtitle">Verified profile</p>
                </div>
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
            <p className="footer-subtitle">Secure Profile Management • Data Protection • 24/7 Support</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Profile;