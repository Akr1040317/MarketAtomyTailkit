import { useState, useEffect } from 'react';
import { collection, doc, getDocs, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { REPORT_CONTENT } from '../../utils/reportContent';

const CATEGORIES = {
  foundationalStructure: 'Foundational Structure',
  financialPosition: 'Financial Strength',
  salesMarketing: 'Sales & Marketing',
  productService: 'Product Viability',
  general: 'Overall Health'
};

const HEALTH_LEVELS = {
  healthy: 'Healthy',
  unhealthy: 'Needs Attention',
  needsTweaking: 'Needs Tweaking'
};

export default function ContentManagement() {
  const [activeTab, setActiveTab] = useState('resources');
  const [selectedCategory, setSelectedCategory] = useState('foundationalStructure');
  const [selectedHealthLevel, setSelectedHealthLevel] = useState('healthy');
  const [editingResource, setEditingResource] = useState(null);
  const [editingMessage, setEditingMessage] = useState('');
  const [reportContent, setReportContent] = useState(REPORT_CONTENT);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadReportContent();
  }, []);

  const loadReportContent = async () => {
    try {
      setLoading(true);
      // Try to load from Firestore, fallback to static content
      const contentDocRef = doc(db, 'reportContent', 'main');
      const contentDocSnap = await getDoc(contentDocRef);
      
      if (contentDocSnap.exists()) {
        setReportContent(contentDocSnap.data());
      } else {
        // Initialize Firestore with static content
        await setDoc(contentDocRef, REPORT_CONTENT);
      }
    } catch (error) {
      console.error('Error loading report content:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveReportContent = async () => {
    try {
      setSaving(true);
      const contentDocRef = doc(db, 'reportContent', 'main');
      await setDoc(contentDocRef, reportContent);
      alert('Content saved successfully!');
    } catch (error) {
      console.error('Error saving report content:', error);
      alert('Error saving content. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddResource = () => {
    const newResource = {
      title: '',
      description: '',
      type: 'download'
    };
    
    const category = reportContent[selectedCategory];
    if (category && category[selectedHealthLevel]) {
      const updatedContent = { ...reportContent };
      if (!updatedContent[selectedCategory][selectedHealthLevel].resources) {
        updatedContent[selectedCategory][selectedHealthLevel].resources = [];
      }
      updatedContent[selectedCategory][selectedHealthLevel].resources.push(newResource);
      setReportContent(updatedContent);
      setEditingResource({
        category: selectedCategory,
        healthLevel: selectedHealthLevel,
        index: updatedContent[selectedCategory][selectedHealthLevel].resources.length - 1
      });
    }
  };

  const handleEditResource = (category, healthLevel, index) => {
    setEditingResource({ category, healthLevel, index });
  };

  const handleDeleteResource = (category, healthLevel, index) => {
    if (confirm('Are you sure you want to delete this resource?')) {
      const updatedContent = { ...reportContent };
      updatedContent[category][healthLevel].resources.splice(index, 1);
      setReportContent(updatedContent);
    }
  };

  const handleSaveResource = () => {
    if (!editingResource) return;
    
    const { category, healthLevel, index } = editingResource;
    const updatedContent = { ...reportContent };
    const resource = updatedContent[category][healthLevel].resources[index];
    
    // Update resource (assuming form fields are managed separately)
    // For now, just close the editor
    setEditingResource(null);
  };

  const handleUpdateMessage = () => {
    const updatedContent = { ...reportContent };
    if (updatedContent[selectedCategory] && updatedContent[selectedCategory][selectedHealthLevel]) {
      updatedContent[selectedCategory][selectedHealthLevel].message = editingMessage;
      setReportContent(updatedContent);
    }
  };

  const currentContent = reportContent[selectedCategory]?.[selectedHealthLevel];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4"></div>
          <p className="text-gray-400">Loading content...</p>
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
            onClick={() => setActiveTab('resources')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'resources'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Resource Library
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'messages'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Report Messages
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'categories'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Category Descriptions
          </button>
        </div>
      </div>

      {/* Resource Library Management */}
      {activeTab === 'resources' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Resource Library</h2>
            <button
              onClick={saveReportContent}
              disabled={saving}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Category & Health Level Selectors */}
            <div className="lg:col-span-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  {Object.entries(CATEGORIES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Health Level</label>
                <select
                  value={selectedHealthLevel}
                  onChange={(e) => setSelectedHealthLevel(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  {Object.entries(HEALTH_LEVELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddResource}
                className="w-full px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
              >
                Add Resource
              </button>
            </div>

            {/* Resources List */}
            <div className="lg:col-span-3">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Resources for {CATEGORIES[selectedCategory]} - {HEALTH_LEVELS[selectedHealthLevel]}
              </h3>
              {currentContent && currentContent.resources && currentContent.resources.length > 0 ? (
                <div className="space-y-4">
                  {currentContent.resources.map((resource, index) => (
                    <div key={index} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{resource.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{resource.description}</p>
                          <span className="inline-block mt-2 px-2 py-1 text-xs bg-emerald-100 text-emerald-800 rounded">
                            {resource.type}
                          </span>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => handleEditResource(selectedCategory, selectedHealthLevel, index)}
                            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteResource(selectedCategory, selectedHealthLevel, index)}
                            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No resources for this category and health level.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report Messages */}
      {activeTab === 'messages' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Report Messages</h2>
            <button
              onClick={saveReportContent}
              disabled={saving}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setEditingMessage(reportContent[e.target.value]?.[selectedHealthLevel]?.message || '');
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                {Object.entries(CATEGORIES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Health Level</label>
              <select
                value={selectedHealthLevel}
                onChange={(e) => {
                  setSelectedHealthLevel(e.target.value);
                  setEditingMessage(reportContent[selectedCategory]?.[e.target.value]?.message || '');
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                {Object.entries(HEALTH_LEVELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
              <textarea
                value={editingMessage || currentContent?.message || ''}
                onChange={(e) => setEditingMessage(e.target.value)}
                rows={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="Enter report message..."
              />
              <button
                onClick={handleUpdateMessage}
                className="mt-4 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
              >
                Update Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Descriptions */}
      {activeTab === 'categories' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Category Descriptions</h2>
            <button
              onClick={saveReportContent}
              disabled={saving}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>

          <div className="space-y-4">
            {Object.entries(CATEGORIES).map(([key, label]) => (
              <div key={key} className="p-4 border border-gray-200 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">{label}</h3>
                <p className="text-sm text-gray-600">
                  Category key: <code className="bg-gray-100 px-2 py-1 rounded">{key}</code>
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Edit category metadata and descriptions here. (Full implementation would include form fields)
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
