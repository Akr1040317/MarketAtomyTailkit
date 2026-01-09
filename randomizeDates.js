/**
 * Script to randomize user registration and assessment completion dates
 * Dates will be randomized between October 1, 2025 and January 1, 2026
 * Usage: node randomizeDates.js
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  updateDoc,
  query,
  where,
  Timestamp
} from 'firebase/firestore';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyA4AQ5-WmNSLR9v3tOahqehBMQVlpLMiTM",
  authDomain: "businesshealthassessment.firebaseapp.com",
  projectId: "businesshealthassessment",
  storageBucket: "businesshealthassessment.appspot.com",
  messagingSenderId: "792442986694",
  appId: "1:792442986694:web:487395ed4704271d8eb7c7",
  measurementId: "G-VZVWF2N9Y8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Generate random date between start and end dates
 */
function getRandomDate(startDate, endDate) {
  const start = startDate.getTime();
  const end = endDate.getTime();
  const randomTime = start + Math.random() * (end - start);
  return new Date(randomTime);
}

/**
 * Randomize user registration dates
 */
async function randomizeUserRegistrationDates() {
  try {
    console.log('\n=== Randomizing User Registration Dates ===');
    
    const startDate = new Date('2025-10-01T00:00:00');
    const endDate = new Date('2026-01-01T23:59:59');
    
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    console.log(`Found ${usersSnapshot.size} users`);
    
    let updated = 0;
    let errors = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      try {
        const randomDate = getRandomDate(startDate, endDate);
        const timestamp = Timestamp.fromDate(randomDate);
        
        await updateDoc(doc(db, 'users', userDoc.id), {
          createdAt: timestamp
        });
        
        updated++;
        if (updated % 10 === 0) {
          console.log(`  Updated ${updated} users...`);
        }
      } catch (error) {
        console.error(`  Error updating user ${userDoc.id}:`, error);
        errors++;
      }
    }
    
    console.log(`✅ Updated ${updated} user registration dates`);
    console.log(`❌ Errors: ${errors}`);
    
  } catch (error) {
    console.error('Error randomizing user dates:', error);
    throw error;
  }
}

/**
 * Randomize assessment completion dates (sectionResults)
 */
async function randomizeAssessmentCompletionDates() {
  try {
    console.log('\n=== Randomizing Assessment Completion Dates ===');
    
    const startDate = new Date('2025-10-01T00:00:00');
    const endDate = new Date('2026-01-01T23:59:59');
    
    const sectionResultsRef = collection(db, 'sectionResults');
    const resultsSnapshot = await getDocs(sectionResultsRef);
    
    console.log(`Found ${resultsSnapshot.size} section results`);
    
    // Group results by user to ensure logical ordering
    const userResults = {};
    resultsSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const userId = data.userId;
      if (!userResults[userId]) {
        userResults[userId] = [];
      }
      userResults[userId].push({
        id: docSnap.id,
        ...data
      });
    });
    
    let updated = 0;
    let errors = 0;
    
    // Process each user's results
    for (const [userId, results] of Object.entries(userResults)) {
      try {
        // Sort results by section order if available
        const sortedResults = results.sort((a, b) => {
          const sectionA = a.sectionName || '';
          const sectionB = b.sectionName || '';
          return sectionA.localeCompare(sectionB);
        });
        
        // Generate dates for this user's submissions
        // First submission should be earlier, last should be later
        const numSubmissions = sortedResults.length;
        const timeSpan = endDate.getTime() - startDate.getTime();
        const avgTimeBetween = numSubmissions > 1 ? timeSpan / (numSubmissions - 1) : 0;
        
        for (let index = 0; index < sortedResults.length; index++) {
          const result = sortedResults[index];
          let submissionDate;
          
          if (numSubmissions === 1) {
            // Single submission - random date
            submissionDate = getRandomDate(startDate, endDate);
          } else {
            // Multiple submissions - spread them out over time
            const baseTime = startDate.getTime() + (avgTimeBetween * index);
            // Add some randomness (±20% of average time between)
            const randomOffset = (Math.random() - 0.5) * avgTimeBetween * 0.4;
            submissionDate = new Date(baseTime + randomOffset);
            
            // Ensure date is within bounds
            if (submissionDate < startDate) submissionDate = startDate;
            if (submissionDate > endDate) submissionDate = endDate;
          }
          
          const timestamp = Timestamp.fromDate(submissionDate);
          
          await updateDoc(doc(db, 'sectionResults', result.id), {
            submittedAt: timestamp
          });
          
          updated++;
          if (updated % 50 === 0) {
            console.log(`  Updated ${updated} section results...`);
          }
        }
      } catch (error) {
        console.error(`  Error processing user ${userId}:`, error);
        errors++;
      }
    }
    
    console.log(`✅ Updated ${updated} section result dates`);
    console.log(`❌ Errors: ${errors}`);
    
  } catch (error) {
    console.error('Error randomizing assessment dates:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function randomizeAllDates() {
  try {
    console.log('Starting date randomization...');
    console.log('Date range: October 1, 2025 to January 1, 2026\n');
    
    await randomizeUserRegistrationDates();
    await randomizeAssessmentCompletionDates();
    
    console.log('\n=== Date Randomization Complete ===');
    console.log('All dates have been randomized successfully!');
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
randomizeAllDates()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
