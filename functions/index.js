const { setGlobalOptions } = require("firebase-functions/v2");

setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
});

const { onUserCreated } = require("./src/emails/welcomeEmail");
const { checkIncompleteAssessments } = require("./src/emails/reminderEmail");
const { onAssessmentComplete } = require("./src/emails/completionEmail");

exports.onUserCreated = onUserCreated;
exports.checkIncompleteAssessments = checkIncompleteAssessments;
exports.onAssessmentComplete = onAssessmentComplete;

