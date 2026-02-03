import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import DisplayPage from "./pages/DisplayPage.jsx";
import VotePage from "./pages/VotePage.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/display" replace />} />
        <Route path="/display" element={<DisplayPage />} />
        <Route path="/vote" element={<VotePage />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);

