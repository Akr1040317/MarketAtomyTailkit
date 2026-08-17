import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../firebaseConfig";
import { toast } from "../Toast";

const RATING_LABELS = {
  1: "Poor",
  2: "Fair",
  3: "Neutral",
  4: "Good",
  5: "Excellent",
};

export default function AdminFeedbackPage() {
  const [formData, setFormData] = useState({ rating: "5", feedback: "", suggestions: "" });
  const [submitting, setSubmitting] = useState(false);
  const user = getAuth().currentUser;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      toast("Please log in to submit feedback.");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "feedback"), {
        userId: user.uid,
        userEmail: user.email,
        rating: formData.rating,
        feedback: formData.feedback,
        suggestions: formData.suggestions,
        submittedAt: serverTimestamp(),
        type: "feedback",
      });
      setFormData({ rating: "5", feedback: "", suggestions: "" });
      toast("Admin feedback submitted.");
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast("Error submitting feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Give Feedback</h1>
          <p>Share product feedback from the admin workspace using the same feedback channel as client users.</p>
        </div>
      </div>
      <form className="panel form-page" onSubmit={handleSubmit}>
        <div className="panel-head">
          <div>
            <h2>Feedback form</h2>
            <p>Tell us what is working and what should improve in the admin portal.</p>
          </div>
        </div>
        <div className="panel-body">
          <div className="form-group">
            <label>How would you rate your experience?</label>
            <div className="rating-row">
              {[1, 2, 3, 4, 5].map((rating) => (
                <label key={rating} className="radio-card" style={{ marginBottom: 0 }}>
                  <input
                    type="radio"
                    name="admin-feedback-rating"
                    checked={formData.rating === rating.toString()}
                    onChange={() => setFormData({ ...formData, rating: rating.toString() })}
                  />
                  <div>
                    <strong>{rating}</strong>
                    <span>{RATING_LABELS[rating]}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Feedback</label>
            <textarea
              required
              placeholder="Tell us what you think about the platform..."
              value={formData.feedback}
              onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Suggestions (optional)</label>
            <textarea
              placeholder="Any suggestions to make the platform better?"
              value={formData.suggestions}
              onChange={(e) => setFormData({ ...formData, suggestions: e.target.value })}
            />
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Feedback"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
