import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";         // Main layout or default
import LandingPage from "./LandingPage"; // Landing page (includes login/signup)
import Dashboard from "./DarkSidebarWithSideContentLeft"; // Example dashboard page

import "./assets/tailkit.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />  {/* Landing page as default */}
        <Route path="/login" element={<LandingPage />} />  {/* Login uses LandingPage */}
        <Route path="/signup" element={<LandingPage />} />  {/* Signup uses LandingPage */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/home" element={<App />} />  {/* Move App to a different route */}
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

