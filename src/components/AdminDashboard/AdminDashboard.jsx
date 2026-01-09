import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import UserManagement from './UserManagement';
import AnalyticsDashboard from './AnalyticsDashboard';
import ReportsInsights from './ReportsInsights';
import ContentManagement from './ContentManagement';
import SystemMonitoring from './SystemMonitoring';

const TABS = [
  { id: 'users', label: 'User Management', icon: '👥' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'reports', label: 'Reports & Insights', icon: '📈' },
  { id: 'content', label: 'Content Management', icon: '📚' },
  { id: 'monitoring', label: 'System Monitoring', icon: '🔍' },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('users');
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          const role = userData.role || '';
          setUserRole(role);

          if (role !== 'admin') {
            // Redirect non-admin users to dashboard
            navigate('/dashboard');
            return;
          }
        } else {
          navigate('/dashboard');
          return;
        }
      } catch (error) {
        console.error('Error checking admin access:', error);
        navigate('/dashboard');
        return;
      } finally {
        setLoading(false);
      }
    };

    checkAdminAccess();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4"></div>
          <p className="text-gray-300 text-lg">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (userRole !== 'admin') {
    return null; // Will redirect
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagement />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'reports':
        return <ReportsInsights />;
      case 'content':
        return <ContentManagement />;
      case 'monitoring':
        return <SystemMonitoring />;
      default:
        return <UserManagement />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      {/* Header */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 px-6 py-4">
        <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-gray-400 mt-1">Manage platform users, analytics, and content</p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gray-800/30 backdrop-blur-sm border-b border-gray-700">
        <div className="flex overflow-x-auto px-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-400 bg-gray-800/50'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {renderActiveTab()}
      </div>
    </div>
  );
}
