// A health readout, not a second product screen. The one screen is the Pit Wall in
// apps/web. This just confirms the host is up and shows where the feed lives.
export default function Health() {
  const round = process.env.ROUND_ID ?? "0x3fa9";
  return (
    <main>
      <h1>Metriq host</h1>
      <p>Task host, SSE feed, and indexer. The product is the Pit Wall (apps/web).</p>
      <ul>
        <li>
          SSE feed: <code>/api/round/{round}/stream</code>
        </li>
        <li>
          Task host: <code>POST /api/task/[id]</code>
        </li>
      </ul>
    </main>
  );
}
