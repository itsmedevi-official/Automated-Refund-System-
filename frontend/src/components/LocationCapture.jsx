import { useState } from "react";
import { getCurrentPosition, reverseGeocode } from "../services/geo";
import Notice from "./Notice";

/**
 * Captures the browser location (or lets the user type coordinates on a desktop
 * without a GPS). The parent receives { lat, lon, accuracy }.
 */
export default function LocationCapture({ value, onChange, label = "Capture my location" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [address, setAddress] = useState("");
  const [manual, setManual] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");

  const capture = async () => {
    setBusy(true);
    setError(null);
    try {
      const position = await getCurrentPosition();
      onChange(position);
      setAddress((await reverseGeocode(position.lat, position.lon)) || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const applyManual = () => {
    const lat = Number(manualLat);
    const lon = Number(manualLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setError("Enter a latitude between -90 and 90 and a longitude between -180 and 180.");
      return;
    }
    setError(null);
    setAddress("");
    onChange({ lat, lon, accuracy: null, capturedAt: Date.now() });
    setManual(false);
  };

  return (
    <div className="location-capture">
      <div className="row wrap">
        <button type="button" className="btn btn-secondary btn-sm" onClick={capture} disabled={busy}>
          {busy ? "Reading GPS…" : label}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setManual((open) => !open)}>
          {manual ? "Hide manual entry" : "Enter manually"}
        </button>
        {value && (
          <span className="mono small">
            {Number(value.lat).toFixed(6)}, {Number(value.lon).toFixed(6)}
            {value.accuracy ? ` (±${value.accuracy} m)` : ""}
          </span>
        )}
      </div>

      {manual && (
        <div className="row wrap manual-coords">
          <input
            type="number"
            step="0.000001"
            placeholder="Latitude"
            value={manualLat}
            onChange={(event) => setManualLat(event.target.value)}
          />
          <input
            type="number"
            step="0.000001"
            placeholder="Longitude"
            value={manualLon}
            onChange={(event) => setManualLon(event.target.value)}
          />
          <button type="button" className="btn btn-ghost btn-sm" onClick={applyManual}>
            Use coordinates
          </button>
        </div>
      )}

      {address && <p className="muted small">{address}</p>}
      {error && (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      )}
    </div>
  );
}
