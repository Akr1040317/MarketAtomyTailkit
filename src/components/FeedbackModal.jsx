import { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebaseConfig";
import { toast } from "./Toast";
import { useTheme } from "../utils/theme";
import "../assets/dashboard-preview.css";
import "../assets/client-pages.css";

const RATING_LABELS = { 1: "Poor", 2: "Fair", 3: "Okay", 4: "Good", 5: "Excellent" };

export default function FeedbackModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    rating: "",
    feedback: "",
    suggestions: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { theme } = useTheme();

  const auth = getAuth();
  const user = auth.currentUser;

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

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setFormData({ rating: "", feedback: "", suggestions: "" });
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast("Error submitting feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
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
            <Dialog.Panel className="ma-dash mx-auto w-full max-w-lg overflow-hidden rounded-[16px]" data-theme={theme}>
              <div className="panel" style={{ boxShadow: "none", border: 0 }}>
                <div
                  className="panel-head"
                  style={{
                    background: "linear-gradient(120deg, var(--navy), #16305c)",
                    margin: "-1px -1px 0",
                    borderRadius: "16px 16px 0 0",
                    padding: "20px 24px",
                  }}
                >
                  <div>
                    <Dialog.Title as="h2" style={{ color: "#fff", fontFamily: "Manrope, sans-serif" }}>
                      Give Feedback
                    </Dialog.Title>
                    <p style={{ color: "rgba(255,255,255,.72)" }}>Tell us how the Business Health Check is working for you.</p>
                  </div>
                </div>
                <div className="panel-body">
                  {submitted ? (
                    <div className="empty" style={{ padding: "28px 8px" }}>
                      <div className="empty-icon">✓</div>
                      <h3>Thank you for your feedback!</h3>
                      <p>Your note has been saved for the MarketAtomy team.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit}>
                      <div className="form-group">
                        <label>How would you rate your experience?</label>
                        <div className="cp-rating-row">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <div
                              key={rating}
                              className={`cp-star${formData.rating === rating.toString() ? " active" : ""}`}
                              role="button"
                              tabIndex={0}
                              title={RATING_LABELS[rating]}
                              onClick={() => setFormData({ ...formData, rating: rating.toString() })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") setFormData({ ...formData, rating: rating.toString() });
                              }}
                            >
                              {rating}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Your Feedback</label>
                        <textarea
                          required
                          value={formData.feedback}
                          onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
                          placeholder="Tell us what you think about the platform..."
                        />
                      </div>
                      <div className="form-group">
                        <label>Suggestions for Improvement (Optional)</label>
                        <textarea
                          value={formData.suggestions}
                          onChange={(e) => setFormData({ ...formData, suggestions: e.target.value })}
                          placeholder="Any suggestions to make the platform better?"
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9 }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={submitting || !formData.feedback || !formData.rating}
                        >
                          {submitting ? "Submitting..." : "Submit Feedback"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
