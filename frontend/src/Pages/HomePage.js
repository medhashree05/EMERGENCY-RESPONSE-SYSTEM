import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

function HomePage() {
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [processingButton, setProcessingButton] = useState(null);

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
  setProcessingButton("panic");  // 👈 mark this button as loading
  setEmergencyActive(true);
  setButtonDisabled(true);
  try {
     const token = localStorage.getItem("token");
    if (token) {
      // Get current location first
      const getCurrentLocation = () => {
        return new Promise((resolve, reject) => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                resolve({
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude
                });
              },
              (error) => {
                console.error("Location error:", error);
                reject(error);
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
              }
            );
          } else {
            reject(new Error("Geolocation is not supported"));
          }
        });
      };

      let locationData = null;
      let locationString = "Location unavailable";
      
      try {
        // Try to get current location
        locationData = await getCurrentLocation();
        console.log("Current location obtained:", locationData);
        locationString = `${locationData.latitude}, ${locationData.longitude}`;
        
        // Update user's location in the database
        const locationResponse = await fetch("http://localhost:8000/update_location", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            latitude: locationData.latitude,
            longitude: locationData.longitude,
          }),
        });

        if (!locationResponse.ok) {
          const locationError = await locationResponse.json();
          console.error("Failed to update location:", locationError);
          // Continue with emergency call even if location update fails
        } else {
          console.log("Location updated successfully");
        }
      } catch (locationError) {
        console.error("Failed to get current location:", locationError);
        // Continue with emergency call even if location fails
      }
      locationData = await getCurrentLocation();
        console.log("Current location obtained:", locationData);
      // Create emergency entry in database
      try {
        const emergencyResponse = await fetch("http://localhost:8000/emergency/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: "General Emergency", // You can customize this or make it dynamic
            location: locationString,
            priority: "Critical",
            latitude:locationData.latitude,
            longitude:locationData.longitude
          }),
        });

        const emergencyData = await emergencyResponse.json();
        if (!emergencyResponse.ok) {
          console.error("Failed to create emergency entry:", emergencyData);
        } else {
          console.log("Emergency entry created successfully:", emergencyData);
        }
      } catch (emergencyError) {
        console.error("Error creating emergency entry:", emergencyError);
      }

      // Make the original emergency call
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
  setProcessingButton(null);  // 👈 reset when done
  alert("🚨 Emergency service alerted!");
  setTimeout(() => {
  
    setEmergencyActive(false);
  }, 1000);
  // Re-enable button after 5 seconds
  setTimeout(() => {
    setButtonDisabled(false);
    setEmergencyActive(false);
  }, 5000);
};
const handleServiceEmergency = async (emergencyType) => {
  setEmergencyActive(true);
  setButtonDisabled(true); // Disable button
  setProcessingButton(emergencyType); 
  try {
    const token = localStorage.getItem("token");
    if (token) {
      // Get current location first
      const getCurrentLocation = () => {
        return new Promise((resolve, reject) => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                resolve({
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude
                });
              },
              (error) => {
                console.error("Location error:", error);
                reject(error);
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
              }
            );
          } else {
            reject(new Error("Geolocation is not supported"));
          }
        });
      };

      let locationData = null;
      let locationString = "Location unavailable";
      
      try {
        // Try to get current location
        locationData = await getCurrentLocation();
        console.log("Current location obtained:", locationData);
        locationString = `${locationData.latitude}, ${locationData.longitude}`;
        
        // Update user's location in the database
        const locationResponse = await fetch("http://localhost:8000/update_location", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            latitude: locationData.latitude,
            longitude: locationData.longitude,
          }),
        });

        if (!locationResponse.ok) {
          const locationError = await locationResponse.json();
          console.error("Failed to update location:", locationError);
        } else {
          console.log("Location updated successfully");
        }
      } catch (locationError) {
        console.error("Failed to get current location:", locationError);
      }

      // Create emergency entry in database
      try {
        const emergencyResponse = await fetch("http://localhost:8000/emergency/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: emergencyType,
            location: locationString,
            priority: "Critical"
          }),
        });

        const emergencyData = await emergencyResponse.json();
        if (!emergencyResponse.ok) {
          console.error("Failed to create emergency entry:", emergencyData);
        } else {
          console.log(`${emergencyType} emergency entry created successfully:`, emergencyData);
        }
      } catch (emergencyError) {
        console.error("Error creating emergency entry:", emergencyError);
      }

      // Make the emergency call
      await fetch("http://localhost:8000/emergency/call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      // 🆕 NEW FUNCTIONALITY: Send emergency-specific message to chat and navigate
      try {
        // Generate emergency-specific message based on type
        const getEmergencyMessage = (type) => {
          const messages = {
            'Police': `🚨 POLICE EMERGENCY ALERT: I need immediate police assistance at my location (${locationString}). Please help me with police contact information, nearby stations, and what to do while waiting for help.`,
            'Fire': `🔥 FIRE EMERGENCY ALERT: There is a fire emergency at my location (${locationString}). I need fire department contact information, nearby fire stations, and immediate fire safety guidance.`,
            'Medical': `🚑 MEDICAL EMERGENCY ALERT: I have a medical emergency at my location (${locationString}). Please provide emergency medical guidance, nearby hospitals, ambulance services, and first aid instructions.`,
            'Ambulance': `🚑 AMBULANCE EMERGENCY ALERT: I need an ambulance at my location (${locationString}). Please help with ambulance services, medical guidance, and what to do while waiting for medical help.`
          };
          return messages[type] || `🚨 EMERGENCY ALERT: I have a ${type} emergency at my location (${locationString}). Please provide immediate assistance and guidance.`;
        };

        const emergencyMessage = getEmergencyMessage(emergencyType);

        // Send emergency message to chat endpoint
        const chatResponse = await fetch("http://localhost:8000/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: emergencyMessage,
            sessionId: null // Start new emergency session
          }),
        });

        const chatData = await chatResponse.json();
        
        if (chatResponse.ok) {
          console.log("Emergency message sent to chat:", chatData);
          
          // Store the emergency session ID and response for chat page
          localStorage.setItem('emergencySessionId', chatData.sessionId);
          localStorage.setItem('emergencyResponse', JSON.stringify({
            userMessage: emergencyMessage,
            aiResponse: chatData.reply,
            emergencyType: emergencyType,
            location: locationString,
            timestamp: new Date().toISOString()
          }));
          
          // 🆕 Navigate to chat page after a short delay
          setTimeout(() => {
            // Assuming you're using React Router - replace with your navigation method
            if (typeof navigate === 'function') {
              navigate('/chat', { 
                state: { 
                  emergencyType, 
                  location: locationString,
                  sessionId: chatData.sessionId 
                } 
              });
            } else {
              // Fallback for direct window navigation
              window.location.href = '/chat';
            }
          }, 500); // 2 second delay to show emergency alert first
          
        } else {
          console.error("Failed to send emergency message to chat:", chatData);
        }
      } catch (chatError) {
        console.error("Error sending emergency message to chat:", chatError);
      }
    }
  } catch (err) {
    console.error(`${emergencyType} emergency call failed:`, err);
  }
  setProcessingButton(null); 
  alert("🚨 Emergency service alerted!"); // Popup message

  // Re-enable button after 5 seconds
  setTimeout(() => {
    setButtonDisabled(false);
    
  }, 5000);
  
};

