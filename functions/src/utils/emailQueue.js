const { db } = require("./firebaseAdmin");
const { MAIL_COLLECTION } = require("../config");

async function queueEmail({ to, subject, text, html, headers, from, replyTo }) {
  if (!to) return null;
  if (!subject) return null;

  const mailDoc = {
    to,
    message: {
      subject,
      ...(text ? { text } : {}),
      ...(html ? { html } : {}),
      ...(headers ? { headers } : {}),
    },
    ...(from ? { from } : {}),
    ...(replyTo ? { replyTo } : {}),
    createdAt: new Date(),
  };

  const ref = await db.collection(MAIL_COLLECTION.value()).add(mailDoc);
  return ref.id;
}

module.exports = { queueEmail };

