/**
 * Script to generate 25 random users with randomized assessment responses
 * 
 * Usage: node generateTestUsers.js
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  addDoc,
  query,
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { processComputedScores } from './src/utils/analytics.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA4AQ5-WmNSLR9v3tOahqehBMQVlpLMiTM",
  authDomain: "businesshealthassessment.firebaseapp.com",
  projectId: "businesshealthassessment",
  storageBucket: "businesshealthassessment.appspot.com",
  messagingSenderId: "792442986694",
  appId: "1:792442986694:web:487395ed4704271d8eb7c7",
  measurementId: "G-VZVWF2N9Y8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Random first names
const firstNames = [
  'John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'James', 'Jessica',
  'Robert', 'Ashley', 'William', 'Amanda', 'Richard', 'Melissa', 'Joseph', 'Deborah',
  'Thomas', 'Michelle', 'Charles', 'Laura', 'Christopher', 'Lisa', 'Daniel', 'Nancy',
  'Matthew', 'Karen', 'Anthony', 'Betty', 'Mark', 'Helen'
];

// Random last names
const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor',
  'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Clark',
  'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King'
];

// Business types for usernames
const businessTypes = [
  'Tech', 'Consulting', 'Retail', 'Food', 'Fitness', 'Design', 'Marketing', 'Finance',
  'RealEstate', 'Healthcare', 'Education', 'Legal', 'Construction', 'Automotive', 'Beauty'
];

// Generate random UUID-like string
function generateUserId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Generate random user data
function generateRandomUser(index) {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const businessType = businessTypes[Math.floor(Math.random() * businessTypes.length)];
  const username = `${businessType}${firstName}${Math.floor(Math.random() * 1000)}`;
  const email = `${username.toLowerCase()}@testuser.com`;
  const userId = generateUserId();
  
  return {
    userId,
    firstName,
    lastName,
    username,
    email,
    verified: true,
    signupMethod: 'test',
    role: 'tier1',
    createdAt: serverTimestamp(),
    lastLoggedOn: null,
    lastLoggedOff: null,
  };
}

// Generate random answer for a question with bias toward certain score ranges
function generateRandomAnswer(question, userBias = 'medium') {
  if (question.type === 'multipleChoice') {
    if (!question.options || question.options.length === 0) {
      return { answer: 'Yes', weight: 0 };
    }
    
    // Sort options by weight (highest first)
    const sortedOptions = [...question.options].sort((a, b) => (b.weight || 0) - (a.weight || 0));
    
    let selectedOption;
    if (userBias === 'high') {
      // High bias: 70% chance of top option, 25% second, 5% random
      const rand = Math.random();
      if (rand < 0.7) {
        selectedOption = sortedOptions[0];
      } else if (rand < 0.95 && sortedOptions.length > 1) {
        selectedOption = sortedOptions[1];
      } else {
        selectedOption = sortedOptions[Math.floor(Math.random() * Math.min(2, sortedOptions.length))];
      }
    } else if (userBias === 'low') {
      // Low bias: 70% chance of lowest option, 25% second lowest, 5% random
      const reversed = [...sortedOptions].reverse();
      const rand = Math.random();
      if (rand < 0.7) {
        selectedOption = reversed[0];
      } else if (rand < 0.95 && reversed.length > 1) {
        selectedOption = reversed[1];
      } else {
        selectedOption = sortedOptions[Math.floor(Math.random() * sortedOptions.length)];
      }
    } else {
      // Medium bias: weighted toward middle options
      const rand = Math.random();
      if (rand < 0.3 && sortedOptions.length > 1) {
        // 30% chance of top option
        selectedOption = sortedOptions[0];
      } else if (rand < 0.6 && sortedOptions.length > 2) {
        // 30% chance of middle option
        const midIndex = Math.floor(sortedOptions.length / 2);
        selectedOption = sortedOptions[midIndex];
      } else {
        // 40% chance of random
        selectedOption = sortedOptions[Math.floor(Math.random() * sortedOptions.length)];
      }
    }
    
    return {
      answer: selectedOption.label || 'Yes',
      weight: selectedOption.weight || 0
    };
  } else if (question.type === 'multipleSelect') {
    if (!question.options || question.options.length === 0) {
      return [{ answer: 'Yes', weight: 0 }];
    }
    
    // Sort options by weight
    const sortedOptions = [...question.options].sort((a, b) => (b.weight || 0) - (a.weight || 0));
    
    let selectedOptions;
    if (userBias === 'high') {
      // High bias: select top 2-3 options
      const numSelections = Math.min(3, sortedOptions.length);
      selectedOptions = sortedOptions.slice(0, numSelections);
    } else if (userBias === 'low') {
      // Low bias: select bottom 1-2 options
      const reversed = [...sortedOptions].reverse();
      const numSelections = Math.min(2, reversed.length);
      selectedOptions = reversed.slice(0, numSelections);
    } else {
      // Medium bias: random selection
      const numSelections = Math.floor(Math.random() * Math.min(3, sortedOptions.length)) + 1;
      const shuffled = [...sortedOptions].sort(() => Math.random() - 0.5);
      selectedOptions = shuffled.slice(0, numSelections);
    }
    
    return selectedOptions.map(option => ({
      answer: option.label || 'Yes',
      weight: option.weight || 0
    }));
  } else {
    // Text or other types
    const textAnswers = [
      'Yes, we have this in place',
      'Partially implemented',
      'No, we need to work on this',
      'We are planning to implement this soon',
      'This is a priority for us'
    ];
    return {
      answer: textAnswers[Math.floor(Math.random() * textAnswers.length)],
      weight: 0
    };
  }
}

// Calculate section score
function calculateSectionScore(questions, answers) {
  let score = 0;
  questions.forEach(question => {
    const answer = answers[question.id];
    if (question.type === 'multipleChoice' && answer) {
      score += answer.weight || 0;
    } else if (question.type === 'multipleSelect' && Array.isArray(answer)) {
      answer.forEach(item => {
        score += item.weight || 0;
      });
    }
  });
  return score;
}

// Calculate computed scores for a user
function calculateComputedScores(sections, allSectionResults) {
  const computedScores = {
    foundationalStructure: { sections: {}, total: 0 },
    financialPosition: { sections: {}, total: 0 },
    salesMarketing: { sections: {}, total: 0 },
    productService: { sections: {}, total: 0 },
    general: { sections: {}, total: 0 },
  };

  const categoryMapping = {
    foundationalStructure: [2, 3, 5, 6, 7],
    financialPosition: [4, 8, 11, 12, 16, 17, 18],
    salesMarketing: [10, 12, 13, 14, 15],
    productService: [8, 9, 19],
    general: [20, 21],
  };

  allSectionResults.forEach(result => {
    const sectionNumber = result.sectionOrder;
    const sectionScore = result.sectionScore || 0;

    Object.keys(categoryMapping).forEach((categoryKey) => {
      if (categoryMapping[categoryKey].includes(sectionNumber)) {
        computedScores[categoryKey].sections[sectionNumber] = sectionScore;
        computedScores[categoryKey].total = Object.values(
          computedScores[categoryKey].sections,
        ).reduce((sum, val) => sum + (val || 0), 0);
      }
    });
  });

  return computedScores;
}

async function generateTestUsers() {
  try {
    console.log('Starting test user generation...\n');
    
    // Fetch all assessment sections
    console.log('Fetching assessment sections...');
    const sectionsQuery = query(collection(db, 'BHC_Assessment'), orderBy('order'));
    const sectionsSnapshot = await getDocs(sectionsQuery);
    const sections = sectionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`Found ${sections.length} assessment sections\n`);
    
    if (sections.length === 0) {
      console.error('No assessment sections found! Please ensure BHC_Assessment collection has data.');
      process.exit(1);
    }

    const numUsers = 25;
    const users = [];
    const allSectionResults = [];

    // Define user bias distribution: 30% high, 40% medium, 30% low
    const userBiases = [];
    for (let i = 0; i < Math.floor(numUsers * 0.3); i++) userBiases.push('high');
    for (let i = 0; i < Math.floor(numUsers * 0.4); i++) userBiases.push('medium');
    for (let i = 0; i < numUsers - userBiases.length; i++) userBiases.push('low');
    // Shuffle the biases
    userBiases.sort(() => Math.random() - 0.5);

    // Generate users and their responses
    for (let i = 0; i < numUsers; i++) {
      console.log(`Creating user ${i + 1}/${numUsers}...`);
      
      const user = generateRandomUser(i);
      const userBias = userBiases[i] || 'medium';
      users.push(user);
      
      console.log(`  User bias: ${userBias}`);
      
      // Generate responses for all sections first
      const userSectionResults = [];
      
      for (const section of sections) {
        if (!section.questions || section.questions.length === 0) {
          continue;
        }
        
        const answers = {};
        section.questions.forEach(question => {
          answers[question.id] = generateRandomAnswer(question, userBias);
        });
        
        const sectionScore = calculateSectionScore(section.questions, answers);
        
        const sectionResult = {
          userId: user.userId,
          userEmail: user.email,
          submittedAt: serverTimestamp(),
          sectionName: section.title,
          sectionOrder: section.order || 0,
          answers: answers,
          sectionScore: sectionScore,
        };
        
        userSectionResults.push(sectionResult);
        
        // Add to sectionResults collection
        await addDoc(collection(db, 'sectionResults'), sectionResult);
      }
      
      allSectionResults.push(...userSectionResults);
      console.log(`  ✓ Created ${userSectionResults.length} section responses`);
      
      // Calculate computed scores
      const computedScores = calculateComputedScores(sections, userSectionResults);
      
      // Process scores with analytics
      const enhancedScores = processComputedScores(computedScores);
      
      // Update computedScores with enhanced analytics
      const updatedComputedScores = { ...computedScores };
      Object.keys(enhancedScores).forEach((categoryKey) => {
        if (categoryKey !== 'overallHealth' && updatedComputedScores[categoryKey]) {
          updatedComputedScores[categoryKey] = {
            ...updatedComputedScores[categoryKey],
            ...enhancedScores[categoryKey],
          };
        }
      });

      // Create user document with all data including computed scores
      const userDocRef = doc(db, 'users', user.userId);
      const userData = {
        ...user,
        computedScores: updatedComputedScores,
      };
      
      if (enhancedScores.overallHealth) {
        userData.overallHealth = enhancedScores.overallHealth;
      }
      
      await setDoc(userDocRef, userData);
      console.log(`  ✓ Created user: ${user.email}`);
      console.log(`  ✓ Updated computed scores\n`);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n=== Generation Summary ===');
    console.log(`Total users created: ${users.length}`);
    console.log(`Total section responses: ${allSectionResults.length}`);
    console.log(`Average responses per user: ${(allSectionResults.length / users.length).toFixed(1)}`);
    console.log('\nTest users generated successfully!');
    
  } catch (error) {
    console.error('Error generating test users:', error);
    process.exit(1);
  }
}

// Run the script
generateTestUsers()
  .then(() => {
    console.log('\nScript finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script error:', error);
    process.exit(1);
  });
