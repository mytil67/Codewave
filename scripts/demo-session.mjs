const baseUrl = process.env.CODEWAVE_URL || "http://localhost:8787";
const token = process.env.CODEWAVE_INGEST_TOKEN || "";
const styles = ["synthwave", "chiptune", "fm", "italo"];
const events = [
  ["typing", "Editing the main groove", 0.45],
  ["file", "New module detected", 0.6],
  ["test_pass", "Tests are green", 0.78],
  ["error", "Compiler glitch", 0.9],
  ["typing", "Refactoring in progress", 0.55],
  ["commit", "Checkpoint committed", 0.82],
  ["deploy", "Shipping the signal", 1]
];

let index = 0;
console.log(`Sending demo events to ${baseUrl}. Press Ctrl+C to stop.`);

async function send() {
  const [type, label, intensity] = events[index % events.length];
  const body = {
    type,
    label,
    intensity,
    ...(index % events.length === 0 ? { style: styles[Math.floor(index / events.length) % styles.length] } : {})
  };
  const response = await fetch(`${baseUrl}/api/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  console.log(response.status, body);
  index += 1;
}

await send();
setInterval(send, 3200);

