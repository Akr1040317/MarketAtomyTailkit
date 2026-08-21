export default function LockedFeature({
  title,
  body,
  onRequestPurchase,
  onBrowseResources,
}) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p>{body}</p>
        </div>
        <span className="pill attention">Locked</span>
      </div>
      <section className="panel">
        <div className="panel-body" style={{ padding: 32 }}>
          <h2 style={{ fontFamily: "Manrope, sans-serif", margin: "0 0 8px" }}>This area is locked</h2>
          <p className="muted" style={{ maxWidth: 640 }}>
            Purchase the Business Health Check to unlock the assessment, report, and action plan.
            You can still browse free Help Center resources without buying.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
            <button type="button" className="btn btn-primary" onClick={onRequestPurchase}>
              Purchase assessment — $297
            </button>
            {onBrowseResources ? (
              <button type="button" className="btn btn-secondary" onClick={onBrowseResources}>
                Explore free resources
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
