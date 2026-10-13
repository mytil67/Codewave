const styles = {
  synthwave: { bpm: 104, root: 45, scale: [0, 3, 5, 7, 10], wave: "sawtooth", title: "Midnight Compile" },
  chiptune: { bpm: 148, root: 60, scale: [0, 2, 4, 7, 9], wave: "square", title: "8-Bit Build" },
  fm: { bpm: 118, root: 48, scale: [0, 2, 3, 7, 10], wave: "triangle", title: "Operator Flow" },
  italo: { bpm: 122, root: 50, scale: [0, 2, 4, 7, 9], wave: "sawtooth", title: "Deploy to Milano" }
};

const ui = {
  play: document.getElementById("play"),
  playLabel: document.getElementById("play-label"),
  track: document.getElementById("track"),
  style: document.getElementById("style"),
  bpm: document.getElementById("bpm"),
  listeners: document.getElementById("listeners"),
  visualizer: document.getElementById("visualizer"),
  energy: document.getElementById("energy"),
  energyLabel: document.getElementById("energy-label"),
  events: document.getElementById("events")
};
let station = { style: "synthwave", energy: .42, recentEvents: [] };
let audio;
let timer;
let step = 0;

for (let i = 0; i < 48; i += 1) {
  const bar = document.createElement("i");
  bar.style.height = `${10 + Math.random() * 32}%`;
  ui.visualizer.append(bar);
}

function midi(note) { return 440 * 2 ** ((note - 69) / 12); }

function voice(note, duration, gain = .055, wave) {
  if (!audio) return;
  const now = audio.currentTime;
  const oscillator = audio.createOscillator();
  const amp = audio.createGain();
  const filter = audio.createBiquadFilter();
  oscillator.type = wave;
  oscillator.frequency.value = midi(note);
  filter.type = "lowpass";
  filter.frequency.value = 700 + station.energy * 2400;
  amp.gain.setValueAtTime(.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + .018);
  amp.gain.exponentialRampToValueAtTime(.0001, now + duration);
  oscillator.connect(filter).connect(amp).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + .03);
}

function tick() {
  const preset = styles[station.style] || styles.synthwave;
  const octave = step % 8 === 7 ? 12 : 0;
  const note = preset.root + preset.scale[(step * 3) % preset.scale.length] + octave;
  voice(note, .12 + station.energy * .15, .035 + station.energy * .025, preset.wave);
  if (step % 4 === 0) voice(preset.root - 12 + (step % 8 ? 0 : 5), .32, .06, "square");
  [...ui.visualizer.children].forEach((bar, index) => {
    const wave = Math.sin(index * .52 + step * .9) * 22;
    bar.style.height = `${Math.max(7, 22 + wave + Math.random() * station.energy * 55)}%`;
  });
  step += 1;
}

function startSequencer() {
  clearInterval(timer);
  const preset = styles[station.style] || styles.synthwave;
  timer = setInterval(tick, 60000 / preset.bpm / 2);
}

function render() {
  const preset = styles[station.style] || styles.synthwave;
  ui.track.textContent = preset.title;
  ui.style.textContent = station.style.toUpperCase();
  ui.bpm.textContent = preset.bpm;
  ui.listeners.textContent = Math.max(1, station.listeners || 1);
  const percent = Math.round(station.energy * 100);
  ui.energy.style.width = `${percent}%`;
  ui.energyLabel.textContent = `${percent}%`;
  if (!station.recentEvents?.length) return;
  ui.events.innerHTML = station.recentEvents.slice(-4).reverse().map(event => {
    const time = new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return `<li><time>${time}</time><b>${event.type.toUpperCase()}</b><span>${escapeHtml(event.label)}</span></li>`;
  }).join("");
}

function escapeHtml(value) {
  const span = document.createElement("span");
  span.textContent = value;
  return span.innerHTML;
}

ui.play.addEventListener("click", async () => {
  if (!audio) {
    audio = new AudioContext();
    await audio.resume();
    startSequencer();
    tick();
    ui.play.classList.add("active");
    ui.visualizer.classList.add("playing");
    ui.play.querySelector(".play-icon").textContent = "Ⅱ";
    ui.playLabel.textContent = "The coding session is live";
  } else if (audio.state === "running") {
    await audio.suspend();
    clearInterval(timer);
    ui.play.classList.remove("active");
    ui.visualizer.classList.remove("playing");
    ui.play.querySelector(".play-icon").textContent = "▶";
    ui.playLabel.textContent = "Resume the live session";
  } else {
    await audio.resume();
    startSequencer();
    ui.play.classList.add("active");
    ui.visualizer.classList.add("playing");
    ui.play.querySelector(".play-icon").textContent = "Ⅱ";
    ui.playLabel.textContent = "The coding session is live";
  }
});

const stream = new EventSource("/api/events");
stream.addEventListener("state", message => { station = JSON.parse(message.data); render(); });
stream.addEventListener("listeners", message => { station.listeners = JSON.parse(message.data).listeners; render(); });
stream.addEventListener("codewave", message => {
  const previousStyle = station.style;
  station = JSON.parse(message.data).state;
  render();
  if (audio?.state === "running") {
    if (station.style !== previousStyle) startSequencer();
    const event = station.recentEvents.at(-1);
    if (["commit", "deploy", "test_pass"].includes(event.type)) {
      const preset = styles[station.style];
      preset.scale.slice(0, 3).forEach((offset, index) => setTimeout(() => voice(preset.root + 12 + offset, .35, .08, preset.wave), index * 85));
    }
  }
});

fetch("/api/state").then(response => response.json()).then(value => { station = value; render(); });

