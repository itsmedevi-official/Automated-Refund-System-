import Notice from "./Notice";

export default function TxStatus({
  pending,
  error,
  success,
  onDismiss,
  pendingLabel = "Waiting for the transaction to be mined…",
}) {
  return (
    <>
      {pending && <Notice tone="info">{pendingLabel}</Notice>}
      {error && (
        <Notice tone="error" onDismiss={onDismiss}>
          {error}
        </Notice>
      )}
      {success && (
        <Notice tone="success" onDismiss={onDismiss}>
          {success}
        </Notice>
      )}
    </>
  );
}
