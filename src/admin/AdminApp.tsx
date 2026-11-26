/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../lib/authContext';
import { RequireAdminAuth } from './components/RequireAdminAuth';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminVerificationsPage } from './pages/AdminVerificationsPage';
import { AdminPlayersPage } from './pages/AdminPlayersPage';
import { AdminTournamentsPage } from './pages/AdminTournamentsPage';
import { AdminAiControlPage } from './pages/AdminAiControlPage';
import { AdminCpanelPage } from './pages/AdminCpanelPage';
import {
  AdminAdministratorsPage,
  AdminGamesPage,
  AdminReportsPage,
  AdminRoomsPage,
  AdminSettingsPage,
  AdminSupportPage,
  AdminTransactionsPage,
} from './pages/AdminOperationsPages';

export function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="login" element={<AdminLoginPage />} />

      <Route
        path="dashboard"
        element={
          <RequireAdminAuth>
            <AdminDashboardPage />
          </RequireAdminAuth>
        }
      />
      <Route
        path="verifications"
        element={
          <RequireAdminAuth>
            <AdminVerificationsPage />
          </RequireAdminAuth>
        }
      />
      <Route
        path="players"
        element={
          <RequireAdminAuth>
            <AdminPlayersPage />
          </RequireAdminAuth>
        }
      />
      <Route
        path="games"
        element={
          <RequireAdminAuth>
            <AdminGamesPage />
          </RequireAdminAuth>
        }
      />
      <Route
        path="rooms"
        element={
          <RequireAdminAuth>
            <AdminRoomsPage />
          </RequireAdminAuth>
        }
      />
      <Route
        path="tournaments"
        element={
          <RequireAdminAuth>
            <AdminTournamentsPage />
          </RequireAdminAuth>
        }
      />
      <Route
        path="ai-players"
        element={
          <RequireAdminAuth>
            <AdminAiControlPage />
          </RequireAdminAuth>
        }
      />
      <Route
        path="transactions"
        element={
          <RequireAdminAuth>
            <AdminTransactionsPage />
          </RequireAdminAuth>
        }
      />
      <Route
        path="cpanel"
        element={
          <RequireAdminAuth>
            <AdminCpanelPage />
          </RequireAdminAuth>
        }
      />
      <Route
        path="reports"
        element={
          <RequireAdminAuth>
            <AdminReportsPage />
          </RequireAdminAuth>
        }
      />
      <Route
        path="support"
        element={
          <RequireAdminAuth>
            <AdminSupportPage />
          </RequireAdminAuth>
        }
      />
      <Route
        path="administrators"
        element={
          <RequireAdminAuth>
            <AdminAdministratorsPage />
          </RequireAdminAuth>
        }
      />
      <Route
        path="settings"
        element={
          <RequireAdminAuth>
            <AdminSettingsPage />
          </RequireAdminAuth>
        }
      />

      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}

export default function AdminApp() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/admin/*" element={<AdminRoutes />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
