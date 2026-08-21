import { Fragment, useEffect, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "./Toast";
import {
  ASSESSMENT_PRICE_LABEL,
  ASSESSMENT_PRODUCT_NAME,
  BETA_PROMO_CODE,
  isBetaPromoCode,
} from "../utils/pricing";
import { startAssessmentCheckout } from "../utils/stripeCheckout";
import "../assets/welcome-purchase.css";

const SLIDES = [
  {
    kicker: "Welcome",
    title: (firstName) => `Welcome${firstName ? `, ${firstName}` : ""}`,
    body: "You're in. MarketAtomy's Business Health Check is a structured way to see how the major systems in your business are working together — and where hidden gaps may be slowing growth.",
    points: [
      "Built for owners who need a clearer baseline",
      "Designed to be completed in focused sessions",
      "Your results stay private to your account",
    ],
  },
  {
    kicker: "Purpose",
    title: () => "Why this assessment exists",
    body: "Most growth problems show up in one place and start in another. This assessment helps you step out of day-to-day firefighting and look at the business as a connected system.",
    points: [
      "Identify strengths before they are taken for granted",
      "Surface upstream gaps that create downstream friction",
      "Know what deserves attention first — not just what feels loudest",
    ],
  },
  {
    kicker: "What you get",
    title: () => "A complete health picture",
    body: "You will work through 20 critical business areas across five systems, then receive a structured report you can actually use.",
    points: [
      "Foundational Structure, Financial Position, Product/Service, Marketing/Sales, and Overall Health",
      "Category scores, priority actions, and recommended resources",
      "A downloadable report and a clearer growth roadmap",
    ],
  },
  {
    kicker: "Begin",
    title: () => "Purchase and begin",
    body: `${ASSESSMENT_PRODUCT_NAME} is a one-time ${ASSESSMENT_PRICE_LABEL} assessment. After checkout, you can start immediately and continue section by section.`,
    points: [
      "One-time fee — not a subscription",
      "Full assessment, report, and action plan included",
      "Help Center guides stay free even if you do not buy today",
    ],
  },
];

export default function WelcomePurchaseModal({
  open,
  firstName,
  onClose,
  onPurchased,
  onBrowseResources,
  startAtPurchase = false,
}) {
  const [step, setStep] = useState(0);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState("");
  const [promoError, setPromoError] = useState("");
  const [busy, setBusy] = useState(false);
  const slide = SLIDES[step];
  const last = step === SLIDES.length - 1;
  const free = Boolean(appliedPromo);

  useEffect(() => {
    if (!open) return;
    setStep(startAtPurchase ? SLIDES.length - 1 : 0);
    setBusy(false);
  }, [open, startAtPurchase]);

  const applyPromo = () => {
    if (!isBetaPromoCode(promoInput)) {
      setAppliedPromo("");
      setPromoError("That promo code is not valid.");
      return false;
    }
    setAppliedPromo(BETA_PROMO_CODE);
    setPromoError("");
    toast("Promo applied. The assessment is free.");
    return true;
  };

  const purchase = async () => {
    const code = appliedPromo || (isBetaPromoCode(promoInput) ? BETA_PROMO_CODE : "");
    if (promoInput.trim() && !code) {
      setPromoError("That promo code is not valid.");
      return;
    }
    if (promoInput.trim() && code && !appliedPromo) {
      setAppliedPromo(BETA_PROMO_CODE);
    }
    setBusy(true);
    try {
      const result = await startAssessmentCheckout(code);
      if (result.alreadyPurchased || result.granted) {
        toast(result.granted ? "Promo applied. Your assessment is unlocked." : "Your assessment is already unlocked.");
        onPurchased?.();
        return;
      }
    } catch (error) {
      console.error("Checkout failed", error);
      toast(error?.message || "Unable to start checkout. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Transition show={open} as={Fragment}>
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) onClose?.();
        }}
        className="welcome-purchase"
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="welcome-purchase-backdrop" aria-hidden="true" />
        </Transition.Child>

        <div className="welcome-purchase-frame">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="welcome-purchase-panel">
              <div className="welcome-purchase-top">
                <span className="welcome-purchase-kicker">{slide.kicker}</span>
                <span className="welcome-purchase-count">
                  {step + 1} / {SLIDES.length}
                </span>
              </div>

              <div className="welcome-purchase-slider">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -18 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Dialog.Title className="welcome-purchase-title">
                      {slide.title(firstName)}
                    </Dialog.Title>
                    <p className="welcome-purchase-body">{slide.body}</p>
                    <ul className="welcome-purchase-points">
                      {slide.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>

                    {last ? (
                      <div className="welcome-purchase-buy">
                        <div className="welcome-purchase-price">
                          <strong>{free ? "$0" : ASSESSMENT_PRICE_LABEL}</strong>
                          <span>{free ? "Promo applied — one-time assessment" : "One-time assessment"}</span>
                        </div>
                        <label className="welcome-purchase-promo">
                          Promo code
                          <div>
                            <input
                              type="text"
                              value={promoInput}
                              onChange={(e) => {
                                setPromoInput(e.target.value);
                                setPromoError("");
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  applyPromo();
                                }
                              }}
                              placeholder="Enter promo code"
                              autoComplete="off"
                              disabled={busy}
                            />
                            <button type="button" onClick={applyPromo} disabled={busy || !promoInput.trim()}>
                              Apply
                            </button>
                          </div>
                          {promoError ? <em>{promoError}</em> : null}
                          {free ? <em className="ok">Code {BETA_PROMO_CODE} applied.</em> : null}
                        </label>
                        <button
                          type="button"
                          className="welcome-purchase-skip"
                          onClick={() => {
                            if (onBrowseResources) onBrowseResources();
                            else onClose?.();
                          }}
                          disabled={busy}
                        >
                          Don’t want to purchase? Check out our free resources
                        </button>
                      </div>
                    ) : null}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="welcome-purchase-dots" aria-hidden="true">
                {SLIDES.map((item, index) => (
                  <button
                    key={item.kicker}
                    type="button"
                    className={index === step ? "active" : ""}
                    onClick={() => setStep(index)}
                    disabled={busy}
                  />
                ))}
              </div>

              <div className="welcome-purchase-actions">
                <button
                  type="button"
                  className="welcome-purchase-secondary"
                  onClick={() => {
                    if (step === 0) {
                      if (onBrowseResources) onBrowseResources();
                      else onClose?.();
                      return;
                    }
                    setStep((current) => current - 1);
                  }}
                  disabled={busy}
                >
                  {step === 0 ? "Skip for now" : "Back"}
                </button>
                {last ? (
                  <button type="button" className="welcome-purchase-primary" onClick={purchase} disabled={busy}>
                    {busy ? "Unlocking…" : free ? "Begin free assessment" : `Purchase and begin — ${ASSESSMENT_PRICE_LABEL}`}
                  </button>
                ) : (
                  <button type="button" className="welcome-purchase-primary" onClick={() => setStep((current) => current + 1)}>
                    Continue
                  </button>
                )}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
