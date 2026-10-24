export default function Notice({ tone = "info", children, onDismiss }) {
  if (!children) return null;
  return (
    <div
      className={`notice notice-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <span>{children}</span>
      {onDismiss && (
        <button
          type="button"
          className="notice-close"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}
