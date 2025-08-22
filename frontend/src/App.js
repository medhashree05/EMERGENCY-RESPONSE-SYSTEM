import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import HomePage from './Pages/HomePage';
import Register from './Pages/Register';
import Login from './Pages/Login';
import Profile from './Pages/Profile';
import Dashboard from './Pages/Dashboard';
import Location from './Pages/Location';
import Settings from './Pages/Settings';
import ChatPage from "./Pages/ChatPage";
import 'leaflet/dist/leaflet.css';

function App() { 
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path='/profile' element ={<Profile/>}/>
        <Route path='/dashboard' element={<Dashboard/>}/> 
        <Route path='/location' element={<Location/>}/>
        <Route path='/settings' element={<Settings/>}/>
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    </Router>
  );
}
export default App;