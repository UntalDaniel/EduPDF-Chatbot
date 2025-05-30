import React from 'react';
import { Outlet } from 'react-router-dom';
import DashboardNavbar from './DashboardNavbar';

const DashboardLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 text-slate-100 font-sans">
      <DashboardNavbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout; 