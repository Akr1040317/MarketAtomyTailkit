import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, updateDoc, doc, where } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

export default function SystemMonitoring() {
  const [activeTab, setActiveTab] = useState('bugs');
  const [bugReports, setBugReports] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [selectedBug, setSelectedBug] = useState(null);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [bugModalOpen, setBugModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchBugReports();
    fetchFeedback();
  }, []);

  useEffect(() => {
    if (activeTab === 'bugs') {
      fetchBugReports();
    } else if (activeTab === 'feedback') {
      fetchFeedback();
    }
  }, [statusFilter, severityFilter, ratingFilter]);

  const fetchBugReports = async () => {
    try {
      setLoading(true);
      let bugQuery = query(collection(db, 'bugReports'), orderBy('submittedAt', 'desc'));
      
      if (statusFilter !== 'all') {
        bugQuery = query(collection(db, 'bugReports'), where('status', '==', statusFilter), orderBy('submittedAt', 'desc'));
      }
      
      const querySnapshot = await getDocs(bugQuery);
      let reports = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter by severity if needed
      if (severityFilter !== 'all') {
        reports = reports.filter(report => report.severity === severityFilter);
      }

      setBugReports(reports);
    } catch (error) {
      console.error('Error fetching bug reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const feedbackQuery = query(collection(db, 'feedback'), orderBy('submittedAt', 'desc'));
      const querySnapshot = await getDocs(feedbackQuery);
      let feedbackData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter by rating if needed
      if (ratingFilter !== 'all') {
        feedbackData = feedbackData.filter(item => item.rating === ratingFilter);
      }

      setFeedback(feedbackData);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkResolved = async (bugId) => {
    try {
      setUpdatingStatus(true);
      const bugDocRef = doc(db, 'bugReports', bugId);
      await updateDoc(bugDocRef, { status: 'resolved' });
      
      setBugReports(prevReports =>
        prevReports.map(report =>
          report.id === bugId ? { ...report, status: 'resolved' } : report
        )
      );
      
      if (selectedBug && selectedBug.id === bugId) {
        setSelectedBug({ ...selectedBug, status: 'resolved' });
      }
      
      alert('Bug report marked as resolved!');
    } catch (error) {
      console.error('Error updating bug status:', error);
      alert('Error updating bug status. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openBugDetails = (bug) => {
    setSelectedBug(bug);
    setBugModalOpen(true);
  };

  const openFeedbackDetails = (item) => {
    setSelectedFeedback(item);
    setFeedbackModalOpen(true);
  };

  const getSeverityColor = (severity) => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    return colors[severity] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status) => {
    return status === 'resolved' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-yellow-100 text-yellow-800';
  };

  const calculateAverageRating = () => {
    if (feedback.length === 0) return 0;
    const sum = feedback.reduce((acc, item) => acc + parseInt(item.rating || 0), 0);
    return (sum / feedback.length).toFixed(1);
  };

  if (loading && bugReports.length === 0 && feedback.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4"></div>
          <p className="text-gray-400">Loading system monitoring data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex space-x-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('bugs')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'bugs'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Bug Reports ({bugReports.length})
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'feedback'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            User Feedback ({feedback.length})
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'health'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Platform Health
          </button>
        </div>
      </div>

      {/* Bug Reports */}
      {activeTab === 'bugs' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Severities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bug Reports Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Bug Reports</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bugReports.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                        No bug reports found
                      </td>
                    </tr>
                  ) : (
                    bugReports.map((bug) => {
                      const submittedDate = bug.submittedAt?.toDate
                        ? bug.submittedAt.toDate().toLocaleDateString()
                        : 'N/A';

                      return (
                        <tr key={bug.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{bug.title}</div>
                            <div className="text-sm text-gray-500">{bug.userEmail}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(bug.severity)}`}>
                              {bug.severity || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(bug.status)}`}>
                              {bug.status || 'open'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {submittedDate}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => openBugDetails(bug)}
                                className="text-emerald-600 hover:text-emerald-900 font-medium"
                              >
                                View
                              </button>
                              {bug.status !== 'resolved' && (
                                <button
                                  onClick={() => handleMarkResolved(bug.id)}
                                  disabled={updatingStatus}
                                  className="text-blue-600 hover:text-blue-900 font-medium disabled:opacity-50"
                                >
                                  Mark Resolved
                                </button>
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
        </div>
      )}

      {/* User Feedback */}
      {activeTab === 'feedback' && (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Feedback Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{feedback.length}</div>
                <div className="text-sm text-gray-600">Total Feedback</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{calculateAverageRating()}</div>
                <div className="text-sm text-gray-600">Average Rating</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {feedback.filter(f => parseInt(f.rating) >= 4).length}
                </div>
                <div className="text-sm text-gray-600">Positive Ratings (4+)</div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rating Filter</label>
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Ratings</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>
            </div>
          </div>

          {/* Feedback Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">User Feedback</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {feedback.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                        No feedback found
                      </td>
                    </tr>
                  ) : (
                    feedback.map((item) => {
                      const submittedDate = item.submittedAt?.toDate
                        ? item.submittedAt.toDate().toLocaleDateString()
                        : 'N/A';

                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{item.userEmail}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-yellow-500">{'⭐'.repeat(parseInt(item.rating) || 0)}</span>
                              <span className="ml-2 text-sm text-gray-600">({item.rating}/5)</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {submittedDate}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => openFeedbackDetails(item)}
                              className="text-emerald-600 hover:text-emerald-900 font-medium"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Platform Health */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Platform Health Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-sm font-medium text-gray-600 mb-2">System Status</div>
                <div className="text-2xl font-bold text-green-600">Operational</div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm font-medium text-gray-600 mb-2">Open Bug Reports</div>
                <div className="text-2xl font-bold text-blue-600">
                  {bugReports.filter(b => b.status === 'open').length}
                </div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-sm font-medium text-gray-600 mb-2">Recent Activity</div>
                <div className="text-2xl font-bold text-purple-600">Active</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bug Details Modal */}
      <Transition show={bugModalOpen} as={Fragment}>
        <Dialog onClose={() => setBugModalOpen(false)} className="relative z-50">
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
                  Bug Report Details
                </Dialog.Title>

                {selectedBug && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Title</label>
                      <p className="text-gray-900">{selectedBug.title}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Severity</label>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(selectedBug.severity)}`}>
                          {selectedBug.severity}
                        </span>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Status</label>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedBug.status)}`}>
                          {selectedBug.status}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedBug.description}</p>
                    </div>
                    {selectedBug.stepsToReproduce && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Steps to Reproduce</label>
                        <p className="text-gray-900 whitespace-pre-wrap">{selectedBug.stepsToReproduce}</p>
                      </div>
                    )}
                    {selectedBug.expectedBehavior && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Expected Behavior</label>
                        <p className="text-gray-900 whitespace-pre-wrap">{selectedBug.expectedBehavior}</p>
                      </div>
                    )}
                    {selectedBug.actualBehavior && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Actual Behavior</label>
                        <p className="text-gray-900 whitespace-pre-wrap">{selectedBug.actualBehavior}</p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Submitted By</label>
                      <p className="text-gray-900">{selectedBug.userEmail}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Submitted At</label>
                      <p className="text-gray-900">
                        {selectedBug.submittedAt?.toDate
                          ? selectedBug.submittedAt.toDate().toLocaleString()
                          : 'N/A'}
                      </p>
                    </div>
                    {selectedBug.status !== 'resolved' && (
                      <div className="flex justify-end pt-4">
                        <button
                          onClick={() => {
                            handleMarkResolved(selectedBug.id);
                            setBugModalOpen(false);
                          }}
                          className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                        >
                          Mark as Resolved
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Feedback Details Modal */}
      <Transition show={feedbackModalOpen} as={Fragment}>
        <Dialog onClose={() => setFeedbackModalOpen(false)} className="relative z-50">
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
              <Dialog.Panel className="mx-auto max-w-lg w-full rounded-xl bg-white p-6 shadow-xl">
                <Dialog.Title className="text-2xl font-bold text-gray-900 mb-4">
                  Feedback Details
                </Dialog.Title>

                {selectedFeedback && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Rating</label>
                      <div className="flex items-center mt-1">
                        <span className="text-yellow-500 text-2xl">{'⭐'.repeat(parseInt(selectedFeedback.rating) || 0)}</span>
                        <span className="ml-2 text-gray-600">({selectedFeedback.rating}/5)</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Feedback</label>
                      <p className="text-gray-900 whitespace-pre-wrap mt-1">{selectedFeedback.feedback}</p>
                    </div>
                    {selectedFeedback.suggestions && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Suggestions</label>
                        <p className="text-gray-900 whitespace-pre-wrap mt-1">{selectedFeedback.suggestions}</p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Submitted By</label>
                      <p className="text-gray-900">{selectedFeedback.userEmail}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Submitted At</label>
                      <p className="text-gray-900">
                        {selectedFeedback.submittedAt?.toDate
                          ? selectedFeedback.submittedAt.toDate().toLocaleString()
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
