/**
 * Migration Script: Update existing user documents with enhanced analytics
 * 
 * This script processes all existing user documents and adds:
 * - Percentage scores
 * - Health levels
 * - Overall health analytics
 * 
 * Usage: node migrateUserScores.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { processComputedScores } from './src/utils/analytics.js';

// Firebase configuration (same as firebaseConfig.js)
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

async function migrateUserScores() {
  try {
    console.log('Starting migration...');
    
    // Get all users
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    console.log(`Found ${usersSnapshot.size} users to process`);
    
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        const userId = userDoc.id;
        
        // Check if user has computedScores
        if (!userData.computedScores) {
          console.log(`Skipping user ${userId}: No computedScores found`);
          skipped++;
          continue;
        }

        // Check if already migrated (has percentage field)
        const firstCategory = Object.keys(userData.computedScores)[0];
        if (userData.computedScores[firstCategory]?.percentage !== undefined) {
          console.log(`Skipping user ${userId}: Already migrated`);
          skipped++;
          continue;
        }

        // Process scores
        const enhancedScores = processComputedScores(userData.computedScores);
        
        if (!enhancedScores) {
          console.log(`Skipping user ${userId}: Could not process scores`);
          skipped++;
          continue;
        }

        // Update computedScores with enhanced analytics
        const updatedComputedScores = { ...userData.computedScores };
        Object.keys(enhancedScores).forEach((categoryKey) => {
          if (categoryKey !== 'overallHealth' && updatedComputedScores[categoryKey]) {
            updatedComputedScores[categoryKey] = {
              ...updatedComputedScores[categoryKey],
              ...enhancedScores[categoryKey],
            };
          }
        });

        // Prepare update data
        const updateData = {
          computedScores: updatedComputedScores,
        };
        
        if (enhancedScores.overallHealth) {
          updateData.overallHealth = enhancedScores.overallHealth;
        }

        // Update user document
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, updateData);
        
        console.log(`✓ Updated user ${userId}`);
        updated++;
        processed++;
      } catch (error) {
        console.error(`Error processing user ${userDoc.id}:`, error.message);
        errors++;
        processed++;
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total users: ${usersSnapshot.size}`);
    console.log(`Processed: ${processed}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log('\nMigration completed!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateUserScores()
  .then(() => {
    console.log('Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script error:', error);
    process.exit(1);
  });

