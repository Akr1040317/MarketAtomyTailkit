import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { exportUsersToCSV, downloadCSV, filterUsers } from '../../utils/adminUtils';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import jsPDF from 'jspdf';
import { processComputedScores } from '../../utils/analytics';
import { CATEGORY_RANGES } from '../../utils/scoreRanges';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [assessmentFilter, setAssessmentFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [answersModalOpen, setAnswersModalOpen] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  
  // For answers modal
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});
  const [sectionResults, setSectionResults] = useState([]);

  useEffect(() => {
    fetchUsers();
    fetchSections();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [users, searchTerm, roleFilter, assessmentFilter, dateFrom, dateTo, sortConfig]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(usersQuery);
      const usersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
      setFilteredUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSections = async () => {
    try {
      const q = query(collection(db, 'BHC_Assessment'), orderBy('order'));
      const querySnapshot = await getDocs(q);
      const sectionsData = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setSections(sectionsData);
    } catch (error) {
      console.error('Error fetching sections:', error);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const applyFilters = () => {
    const filters = {
      search: searchTerm,
      role: roleFilter,
      assessmentStatus: assessmentFilter,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null
    };
    let filtered = filterUsers(users, filters);
    
    // Apply sorting
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        let aVal, bVal;
        
        switch (sortConfig.key) {
          case 'name':
            aVal = `${a.firstName || ''} ${a.lastName || ''}`.toLowerCase();
            bVal = `${b.firstName || ''} ${b.lastName || ''}`.toLowerCase();
            break;
          case 'email':
            aVal = (a.email || '').toLowerCase();
            bVal = (b.email || '').toLowerCase();
            break;
          case 'role':
            aVal = a.role || 'tier1';
            bVal = b.role || 'tier1';
            break;
          case 'signupDate':
            aVal = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            bVal = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            break;
          case 'lastLogin':
            aVal = a.lastLoggedOn?.toDate ? a.lastLoggedOn.toDate().getTime() : 0;
            bVal = b.lastLoggedOn?.toDate ? b.lastLoggedOn.toDate().getTime() : 0;
            break;
          default:
            return 0;
        }
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    setFilteredUsers(filtered);
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      setUpdatingRole(true);
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, { role: newRole });
      
      setUsers(prevUsers =>
        prevUsers.map(u => (u.id === userId ? { ...u, role: newRole } : u))
      );
      
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({ ...selectedUser, role: newRole });
      }
      
      alert('User role updated successfully!');
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Error updating user role. Please try again.');
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleExportCSV = () => {
    const csvContent = exportUsersToCSV(filteredUsers);
    const filename = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csvContent, filename);
  };

  const openUserDetails = (user) => {
    setSelectedUser(user);
    setDetailsModalOpen(true);
  };

  const openUserAnswers = async (user) => {
    setSelectedUser(user);
    setAnswersModalOpen(true);
    
    // Fetch user's section results
    try {
      const q = query(
        collection(db, 'sectionResults'),
        where('userId', '==', user.id)
      );
      const querySnapshot = await getDocs(q);
      const results = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSectionResults(results);
      
      // Build answers object
      const answersObj = {};
      results.forEach(result => {
        if (result.answers) {
          Object.keys(result.answers).forEach(qId => {
            const answer = result.answers[qId];
            if (Array.isArray(answer)) {
              answersObj[qId] = answer.map(a => a.answer);
            } else {
              answersObj[qId] = answer.answer;
            }
          });
        }
      });
      setUserAnswers(answersObj);
      
      // Set first section as selected
      if (sections.length > 0) {
        setSelectedSection(sections[0]);
      }
    } catch (error) {
      console.error('Error fetching user answers:', error);
    }
  };

  const handleSectionClick = (section) => {
    setSelectedSection(section);
  };

  const downloadUserResponsesCSV = (user) => {
    const rows = [];
    rows.push(['Section', 'Question ID', 'Question Text', 'Answer', 'Weight']);
    
    sectionResults.forEach(result => {
      const section = sections.find(s => s.title === result.sectionName);
      if (!section || !section.questions) return;
      
      section.questions.forEach(question => {
        const answer = result.answers?.[question.id];
        if (answer) {
          if (Array.isArray(answer)) {
            answer.forEach(a => {
              rows.push([
                result.sectionName,
                question.id,
                question.text,
                a.answer,
                a.weight || 0
              ]);
            });
          } else {
            rows.push([
              result.sectionName,
              question.id,
              question.text,
              answer.answer,
              answer.weight || 0
            ]);
          }
        }
      });
    });
    
    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const filename = `${user.firstName}_${user.lastName}_responses_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csvContent, filename);
  };

  const downloadUserResponsesPDF = async (user) => {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    
    let yPos = 20;
    const pageWidth = 210;
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    // Helper function to check for new page
    const checkNewPage = (requiredHeight) => {
      if (yPos + requiredHeight > 280) {
        pdf.addPage();
        yPos = 20;
        return true;
      }
      return false;
    };
    
    // Helper function to get health level color
    const getHealthColor = (level) => {
      switch(level) {
        case 'high': return [34, 197, 94]; // green-500
        case 'medium': return [234, 179, 8]; // yellow-500
        case 'low': return [239, 68, 68]; // red-500
        default: return [107, 114, 128]; // gray-500
      }
    };
    
    // Header
    pdf.setFontSize(20);
    pdf.setFont(undefined, 'bold');
    pdf.text(`${user.firstName} ${user.lastName} - Assessment Report`, margin, yPos);
    yPos += 8;
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Email: ${user.email}`, margin, yPos);
    yPos += 5;
    pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    yPos += 10;
    
    // Calculate enhanced scores if available
    let enhancedScores = null;
    if (user.computedScores) {
      enhancedScores = processComputedScores(user.computedScores);
    }
    
    // Overall Health Score Section
    if (enhancedScores && enhancedScores.overallHealth) {
      checkNewPage(25);
      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.text('Overall Business Health', margin, yPos);
      yPos += 8;
      
      pdf.setFontSize(14);
      pdf.setFont(undefined, 'normal');
      const overallHealth = enhancedScores.overallHealth;
      pdf.text(`Overall Health Score: ${overallHealth.percentage}%`, margin, yPos);
      yPos += 6;
      pdf.text(`Health Level: ${overallHealth.healthLevel.charAt(0).toUpperCase() + overallHealth.healthLevel.slice(1)}`, margin, yPos);
      yPos += 10;
    }
    
    // Category Scores Breakdown
    if (enhancedScores) {
      checkNewPage(40);
      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.text('Category Scores Breakdown', margin, yPos);
      yPos += 8;
      
      const categoryKeys = Object.keys(enhancedScores).filter(key => key !== 'overallHealth');
      categoryKeys.forEach((key) => {
        checkNewPage(15);
        const analytics = enhancedScores[key];
        const categoryRange = CATEGORY_RANGES[key];
        if (!analytics || !categoryRange) return;
        
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        pdf.text(categoryRange.label, margin, yPos);
        yPos += 6;
        
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'normal');
        pdf.text(`Score: ${analytics.rawScore} / ${analytics.maxPossible}`, margin + 5, yPos);
        yPos += 5;
        pdf.text(`Percentage: ${analytics.percentage}%`, margin + 5, yPos);
        yPos += 5;
        
        // Health level badge (colored text)
        const healthColor = getHealthColor(analytics.healthLevel);
        pdf.setTextColor(...healthColor);
        pdf.setFont(undefined, 'bold');
        pdf.text(`Health Level: ${analytics.healthLevel.charAt(0).toUpperCase() + analytics.healthLevel.slice(1)}`, margin + 5, yPos);
        pdf.setTextColor(0, 0, 0); // Reset to black
        yPos += 7;
      });
      yPos += 5;
    }
    
    // Section Scores Breakdown
    checkNewPage(20);
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Section Scores Breakdown', margin, yPos);
    yPos += 8;
    
    const sortedResults = [...sectionResults].sort((a, b) => {
      const sectionA = sections.find(s => s.title === a.sectionName);
      const sectionB = sections.find(s => s.title === b.sectionName);
      return (sectionA?.order || 0) - (sectionB?.order || 0);
    });
    
    sortedResults.forEach((result) => {
      checkNewPage(10);
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      pdf.text(`${result.sectionName}: ${result.sectionScore || 0} points`, margin + 5, yPos);
      yPos += 6;
    });
    yPos += 5;
    
    // Detailed Responses Section
    checkNewPage(15);
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Detailed Question Responses', margin, yPos);
    yPos += 10;
    
    // Sections
    sections.forEach((section, sIdx) => {
      const result = sectionResults.find(r => r.sectionName === section.title);
      if (!result || !section.questions) return;
      
      checkNewPage(20);
      
      // Section title
      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.text(`${sIdx + 1}. ${section.title}`, margin, yPos);
      yPos += 6;
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      pdf.text(`Section Score: ${result.sectionScore || 0} points`, margin + 5, yPos);
      yPos += 8;
      
      // Questions
      section.questions.forEach((question, qIdx) => {
        checkNewPage(15);
        
        const answer = result.answers?.[question.id];
        if (!answer) return;
        
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'normal');
        
        // Question text
        const questionText = `${qIdx + 1}. ${question.text}`;
        const questionLines = pdf.splitTextToSize(questionText, contentWidth);
        questionLines.forEach(line => {
          pdf.text(line, margin, yPos);
          yPos += 5;
        });
        
        // Answer
        pdf.setFont(undefined, 'italic');
        let answerText = '';
        if (Array.isArray(answer)) {
          answerText = `Answer: ${answer.map(a => a.answer).join(', ')}`;
        } else {
          answerText = `Answer: ${answer.answer}`;
        }
        const answerLines = pdf.splitTextToSize(answerText, contentWidth - 10);
        answerLines.forEach(line => {
          pdf.text(line, margin + 5, yPos);
          yPos += 5;
        });
        
        yPos += 3;
      });
      
      yPos += 5;
    });
    
    pdf.save(`${user.firstName}_${user.lastName}_responses_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const getAssessmentStatus = (user) => {
    if (!user.computedScores || Object.keys(user.computedScores).length < 5) {
      return { status: 'Incomplete', color: 'text-yellow-500' };
    }
    return { status: 'Completed', color: 'text-emerald-500' };
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <span className="text-gray-400">↕</span>;
    }
    return sortConfig.direction === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4"></div>
          <p className="text-gray-400">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Email, name, username..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="tier1">Tier 1</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Assessment Status</label>
            <select
              value={assessmentFilter}
              onChange={(e) => setAssessmentFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white"
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Actions</label>
            <button
              onClick={handleExportCSV}
              className="w-full px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white"
            />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            Users ({filteredUsers.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    User
                    <SortIcon columnKey="name" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 min-w-[140px]"
                  onClick={() => handleSort('role')}
                >
                  <div className="flex items-center gap-2">
                    Role
                    <SortIcon columnKey="role" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('signupDate')}
                >
                  <div className="flex items-center gap-2">
                    Signup Date
                    <SortIcon columnKey="signupDate" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('lastLogin')}
                >
                  <div className="flex items-center gap-2">
                    Last Login
                    <SortIcon columnKey="lastLogin" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assessment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const assessmentStatus = getAssessmentStatus(user);
                  const signupDate = user.createdAt?.toDate
                    ? user.createdAt.toDate().toLocaleDateString()
                    : 'N/A';
                  const lastLogin = user.lastLoggedOn?.toDate
                    ? user.lastLoggedOn.toDate().toLocaleDateString()
                    : 'Never';

                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap min-w-[140px]">
                        <select
                          value={user.role || 'tier1'}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={updatingRole}
                          className="text-sm border border-gray-300 rounded px-3 py-1.5 pr-8 focus:ring-2 focus:ring-emerald-500 text-gray-900 bg-white w-full"
                        >
                          <option value="admin">Admin</option>
                          <option value="tier1">Tier 1</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {signupDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {lastLogin}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${assessmentStatus.color}`}>
                          {assessmentStatus.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openUserAnswers(user)}
                            className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all shadow-sm hover:shadow-md flex items-center gap-1.5 text-xs font-medium"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View
                          </button>
                          {assessmentStatus.status === 'Completed' && (
                            <>
                              <button
                                onClick={() => downloadUserResponsesCSV(user)}
                                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-sm hover:shadow-md flex items-center gap-1.5 text-xs font-medium"
                                title="Download CSV"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                CSV
                              </button>
                              <button
                                onClick={async () => await downloadUserResponsesPDF(user)}
                                className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-sm hover:shadow-md flex items-center gap-1.5 text-xs font-medium"
                                title="Download PDF"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                PDF
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Details Modal */}
      <Transition show={detailsModalOpen} as={Fragment}>
        <Dialog onClose={() => setDetailsModalOpen(false)} className="relative z-50">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="mx-auto max-w-2xl w-full rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                <Dialog.Title className="text-2xl font-bold text-gray-900 mb-4">
                  User Details
                </Dialog.Title>

                {selectedUser && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <p className="text-gray-900">{selectedUser.email}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <p className="text-gray-900">
                          {selectedUser.firstName} {selectedUser.lastName}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Username</label>
                        <p className="text-gray-900">{selectedUser.username || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Role</label>
                        <select
                          value={selectedUser.role || 'tier1'}
                          onChange={(e) => handleRoleChange(selectedUser.id, e.target.value)}
                          className="mt-1 text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-emerald-500 text-gray-900 bg-white"
                        >
                          <option value="admin">Admin</option>
                          <option value="tier1">Tier 1</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Signup Date</label>
                        <p className="text-gray-900">
                          {selectedUser.createdAt?.toDate
                            ? selectedUser.createdAt.toDate().toLocaleString()
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Last Login</label>
                        <p className="text-gray-900">
                          {selectedUser.lastLoggedOn?.toDate
                            ? selectedUser.lastLoggedOn.toDate().toLocaleString()
                            : 'Never'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Assessment Status</label>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        {selectedUser.computedScores && Object.keys(selectedUser.computedScores).length >= 5 ? (
                          <div>
                            <p className="text-emerald-600 font-medium mb-2">Assessment Completed</p>
                            {selectedUser.overallHealth && (
                              <div className="space-y-1">
                                <p className="text-sm text-gray-600">
                                  Overall Health Score: {selectedUser.overallHealth.percentage || 'N/A'}%
                                </p>
                                <p className="text-sm text-gray-600">
                                  Health Level: {selectedUser.overallHealth.healthLevel || 'N/A'}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-yellow-600 font-medium">Assessment Incomplete</p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        onClick={() => setDetailsModalOpen(false)}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2 font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* User Answers Modal */}
      <Transition show={answersModalOpen} as={Fragment}>
        <Dialog onClose={() => setAnswersModalOpen(false)} className="relative z-50">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="mx-auto max-w-7xl w-full h-[90vh] rounded-xl bg-white shadow-xl flex flex-col">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-2xl font-bold text-gray-900">
                      {selectedUser?.firstName} {selectedUser?.lastName} - Assessment Answers
                    </Dialog.Title>
                    <div className="flex gap-2">
                      {selectedUser && (
                        <>
                          <button
                            onClick={() => downloadUserResponsesCSV(selectedUser)}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-md hover:shadow-lg flex items-center gap-2 text-sm font-medium"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Download CSV
                          </button>
                          <button
                            onClick={async () => await downloadUserResponsesPDF(selectedUser)}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-md hover:shadow-lg flex items-center gap-2 text-sm font-medium"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            Download PDF
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setAnswersModalOpen(false)}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2 font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Close
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-1 overflow-hidden">
                  {/* Sidebar - Sections */}
                  <aside className="w-80 bg-gray-50 border-r border-gray-200 overflow-y-auto p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Sections</h3>
                    <div className="space-y-2">
                      {sections.map((section) => {
                        const result = sectionResults.find(r => r.sectionName === section.title);
                        const isActive = selectedSection?.id === section.id;
                        return (
                          <div
                            key={section.id}
                            onClick={() => handleSectionClick(section)}
                            className={`p-3 rounded-lg cursor-pointer transition-all ${
                              isActive
                                ? 'bg-emerald-500 text-white'
                                : result
                                ? 'bg-white border border-gray-200 hover:bg-gray-100'
                                : 'bg-gray-100 border border-gray-200 opacity-50'
                            }`}
                          >
                            <div className="font-medium">{section.title}</div>
                            {result && (
                              <div className={`text-xs mt-1 ${isActive ? 'text-emerald-50' : 'text-gray-500'}`}>
                                Score: {result.sectionScore || 0}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </aside>

                  {/* Main Content - Questions and Answers */}
                  <main className="flex-1 overflow-y-auto p-6">
                    {selectedSection ? (
                      <div className="space-y-6">
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            {selectedSection.title}
                          </h2>
                          {selectedSection.beginningText && (
                            <div className="mt-4 rounded-lg bg-gray-50 p-4 text-gray-600">
                              {selectedSection.beginningText}
                            </div>
                          )}
                        </div>

                        {selectedSection.questions && selectedSection.questions.length > 0 ? (
                          <div className="space-y-4">
                            {selectedSection.questions.map((question, qIndex) => {
                              const result = sectionResults.find(r => r.sectionName === selectedSection.title);
                              const answer = result?.answers?.[question.id];
                              
                              return (
                                <div
                                  key={question.id || qIndex}
                                  className="rounded-lg border border-gray-200 bg-gray-50 p-6"
                                >
                                  <p className="font-semibold text-gray-900 mb-2">
                                    {qIndex + 1}. {question.text}
                                  </p>
                                  {answer ? (
                                    <div className="mt-3">
                                      <p className="text-sm text-gray-600 mb-1">
                                        <span className="font-medium">Answer:</span>
                                      </p>
                                      <p className="text-gray-900">
                                        {Array.isArray(answer)
                                          ? answer.map(a => a.answer).join(', ')
                                          : answer.answer || 'No answer provided'}
                                      </p>
                                      {question.type === 'multipleChoice' || question.type === 'multipleSelect' ? (
                                        <p className="text-sm text-gray-500 mt-1">
                                          Weight: {Array.isArray(answer) 
                                            ? answer.reduce((sum, a) => sum + (a.weight || 0), 0)
                                            : answer.weight || 0}
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <p className="text-gray-500 italic mt-2">No answer provided</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-gray-500">No questions in this section.</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        Select a section to view answers
                      </div>
                    )}
                  </main>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
