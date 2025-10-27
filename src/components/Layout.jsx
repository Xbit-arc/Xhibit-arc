// src/components/Layout.jsx
import React from "react";
import Navbar from "../routes/Navbar";
import { Outlet } from "react-router-dom";

const Layout = () => {
  return (
    <>
      {/* Navbar only shows on private routes (Dashboard, Homepage, etc.) */}
      <Navbar />
      <Outlet />
    </>
  );
};

export default Layout;
