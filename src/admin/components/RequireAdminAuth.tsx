import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';

export const RequireAdminAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, authReady, isAdmin, dataLoading } = useAuth();
  const location = useLocation();

  if (!authReady || (firebaseUser && dataLoading)) {
    return (
      <div className="min-h-screen bg-[#050806] flex items-center justify-center text-neutral-300 text-sm">
        Verifying administrator authorisation...
      </div>
    );
  }

  if (!firebaseUser || !isAdmin) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};
