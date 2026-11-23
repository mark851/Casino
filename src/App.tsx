/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/authContext';
import { SocialProvider } from './lib/socialContext';
import { PublicLayout } from './components/PublicLayout';
import { LiveSocialOverlay } from './components/LiveSocialOverlay';
import { RequireApprovedKyc, RequirePlayerAuth } from './components/RouteGuards';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import {
  ContactPage,
  HowToPlayPage,
  LeaderboardPage,
  PrivacyPage,
  ResponsibleGamingPage,
  SupportPage,
  TermsPage,
} from './pages/PublicPages';
import { PlayerDashboardPage } from './pages/PlayerDashboardPage';
import { VerificationStatusPage } from './pages/VerificationStatusPage';
import {
  GameHistoryPage,
  NotificationsPage,
  ProfilePage,
  TransactionsPage,
  WalletPage,
} from './pages/PlayerWorkspacePages';
import { PlayLobbyPage } from './pages/PlayLobbyPage';
import { TournamentsPage } from './pages/TournamentsPage';
import { GameTablePage } from './pages/GameTablePage';
import { FriendsPage } from './pages/FriendsPage';
import { AdminRoutes } from './admin/AdminApp';

const WithPublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PublicLayout>{children}</PublicLayout>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocialProvider>
          <LiveSocialOverlay />
          <Routes>
            {/* Public Routes */}
            <Route
              path="/"
              element={
                <WithPublicLayout>
                  <HomePage />
                </WithPublicLayout>
              }
            />
            <Route
              path="/login"
              element={
                <WithPublicLayout>
                  <LoginPage />
                </WithPublicLayout>
              }
            />
            <Route
              path="/register"
              element={
                <WithPublicLayout>
                  <RegisterPage />
                </WithPublicLayout>
              }
            />
            <Route
              path="/how-to-play"
              element={
                <WithPublicLayout>
                  <HowToPlayPage />
                </WithPublicLayout>
              }
            />
            <Route
              path="/leaderboard"
              element={
                <WithPublicLayout>
                  <LeaderboardPage />
                </WithPublicLayout>
              }
            />
            <Route
              path="/support"
              element={
                <WithPublicLayout>
                  <SupportPage />
                </WithPublicLayout>
              }
            />
            <Route
              path="/contact"
              element={
                <WithPublicLayout>
                  <ContactPage />
                </WithPublicLayout>
              }
            />
            <Route
              path="/terms"
              element={
                <WithPublicLayout>
                  <TermsPage />
                </WithPublicLayout>
              }
            />
            <Route
              path="/privacy"
              element={
                <WithPublicLayout>
                  <PrivacyPage />
                </WithPublicLayout>
              }
            />
            <Route
              path="/responsible-gaming"
              element={
                <WithPublicLayout>
                  <ResponsibleGamingPage />
                </WithPublicLayout>
              }
            />

            {/* Player Authenticated Workspace */}
            <Route
              path="/dashboard"
              element={
                <RequirePlayerAuth>
                  <PlayerDashboardPage />
                </RequirePlayerAuth>
              }
            />
            <Route
              path="/verification-status"
              element={
                <RequirePlayerAuth>
                  <VerificationStatusPage />
                </RequirePlayerAuth>
              }
            />
            <Route
              path="/profile"
              element={
                <RequirePlayerAuth>
                  <ProfilePage />
                </RequirePlayerAuth>
              }
            />
            <Route
              path="/wallet"
              element={
                <RequirePlayerAuth>
                  <WalletPage />
                </RequirePlayerAuth>
              }
            />
            <Route
              path="/transactions"
              element={
                <RequirePlayerAuth>
                  <TransactionsPage />
                </RequirePlayerAuth>
              }
            />
            <Route
              path="/notifications"
              element={
                <RequirePlayerAuth>
                  <NotificationsPage />
                </RequirePlayerAuth>
              }
            />
            <Route
              path="/game-history"
              element={
                <RequirePlayerAuth>
                  <GameHistoryPage />
                </RequirePlayerAuth>
              }
            />

            {/* KYC-Gated Gameplay & Tournament Arenas */}
            <Route
              path="/play"
              element={
                <RequirePlayerAuth>
                  <RequireApprovedKyc>
                    <PlayLobbyPage />
                  </RequireApprovedKyc>
                </RequirePlayerAuth>
              }
            />
            <Route
              path="/rooms"
              element={
                <RequirePlayerAuth>
                  <RequireApprovedKyc>
                    <PlayLobbyPage />
                  </RequireApprovedKyc>
                </RequirePlayerAuth>
              }
            />
            <Route path="/tournaments" element={<TournamentsPage />} />
            <Route
              path="/game/:roomId"
              element={
                <RequirePlayerAuth>
                  <RequireApprovedKyc>
                    <GameTablePage />
                  </RequireApprovedKyc>
                </RequirePlayerAuth>
              }
            />
            <Route
              path="/table/:roomId"
              element={
                <RequirePlayerAuth>
                  <RequireApprovedKyc>
                    <GameTablePage />
                  </RequireApprovedKyc>
                </RequirePlayerAuth>
              }
            />

            <Route
              path="/friends"
              element={
                <RequirePlayerAuth>
                  <FriendsPage />
                </RequirePlayerAuth>
              }
            />

            {/* Admin Portal (Single-Router SPA Integration) */}
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/*" element={<AdminRoutes />} />

            {/* Catch-all Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SocialProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
