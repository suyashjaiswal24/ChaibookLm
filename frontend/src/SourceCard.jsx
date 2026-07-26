function SourceCard({ title, description, children }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="card-body">{children}</div>
    </div>
  );
}

export default SourceCard;
