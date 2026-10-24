import { stateLabel, stateTone } from "../services/format";

export default function StateBadge({ state }) {
  return <span className={`badge badge-${stateTone(state)}`}>{stateLabel(state)}</span>;
}
