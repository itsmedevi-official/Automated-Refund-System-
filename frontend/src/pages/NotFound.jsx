import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="page center">
      <h1>Page not found</h1>
      <p className="muted">That route does not exist in this demo.</p>
      <Link className="btn btn-primary" to="/">
        Back to the home page
      </Link>
    </div>
  );
}
