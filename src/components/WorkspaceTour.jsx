import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import "../assets/workspace-tour.css";

const PAD = 8;

function measureTarget(target, radius = 12) {
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  return {
    top: Math.max(8, rect.top - PAD),
    left: Math.max(8, rect.left - PAD),
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
    radius: radius + PAD,
  };
}

function WelcomeCard({ step, onStart, onSkip }) {
  return (
    <div className="ma-tour-welcome" role="dialog" aria-modal="true" aria-labelledby="ma-tour-welcome-title">
      <div className="ma-tour-welcome-card">
        <div className="ma-tour-welcome-hero">
          <span className="ma-tour-welcome-kicker">Guided walkthrough</span>
          <h2 id="ma-tour-welcome-title">{step.title}</h2>
          <p>{step.body}</p>
        </div>
        <div className="ma-tour-welcome-body">
          <button type="button" className="ma-tour-btn-primary" onClick={onStart}>
            {step.cta || "Start walkthrough"}
          </button>
          <button type="button" className="ma-tour-btn-skip" onClick={onSkip}>
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceTour({ open, steps, onClose, onNavigate }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [spot, setSpot] = useState(null);
  const [tipStyle, setTipStyle] = useState({});

  const step = steps[stepIndex];
  const isWelcome = step?.type === "welcome";
  const totalSteps = steps.filter((item) => item.type !== "welcome").length;
  const displayStep = isWelcome ? 0 : steps.slice(0, stepIndex + 1).filter((item) => item.type !== "welcome").length;
  const progress = totalSteps > 0 ? Math.round((displayStep / totalSteps) * 100) : 0;

  const layoutStep = useCallback(() => {
    if (!open || !step || isWelcome) return;

    const run = (attempt = 0) => {
      const target = step.target ? document.querySelector(step.target) : null;
      if (target && typeof target.scrollIntoView === "function") {
        try {
          target.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
        } catch {
          target.scrollIntoView(true);
        }
      }

      window.setTimeout(() => {
        const box = measureTarget(document.querySelector(step.target), step.radius || 12);
        if (!box && attempt < 8) {
          run(attempt + 1);
          return;
        }

        const finalBox = box || {
          top: Math.max(80, window.innerHeight * 0.22),
          left: Math.max(24, window.innerWidth / 2 - 140),
          width: Math.min(280, window.innerWidth - 48),
          height: 72,
          radius: 14,
        };

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const narrow = vw <= 640;
        if (narrow) {
          finalBox.width = Math.min(finalBox.width, vw - 24);
          finalBox.height = Math.min(finalBox.height, Math.max(56, vh * 0.34));
          finalBox.left = Math.min(Math.max(12, finalBox.left), vw - finalBox.width - 12);
          finalBox.top = Math.min(Math.max(12, finalBox.top), vh - finalBox.height - 12);
        }

        setSpot(finalBox);

        const tipW = Math.min(narrow ? vw - 24 : 360, vw - 24);
        const tipLeft = narrow ? 12 : Math.min(Math.max(16, finalBox.left), vw - tipW - 16);
        const spotBottom = finalBox.top + finalBox.height;
        const tipH = narrow ? Math.min(280, Math.max(220, vh * 0.42)) : 260;
        let tipTop;
        if (narrow) {
          tipTop = Math.max(12, vh - tipH - 20);
        } else {
          const placeBelow = spotBottom + 14 + tipH < vh - 8;
          tipTop = placeBelow ? spotBottom + 14 : Math.max(8, finalBox.top - 14 - tipH);
          tipTop = Math.min(Math.max(8, tipTop), Math.max(8, vh - tipH - 8));
        }
        setTipStyle({ width: tipW, left: tipLeft, top: tipTop });
      }, 80 + attempt * 60);
    };

    run();
  }, [open, step, isWelcome]);

  useEffect(() => {
    if (!open || !step || isWelcome || !step.navigate || !onNavigate) return;
    onNavigate(step.navigate);
  }, [open, stepIndex, step, isWelcome, onNavigate]);

  useLayoutEffect(() => {
    if (!open) return;
    layoutStep();
  }, [open, stepIndex, layoutStep]);

  useEffect(() => {
    if (!open) return undefined;
    const onReflow = () => layoutStep();
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, layoutStep]);

  useEffect(() => {
    if (open) {
      setStepIndex(0);
      setSpot(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !step) return null;

  const next = () => {
    if (stepIndex >= steps.length - 1) {
      onClose?.();
      return;
    }
    setStepIndex((current) => current + 1);
  };

  const back = () => setStepIndex((current) => Math.max(0, current - 1));

  return createPortal(
    <div className="ma-tour-root" aria-live="polite">
      {isWelcome ? (
        <WelcomeCard
          step={step}
          onStart={() => setStepIndex(1)}
          onSkip={() => onClose?.()}
        />
      ) : (
        <>
          <div className="ma-tour-layer" aria-hidden="true" />
          {spot ? (
            <div
              className="ma-tour-spot"
              style={{
                top: spot.top,
                left: spot.left,
                width: spot.width,
                height: spot.height,
                borderRadius: spot.radius,
              }}
            />
          ) : null}
          <div className="ma-tour-tip" role="dialog" aria-modal="true" aria-labelledby="ma-tour-title" style={tipStyle}>
            <div className="ma-tour-tip-card">
              <div className="ma-tour-progress">
                <i style={{ width: `${progress}%` }} />
              </div>
              <div className="ma-tour-tip-body">
                <span className="ma-tour-step">
                  Step {displayStep} of {totalSteps}
                </span>
                <div className="ma-tour-title" id="ma-tour-title">
                  {step.title}
                </div>
                <div className="ma-tour-body">{step.body}</div>
                <div className="ma-tour-actions">
                  <div className="ma-tour-dots">
                    {steps.filter((item) => item.type !== "welcome").map((item, index) => (
                      <span key={item.id} className={`ma-tour-dot${index + 1 === displayStep ? " is-on" : ""}`} />
                    ))}
                  </div>
                  <div className="ma-tour-nav">
                    {stepIndex > 1 ? (
                      <button type="button" className="ma-tour-btn-back" onClick={back}>
                        Back
                      </button>
                    ) : null}
                    <button type="button" className="ma-tour-btn-next" onClick={next}>
                      {stepIndex >= steps.length - 1 ? "Finish" : "Next"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button type="button" className="ma-tour-skip" onClick={() => onClose?.()}>
            Skip tour
          </button>
        </>
      )}
    </div>,
    document.body
  );
}
