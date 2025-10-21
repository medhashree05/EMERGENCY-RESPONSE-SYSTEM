import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './DispatchProfile.css';

function DispatchProfile() {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [dispatchData, setDispatchData] = useState(null);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("dispatchToken") || localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate("/dispatch-profile");
      return;
    }
  
    
    const fetchDispatchProfile = async () => {
      try {
        const res = await fetch("http://localhost:8000/dispatch/profile/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error("Failed to fetch dispatch profile");
        const data = await res.json();
        setDispatchData({
          departmentName: data.department_name,
          unitType: data.unit_type,
          place: data.place,
          district: data.district,
          state: data.state,
          pincode: data.pincode,
          username: data.username,
          officialEmail: data.official_email,
          primaryContact: data.primary_contact,
          alternateContact: data.alternate_contact || "",
          officerName: data.officer_name,
          officerContact: data.officer_contact,
          vehicleCount: data.vehicle_count || 0,
          totalResponses: data.total_responses || 0,
          activeStatus: data.active_status || "Active",
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDispatchProfile();
  }, [token, navigate]);

  const handleInputChange = (field, value) => {
    setDispatchData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      const payload = {
        department_name: dispatchData.departmentName,
        unit_type: dispatchData.unitType,
        place: dispatchData.place,
        district: dispatchData.district,
        state: dispatchData.state,
        pincode: dispatchData.pincode,
        username: dispatchData.username,
        official_email: dispatchData.officialEmail,
        primary_contact: dispatchData.primaryContact,
        alternate_contact: dispatchData.alternateContact,
        officer_name: dispatchData.officerName,
        officer_contact: dispatchData.officerContact,
        vehicle_count: dispatchData.vehicleCount,
      };

      const res = await fetch("http://localhost:8000/dispatch/profile/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save dispatch profile");
      setIsEditing(false);
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  if (loading) return <p className="dispatch-loading">Loading dispatch profile...</p>;
  if (!dispatchData) return <p className="dispatch-no-data">No dispatch profile data found.</p>;

  const handleCancel = () => {
    setIsEditing(false);
    // Reset to original data if needed
  };

  const handleBackToHome = () => {
    navigate('/dispatch-dashboard');
  };

  return (
    <div className="dispatch-profile-page">
      {/* Header */}
      <header className="dispatch-header">
        <div className="dispatch-container">
          <div className="dispatch-header-content">
            <div className="dispatch-logo-section">
              <div className="dispatch-logo">
                <span className="dispatch-shield-icon">🚨</span>
              </div>
              <div className="dispatch-logo-text">
                <h1>Emergency Dispatch System</h1>
                <p>Dispatch Unit Profile Management</p>
              </div>
            </div>
            <div className="dispatch-header-actions">
              <button className="dispatch-back-btn" onClick={handleBackToHome}>
                ← Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="dispatch-navigation">
        <div className="dispatch-container">
          <div className="dispatch-nav-links">
            <button className="dispatch-nav-link" onClick={() => navigate('/dispatch-dashboard')}>Dashboard</button>
            <button className="dispatch-nav-link active">Profile</button>
            
           
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="dispatch-main-content">
        <div className="dispatch-container">
          {/* Profile Header */}
          <section className="dispatch-profile-header">
            <div className="dispatch-profile-avatar">
              <div className="dispatch-avatar-circle">
                <span className="dispatch-avatar-initials">
                  {dispatchData.departmentName.charAt(0)}{dispatchData.unitType.charAt(0)}
                </span>
              </div>
            </div>
            <div className="dispatch-profile-info">
              <h2>{dispatchData.departmentName}</h2>
              <p className="dispatch-profile-unit-type">{dispatchData.unitType}</p>
              <p className="dispatch-profile-location">{dispatchData.place}, {dispatchData.district}, {dispatchData.state}</p>
              <div className="dispatch-profile-actions">
                {!isEditing ? (
                  <button className="dispatch-edit-btn" onClick={() => setIsEditing(true)}>
                    ✏️ Edit Profile
                  </button>
                ) : (
                  <div className="dispatch-edit-actions">
                    <button className="dispatch-save-btn" onClick={handleSave}>
                      ✅ Save Changes
                    </button>
                    <button className="dispatch-cancel-btn" onClick={handleCancel}>
                      ❌ Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Profile Form */}
          <section className="dispatch-profile-form">
            <div className="dispatch-form-grid">
              {/* Department Information */}
              <div className="dispatch-form-section">
                <h3>Department Information</h3>
                <div className="dispatch-form-group">
                  <label>Department/Agency Name</label>
                  <input
                    type="text"
                    value={dispatchData.departmentName}
                    onChange={(e) => handleInputChange('departmentName', e.target.value)}
                    disabled={!isEditing}
                    className="dispatch-form-input"
                  />
                </div>
                <div className="dispatch-form-group">
                  <label>Unit Type</label>
                  <select
                    value={dispatchData.unitType}
                    onChange={(e) => handleInputChange('unitType', e.target.value)}
                    disabled={!isEditing}
                    className="dispatch-form-select"
                  >
                    <option value="Police Station">Police Station</option>
                    <option value="Fire Station">Fire Station</option>
                    <option value="Medical Service">Medical Service</option>
                  </select>
                </div>
                <div className="dispatch-form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    value={dispatchData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    disabled={!isEditing}
                    className="dispatch-form-input"
                  />
                </div>
                <div className="dispatch-form-group">
                  <label>Official Email Address</label>
                  <input
                    type="email"
                    value={dispatchData.officialEmail}
                    onChange={(e) => handleInputChange('officialEmail', e.target.value)}
                    disabled={!isEditing}
                    className="dispatch-form-input"
                  />
                </div>
              </div>

              {/* Location Information */}
              <div className="dispatch-form-section">
                <h3>Location Information</h3>
                <div className="dispatch-form-group">
                  <label>Place/Area</label>
                  <input
                    type="text"
                    value={dispatchData.place}
                    onChange={(e) => handleInputChange('place', e.target.value)}
                    disabled={!isEditing}
                    className="dispatch-form-input"
                  />
                </div>
                <div className="dispatch-form-group">
                  <label>District</label>
                  <input
                    type="text"
                    value={dispatchData.district}
                    onChange={(e) => handleInputChange('district', e.target.value)}
                    disabled={!isEditing}
                    className="dispatch-form-input"
                  />
                </div>
                <div className="dispatch-form-group">
                  <label>State</label>
                  <input
                    type="text"
                    value={dispatchData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    disabled={!isEditing}
                    className="dispatch-form-input"
                  />
                </div>
                <div className="dispatch-form-group">
                  <label>Pincode</label>
                  <input
                    type="text"
                    value={dispatchData.pincode}
                    onChange={(e) => handleInputChange('pincode', e.target.value)}
                    disabled={!isEditing}
                    className="dispatch-form-input"
                  />
                </div>
              </div>

              {/* Contact Information */}
              <div className="dispatch-form-section dispatch-full-width">
                <h3>Contact Information</h3>
                <div className="dispatch-form-row">
                  <div className="dispatch-form-group">
                    <label>Primary Contact Number</label>
                    <input
                      type="tel"
                      value={dispatchData.primaryContact}
                      onChange={(e) => handleInputChange('primaryContact', e.target.value)}
                      disabled={!isEditing}
                      className="dispatch-form-input"
                    />
                  </div>
                  <div className="dispatch-form-group">
                    <label>Alternate Contact Number</label>
                    <input
                      type="tel"
                      value={dispatchData.alternateContact}
                      onChange={(e) => handleInputChange('alternateContact', e.target.value)}
                      disabled={!isEditing}
                      className="dispatch-form-input"
                    />
                  </div>
                </div>
              </div>

              {/* Officer-in-Charge Information */}
              <div className="dispatch-form-section dispatch-full-width">
                <h3>Officer-in-Charge Information</h3>
                <div className="dispatch-form-row">
                  <div className="dispatch-form-group">
                    <label>Officer-in-Charge Name</label>
                    <input
                      type="text"
                      value={dispatchData.officerName}
                      onChange={(e) => handleInputChange('officerName', e.target.value)}
                      disabled={!isEditing}
                      className="dispatch-form-input"
                    />
                  </div>
                  <div className="dispatch-form-group">
                    <label>Officer Contact Number</label>
                    <input
                      type="tel"
                      value={dispatchData.officerContact}
                      onChange={(e) => handleInputChange('officerContact', e.target.value)}
                      disabled={!isEditing}
                      className="dispatch-form-input"
                    />
                  </div>
                </div>
                <div className="dispatch-form-group">
                  <label>Number of Vehicles</label>
                  <input
                    type="number"
                    min="0"
                    value={dispatchData.vehicleCount}
                    onChange={(e) => handleInputChange('vehicleCount', e.target.value)}
                    disabled={!isEditing}
                    className="dispatch-form-input"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Profile Stats */}
          <section className="dispatch-profile-stats">
            <h3>Unit Statistics</h3>
            <div className="dispatch-stats-grid">
              <div className="dispatch-stat-card">
                <div className="dispatch-stat-icon">🚨</div>
                <div className="dispatch-stat-content">
                  <h4>Total Responses</h4>
                  <p className="dispatch-stat-number">{dispatchData.totalResponses}</p>
                  <p className="dispatch-stat-subtitle">Emergency responses</p>
                </div>
              </div>
              <div className="dispatch-stat-card">
                <div className="dispatch-stat-icon">🚗</div>
                <div className="dispatch-stat-content">
                  <h4>Vehicles Available</h4>
                  <p className="dispatch-stat-number">{dispatchData.vehicleCount}</p>
                  <p className="dispatch-stat-subtitle">Total fleet size</p>
                </div>
              </div>
              <div className="dispatch-stat-card">
                <div className="dispatch-stat-icon">⏱️</div>
                <div className="dispatch-stat-content">
                  <h4>Avg Response Time</h4>
                  <p className="dispatch-stat-number">6.8 min</p>
                  <p className="dispatch-stat-subtitle">Emergency deployment</p>
                </div>
              </div>
              <div className="dispatch-stat-card">
                <div className="dispatch-stat-icon">✅</div>
                <div className="dispatch-stat-content">
                  <h4>Unit Status</h4>
                  <p className="dispatch-stat-number">{dispatchData.activeStatus}</p>
                  <p className="dispatch-stat-subtitle">Operational status</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="dispatch-footer">
        <div className="dispatch-container">
          <div className="dispatch-footer-content">
            <p>© {new Date().getFullYear()} Emergency Dispatch System | All Rights Reserved</p>
            <p className="dispatch-footer-subtitle">Secure Unit Management • Real-time Coordination • 24/7 Operations</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default DispatchProfile;