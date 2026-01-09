/**
 * Script to randomize user answers in Firebase
 * This script goes through all users and randomizes their section answers
 * Usage: node randomizeUserAnswers.js
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  updateDoc,
  query,
  where
} from 'firebase/firestore';

// Firebase config - matches firebaseConfig.js
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
 * Get random option from question options
 */
function getRandomOption(question) {
  if (!question.options || question.options.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * question.options.length);
  return question.options[randomIndex];
}

/**
 * Get random options for multiple select (select 1-3 options)
 */
function getRandomMultipleSelectOptions(question) {
  if (!question.options || question.options.length === 0) {
    return [];
  }
  
  const numSelections = Math.floor(Math.random() * 3) + 1; // 1-3 selections
  const shuffled = [...question.options].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(numSelections, question.options.length));
}

/**
 * Randomize answers for a section result
 */
function randomizeSectionAnswers(sectionResult, section) {
  if (!section || !section.questions) {
    return sectionResult;
  }

  const randomizedAnswers = {};
  let newSectionScore = 0;

  section.questions.forEach(question => {
    if (question.type === 'multipleChoice') {
      const randomOption = getRandomOption(question);
      if (randomOption) {
        randomizedAnswers[question.id] = {
          answer: randomOption.label,
          weight: randomOption.weight || 0
        };
        newSectionScore += randomOption.weight || 0;
      }
    } else if (question.type === 'multipleSelect') {
      const randomOptions = getRandomMultipleSelectOptions(question);
      randomizedAnswers[question.id] = randomOptions.map(opt => ({
        answer: opt.label,
        weight: opt.weight || 0
      }));
      newSectionScore += randomOptions.reduce((sum, opt) => sum + (opt.weight || 0), 0);
    } else {
      // For text/other types, keep original or set random text
      const originalAnswer = sectionResult.answers?.[question.id];
      randomizedAnswers[question.id] = originalAnswer || {
        answer: `Random answer ${Math.floor(Math.random() * 1000)}`,
        weight: 0
      };
    }
  });

  return {
    ...sectionResult,
    answers: randomizedAnswers,
    sectionScore: newSectionScore
  };
}

/**
 * Main function to randomize all user answers
 */
async function randomizeAllUserAnswers() {
  try {
    console.log('Starting answer randomization...');
    
    // Fetch all users
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    console.log(`Found ${usersSnapshot.size} users`);

    // Fetch all sections
    const sectionsRef = collection(db, 'BHC_Assessment');
    const sectionsSnapshot = await getDocs(sectionsRef);
    const sectionsMap = {};
    sectionsSnapshot.docs.forEach(doc => {
      const sectionData = doc.data();
      sectionsMap[sectionData.title] = sectionData;
    });
    console.log(`Found ${Object.keys(sectionsMap).length} sections`);

    let processed = 0;
    let updated = 0;
    let errors = 0;

    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      try {
        const userId = userDoc.id;
        const userData = userDoc.data();
        
        console.log(`\nProcessing user: ${userData.email || userId}`);

        // Fetch all section results for this user
        const sectionResultsQuery = query(
          collection(db, 'sectionResults'),
          where('userId', '==', userId)
        );
        const sectionResultsSnapshot = await getDocs(sectionResultsQuery);
        
        console.log(`  Found ${sectionResultsSnapshot.size} section results`);

        // Randomize each section result
        for (const resultDoc of sectionResultsSnapshot.docs) {
          const resultData = resultDoc.data();
          const sectionName = resultData.sectionName;
          const section = sectionsMap[sectionName];

          if (!section) {
            console.log(`  ⚠️  Section "${sectionName}" not found, skipping`);
            continue;
          }

          // Randomize answers
          const randomizedResult = randomizeSectionAnswers(resultData, section);
          
          // Update the document
          await updateDoc(doc(db, 'sectionResults', resultDoc.id), {
            answers: randomizedResult.answers,
            sectionScore: randomizedResult.sectionScore
          });

          console.log(`  ✅ Randomized: ${sectionName} (Score: ${randomizedResult.sectionScore})`);
          updated++;
        }

        // Recalculate computed scores for user
        if (sectionResultsSnapshot.size > 0) {
          const categoryMapping = {
            foundationalStructure: [2, 3, 5, 6, 7],
            financialPosition: [4, 8, 11, 12, 16, 17, 18],
            salesMarketing: [10, 12, 13, 14, 15],
            productService: [8, 9, 19],
            general: [20, 21],
          };

          const computedScores = {
            foundationalStructure: { sections: {}, total: 0 },
            financialPosition: { sections: {}, total: 0 },
            salesMarketing: { sections: {}, total: 0 },
            productService: { sections: {}, total: 0 },
            general: { sections: {}, total: 0 },
          };

          // Recalculate scores from randomized results
          for (const resultDoc of sectionResultsSnapshot.docs) {
            const resultData = resultDoc.data();
            const sectionName = resultData.sectionName;
            const section = sectionsMap[sectionName];
            
            if (!section) continue;
            
            const sectionNumber = section.order;
            const sectionScore = resultData.sectionScore || 0;

            Object.keys(categoryMapping).forEach(categoryKey => {
              if (categoryMapping[categoryKey].includes(sectionNumber)) {
                computedScores[categoryKey].sections[sectionNumber] = sectionScore;
                computedScores[categoryKey].total = Object.values(
                  computedScores[categoryKey].sections
                ).reduce((sum, val) => sum + (val || 0), 0);
              }
            });
          }

          // Update user document with new computed scores
          await updateDoc(doc(db, 'users', userId), {
            computedScores
          });

          console.log(`  ✅ Updated computed scores for user`);
        }

        processed++;
      } catch (error) {
        console.error(`  ❌ Error processing user ${userDoc.id}:`, error);
        errors++;
      }
    }

    console.log('\n=== Randomization Complete ===');
    console.log(`Processed: ${processed} users`);
    console.log(`Updated: ${updated} section results`);
    console.log(`Errors: ${errors}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
randomizeAllUserAnswers()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