// Individual handlers for each service type
const handlePoliceEmergency = () => {
  handleServiceEmergency("Police Emergency");
};

const handleMedicalEmergency = () => {
  handleServiceEmergency("Medical Emergency");
};

const handleFireEmergency = () => {
  handleServiceEmergency("Fire Emergency");
};

const handleAccidentEmergency = () => {
  handleServiceEmergency("Accident Emergency");
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
  disabled={buttonDisabled}
>
  {processingButton === "panic"
    ? "⏳ Processing..."
    : (emergencyActive ? "EMERGENCY ACTIVATED" : "EMERGENCY")}
</button>
            
            <p className="panic-button-info">
              {emergencyActive 
                ? 'Emergency services have been alerted and your location shared'
                : 'This will immediately alert emergency services and share your location'
              }
            </p>
          </section>

          {/* Emergency Services */}
          {/* Emergency Services */}
<section className="emergency-services">
  <h3>Emergency Services</h3>
  
  <div className="services-grid">
    {/* Police */}
    <div className="service-card">
      <div className="service-icon police-icon">🛡️</div>
      <h4>Police</h4>
      <p>Criminal activity, theft, violence, suspicious behavior</p>
     <button
  className="service-btn police-btn"
  onClick={handlePoliceEmergency}
  disabled={buttonDisabled}
>
  {processingButton === "Police Emergency"
    ? "⏳ Processing..."
    : "Need Police Assistance"}
</button>

    </div>

    {/* Medical */}
    <div className="service-card">
      <div className="service-icon medical-icon">❤️</div>
      <h4>Medical</h4>
      <p>Injuries, illness, cardiac events, breathing problems</p>
     <button
  className="service-btn medical-btn"
  onClick={handleMedicalEmergency}
  disabled={buttonDisabled}
>
  {processingButton === "Medical Emergency"
    ? "⏳ Processing..."
    : "Need Medical Assistance"}
</button>

    </div>

    {/* Fire */}
    <div className="service-card">
      <div className="service-icon fire-icon">🔥</div>
      <h4>Fire</h4>
      <p>Fire, smoke, gas leaks, hazardous materials</p>
      <button
  className="service-btn fire-btn"
  onClick={handleFireEmergency}
  disabled={buttonDisabled}
>
  {processingButton === "Fire Emergency"
    ? "⏳ Processing..."
    : "Need Fire Assistance"}
</button>

    </div>

    {/* Accident */}
    <div className="service-card">
      <div className="service-icon accident-icon">🚗</div>
      <h4>Accident</h4>
      <p>Vehicle accidents, collisions, traffic incidents</p>
 <button
  className="service-btn accident-btn"
  onClick={handleAccidentEmergency}
  disabled={buttonDisabled}
>
  {processingButton === "Accident Emergency"
    ? "⏳ Processing..."
    : "Call Accident"}
</button>

    </div>
  </div>
</section>

          {/* Additional Services */}
          <section className="additional-services">
            <div className="additional-grid">
              <div className="additional-card">
                <div className="additional-header">
                  <span className="additional-icon">📍</span>
                  <h4>Location</h4>
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