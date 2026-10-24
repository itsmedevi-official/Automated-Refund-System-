export default function Stats({ items }) {
  return (
    <div className="stats">
      {items.map((item) => (
        <div className="stat" key={item.label}>
          <span className="stat-label">{item.label}</span>
          <strong className="stat-value">{item.value}</strong>
          {item.hint && <span className="stat-hint">{item.hint}</span>}
        </div>
      ))}
    </div>
  );
}
