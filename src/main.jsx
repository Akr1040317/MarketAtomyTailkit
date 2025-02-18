import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";         // Main layout or default
import LoginPage from "./LoginPage"; // Your new login page
import SignupPage from "./SignupPage";
import Dashboard from "./DarkSidebarWithSideContentLeft"; // Example dashboard page

import "./assets/tailkit.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />  {/* Set login as default */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/home" element={<App />} />  {/* Move App to a different route */}
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

