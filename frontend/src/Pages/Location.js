import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import './Location.css';

function Location() {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [emergencyContacts] = useState([
    { id: 1, name: 'Family Emergency', phone: '+1 (555) 123-4567', relationship: 'Family' },
    { id: 2, name: 'Work Emergency', phone: '+1 (555) 987-6543', relationship: 'Work' }
  ]);
  const [savedLocations] = useState([
    { id: 1, name: 'Home', address: '123 Main St, City, State 12345', lat: 40.7128, lng: -74.0060 },
    { id: 2, name: 'Work', address: '456 Business Ave, City, State 12345', lat: 40.7589, lng: -73.9851 }
  ]);
  const [sharing, setSharing] = useState(false);
  const navigate = useNavigate();

  // Custom hook to fly map when location updates
  function FlyToCurrentLocation({ location }) {
    const map = useMap();
    useEffect(() => {
      if (location) {
        map.flyTo([location.lat, location.lng], 15);
      }
    }, [location, map]);
    return null;
  }

  const handleEnableLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentLocation(coords);
          setLocationEnabled(true);
        },
        () => {
          alert('Location access denied. Please enable location services.');
        }
      );
    }
  };

  const handleShareLocation = () => {
    if (!currentLocation) {
      alert('Location not available. Please enable location services first.');
      return;
    }
    setSharing(true);
    setTimeout(() => {
      setSharing(false);
      alert('Location shared with emergency services successfully!');
    }, 2000);
  };

  const handleEmergencyCall = (contact) => {
    if (window.confirm(`Call ${contact.name} at ${contact.phone}?`)) {
      window.location.href = `tel:${contact.phone}`;
    }
  };

  // Leaflet icons
  const homeIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/25/25694.png',
    iconSize: [32, 32],
  });

  const workIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1077/1077976.png',
    iconSize: [32, 32],
  });

  const userIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/149/149060.png',
    iconSize: [32, 32],
  });

  return (
    <div className="location-page">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="logo-section">
              <div className="logo"><span className="shield-icon">🛡️</span></div>
              <div className="logo-text">
                <h1>Emergency Response System</h1>
                <p>Location Services</p>
              </div>
            </div>
            <div className="header-actions">
              <button className="back-btn" onClick={() => navigate('/')}>← Back to Home</button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="navigation">
        <div className="container">
          <div className="nav-links">
            <button className="nav-link"onClick={() => navigate('/')}>Emergency</button>
            <button className="nav-link"onClick={() => navigate('/profile')}>Profile</button>
            <button className="nav-link active">Location</button>
            <button className="nav-link"onClick={() => navigate('/dashboard')}>Dashboard</button>
            <button className="nav-link"onClick={() => navigate('/settings')}>Settings</button>
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="main-content">
        <div className="container">
          <h2>Location Services</h2>

          {/* Location Status */}
          <section className="location-status">
            <div className="status-card">
              <h3>Location Status</h3>
              <p className={locationEnabled ? 'enabled' : 'disabled'}>
                {locationEnabled ? 'Location Enabled' : 'Location Disabled'}
              </p>
              {!locationEnabled ? (
                <button className='contact' onClick={handleEnableLocation}>Enable Location</button>
              ) : (
                <button onClick={handleShareLocation} disabled={sharing}>
                  {sharing ? 'Sharing...' : 'Share Location'}
                </button>
              )}
            </div>
          </section>

          {/* Map */}
          <section className="map-section">
            <h3>Live Map</h3>
            <MapContainer
              center={[40.7128, -74.0060]}
              zoom={13}
              scrollWheelZoom
              style={{ height: '400px', width: '100%', borderRadius: '10px' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />

              {/* Saved Locations */}
              {savedLocations.map(loc => (
                <Marker
                  key={loc.id}
                  position={[loc.lat, loc.lng]}
                  icon={loc.name === 'Home' ? homeIcon : workIcon}
                >
                  <Popup>
                    <b>{loc.name}</b><br />{loc.address}
                  </Popup>
                </Marker>
              ))}

              {/* Current Location */}
              {currentLocation && (
                <>
                  <Marker position={[currentLocation.lat, currentLocation.lng]} icon={userIcon}>
                    <Popup>📍 You are here</Popup>
                  </Marker>
                  <FlyToCurrentLocation location={currentLocation} />
                </>
              )}
            </MapContainer>
          </section>

          <section className="saved-locations">
            <h3>Saved Locations</h3>
            <div className="locations-grid">
              {savedLocations.map(location => (
                <div key={location.id} className="location-card">
                  <div className="location-header">
                    <span className="location-icon">📍</span>
                    <h4>{location.name}</h4>
                  </div>
                  <p className="location-address">{location.address}</p>
                  <div className="location-actions">
                    <button className="location-btn">Set as Emergency Location</button>
                  </div>
                </div>
              ))}
              <div className="location-card add-location">
                <div className="add-location-content">
                  <span className="add-icon">➕</span>
                  <h4>Add New Location</h4>
                  <p>Save important locations for quick access</p>
                </div>
              </div>
            </div>
          </section>


          {/* Emergency Contacts */}
          <section className="emergency-contacts">
            <h3>Emergency Contacts</h3>
            <div className="contacts-grid">
              {emergencyContacts.map(contact => (
                <div key={contact.id} className="contact-card">
                  <h4>{contact.name}</h4>
                  <p>{contact.relationship}</p>
                  <p>{contact.phone}</p>
                  <button  className='call-btn'onClick={() => handleEmergencyCall(contact)}>📞 Call</button>
                </div>
              ))}
            </div>
          </section>
          <section className="quick-actions">
            <h3>Location Actions</h3>
            <div className="quick-actions-grid">
              <button className="quick-action-btn">🚨 Share Emergency Location</button>
              <button className="quick-action-btn">🗺️ View Route to Hospital</button>
              <button className="quick-action-btn">📱 Send Location to Contact</button>
              <button className="quick-action-btn">⚙️ Location Settings</button>
            </div>
          </section>
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <p>© {new Date().getFullYear()} Emergency Response System | All Rights Reserved</p>
            <p className="footer-subtitle">Location services powered by secure GPS technology</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Location;
