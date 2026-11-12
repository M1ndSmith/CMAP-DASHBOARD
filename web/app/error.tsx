"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <article className="card error-card">
      <p className="label-caps">Service</p>
      <h1>The analysis API is not responding</h1>
      <p>Start it from the project root with python -m ml.serve, then retry. The pipeline has to finish first so the artifacts exist.</p>
      <p className="quiet">{error.message}</p>
      <button className="btn" type="button" onClick={reset}>
        Retry
      </button>
    </article>
  );
}
