const styles = {
  synthwave: {
    bpm: 98, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], progression: [0, 5, 3, 6],
    lead: "sawtooth", bass: "sawtooth", pad: "triangle", title: "Midnight Compile"
  },
  chiptune: {
    bpm: 136, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], progression: [0, 3, 5, 4],
    lead: "square", bass: "square", pad: "square", title: "8-Bit Build"
  },
  fm: {
    bpm: 108, root: 50, scale: [0, 2, 3, 5, 7, 9, 10], progression: [0, 2, 5, 3],
    lead: "sine", bass: "triangle", pad: "sine", title: "Operator Flow"
  },
  italo: {
    bpm: 118, root: 50, scale: [0, 2, 4, 5, 7, 9, 11], progression: [0, 5, 3, 6],
    lead: "sawtooth", bass: "square", pad: "sawtooth", title: "Deploy to Milano"
  }
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
  events: document.getElementById("events"),
  focus: document.getElementById("focus-mix"),
  volume: document.getElementById("volume")
};

let station = { style: "synthwave", energy: .42, recentEvents: [] };
let audio;
let musicBus;
let master;
let toneFilter;
let compressor;
let delay;
let delayFeedback;
let delayWet;
let noiseBuffer;
let schedulerTimer;
let visualTimer;
let nextNoteTime = 0;
let sequenceStep = 0;
let activeStyle = "synthwave";
let pendingStyle;
let pendingAccent;
let focusMix = localStorage.getItem("codewave-focus") !== "off";

for (let i = 0; i < 48; i += 1) {
  const bar = document.createElement("i");
  bar.style.height = `${10 + Math.random() * 24}%`;
  ui.visualizer.append(bar);
}

function midi(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function scaleNote(preset, degree, octave = 0) {
  const length = preset.scale.length;
  const normalized = ((degree % length) + length) % length;
  return preset.root + preset.scale[normalized] + Math.floor(degree / length) * 12 + octave;
}

function createNoiseBuffer() {
  const buffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function setupAudio() {
  audio = new AudioContext();
  musicBus = audio.createGain();
  toneFilter = audio.createBiquadFilter();
  compressor = audio.createDynamicsCompressor();
  master = audio.createGain();
  delay = audio.createDelay(.6);
  delayFeedback = audio.createGain();
  delayWet = audio.createGain();

  toneFilter.type = "lowpass";
  compressor.threshold.value = -22;
  compressor.knee.value = 16;
  compressor.ratio.value = 5;
  compressor.attack.value = .01;
  compressor.release.value = .3;
  delay.delayTime.value = .24;
  delayFeedback.gain.value = .16;
  delayWet.gain.value = .12;

  musicBus.connect(toneFilter).connect(compressor).connect(master).connect(audio.destination);
  musicBus.connect(delay).connect(delayWet).connect(toneFilter);
  delay.connect(delayFeedback).connect(delay);
  noiseBuffer = createNoiseBuffer();
  updateMix();
}

function updateMix() {
  if (!audio) return;
  const now = audio.currentTime;
  const volume = Number(ui.volume.value) / 100;
  master.gain.setTargetAtTime(volume * .42, now, .04);
  toneFilter.frequency.setTargetAtTime(focusMix ? 3600 : 8800, now, .08);
  delayWet.gain.setTargetAtTime(focusMix ? .08 : .15, now, .08);
}

function synth(note, when, duration, options = {}) {
  if (!audio) return;
  const oscillator = audio.createOscillator();
  const amp = audio.createGain();
  const filter = audio.createBiquadFilter();
  const attack = options.attack ?? .012;
  const release = options.release ?? .12;
  const level = options.gain ?? .025;

  oscillator.type = options.wave || "triangle";
  oscillator.frequency.setValueAtTime(midi(note), when);
  oscillator.detune.value = options.detune || 0;
  filter.type = "lowpass";
  filter.frequency.value = options.cutoff || (focusMix ? 1800 : 4200);
  filter.Q.value = options.resonance || .5;
  amp.gain.setValueAtTime(.0001, when);
  amp.gain.exponentialRampToValueAtTime(level, when + attack);
  amp.gain.setValueAtTime(level, Math.max(when + attack, when + duration - release));
  amp.gain.exponentialRampToValueAtTime(.0001, when + duration);
  oscillator.connect(filter).connect(amp).connect(musicBus);
  oscillator.start(when);
  oscillator.stop(when + duration + .03);
}

function kick(when, level = 1) {
  const oscillator = audio.createOscillator();
  const amp = audio.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(125, when);
  oscillator.frequency.exponentialRampToValueAtTime(48, when + .11);
  amp.gain.setValueAtTime(.1 * level, when);
  amp.gain.exponentialRampToValueAtTime(.0001, when + .22);
  oscillator.connect(amp).connect(musicBus);
  oscillator.start(when);
  oscillator.stop(when + .23);
}

function noiseHit(when, type) {
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const amp = audio.createGain();
  source.buffer = noiseBuffer;
  filter.type = "highpass";
  filter.frequency.value = type === "hat" ? 6200 : 1500;
  const duration = type === "hat" ? .045 : .15;
  const level = type === "hat" ? (focusMix ? .008 : .015) : (focusMix ? .018 : .032);
  amp.gain.setValueAtTime(level, when);
  amp.gain.exponentialRampToValueAtTime(.0001, when + duration);
  source.connect(filter).connect(amp).connect(musicBus);
  source.start(when);
  source.stop(when + duration);
}

function chordNotes(preset, degree) {
  return [0, 2, 4].map(offset => scaleNote(preset, degree + offset));
}

function scheduleAccent(when, preset, chord) {
  if (!pendingAccent) return;
  const accent = pendingAccent;
  pendingAccent = null;
  const gain = focusMix ? .018 : .03;
  const notes = accent.type === "error" ? [chord[0] - 12, chord[1] - 12] : chord.map(note => note + 12);
  notes.forEach((note, index) => synth(note, when + index * .055, .42, {
    wave: accent.type === "error" ? "triangle" : preset.lead,
    gain: gain * accent.intensity,
    attack: .025,
    release: .22,
    cutoff: focusMix ? 1900 : 5000
  }));
}

function scheduleStep(step, when) {
  if (step % 16 === 0 && pendingStyle) {
    activeStyle = pendingStyle;
    pendingStyle = undefined;
  }
  const preset = styles[activeStyle] || styles.synthwave;
  const beat = step % 16;
  const bar = Math.floor(step / 16);
  const degree = preset.progression[bar % preset.progression.length];
  const chord = chordNotes(preset, degree);
  const sixteenth = 60 / preset.bpm / 4;
  const energy = station.energy;

  if (beat === 0) {
    const padDuration = sixteenth * 15.4;
    chord.forEach((note, index) => synth(note, when + index * .012, padDuration, {
      wave: preset.pad,
      gain: focusMix ? .009 : .013,
      attack: focusMix ? .28 : .16,
      release: .55,
      detune: index === 1 ? -5 : index === 2 ? 5 : 0,
      cutoff: focusMix ? 1250 : 2200
    }));
  }

  if (beat % 4 === 0) kick(when, focusMix ? .68 : .9);
  if ((beat === 4 || beat === 12) && energy > .25) noiseHit(when, "snare");
  if ((focusMix ? beat % 4 === 2 : beat % 2 === 0) && energy > .32) noiseHit(when, "hat");

  if ([0, 3, 8, 11].includes(beat)) {
    const bassDegree = beat === 11 ? degree + 4 : degree;
    synth(scaleNote(preset, bassDegree, -12), when, sixteenth * 2.5, {
      wave: preset.bass,
      gain: focusMix ? .027 : .04,
      attack: .008,
      release: .12,
      cutoff: focusMix ? 650 : 950
    });
  }

  const arpRate = focusMix ? 4 : energy > .68 ? 1 : 2;
  if (beat % arpRate === 0) {
    const pattern = [0, 1, 2, 1, 0, 2, 1, 2];
    const note = chord[pattern[Math.floor(beat / arpRate) % pattern.length]] + 12;
    synth(note, when, sixteenth * (focusMix ? 2.8 : 1.5), {
      wave: preset.lead,
      gain: focusMix ? .009 : .016 + energy * .006,
      attack: .015,
      release: focusMix ? .18 : .08,
      cutoff: focusMix ? 2000 : 4800
    });
  }

  if (!focusMix && energy > .7 && [6, 14].includes(beat)) {
    const melodyDegree = degree + [4, 6, 2, 5][bar % 4];
    synth(scaleNote(preset, melodyDegree, 12), when, sixteenth * 3.2, {
      wave: preset.lead, gain: .017, attack: .035, release: .2, cutoff: 5200
    });
  }

  if (beat % 4 === 0) scheduleAccent(when, preset, chord);
}

function scheduler() {
  while (nextNoteTime < audio.currentTime + .12) {
    scheduleStep(sequenceStep, nextNoteTime);
    const preset = styles[activeStyle] || styles.synthwave;
    nextNoteTime += 60 / preset.bpm / 4;
    sequenceStep += 1;
  }
}

function animateVisualizer() {
  const time = performance.now() / 420;
  [...ui.visualizer.children].forEach((bar, index) => {
    const harmonic = Math.sin(index * .48 + time) + Math.sin(index * .13 - time * .7);
    const motion = focusMix ? 12 : 21;
    bar.style.height = `${Math.max(7, 25 + harmonic * motion + station.energy * 18)}%`;
  });
}

function startSequencer() {
  clearInterval(schedulerTimer);
  clearInterval(visualTimer);
  activeStyle = station.style;
  pendingStyle = undefined;
  nextNoteTime = audio.currentTime + .06;
  schedulerTimer = setInterval(scheduler, 25);
  visualTimer = setInterval(animateVisualizer, 80);
  scheduler();
}

function stopSequencer() {
  clearInterval(schedulerTimer);
  clearInterval(visualTimer);
}

function renderFocus() {
  ui.focus.setAttribute("aria-pressed", String(focusMix));
  ui.focus.classList.toggle("active", focusMix);
  ui.focus.querySelector("strong").textContent = focusMix ? "ON" : "OFF";
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
    setupAudio();
    await audio.resume();
    startSequencer();
  } else if (audio.state === "running") {
    await audio.suspend();
    stopSequencer();
  } else {
    await audio.resume();
    startSequencer();
  }
  const playing = audio.state === "running";
  ui.play.classList.toggle("active", playing);
  ui.visualizer.classList.toggle("playing", playing);
  ui.play.querySelector(".play-icon").textContent = playing ? "Ⅱ" : "▶";
  ui.playLabel.textContent = playing ? "The coding session is live" : "Resume the live session";
});

ui.focus.addEventListener("click", () => {
  focusMix = !focusMix;
  localStorage.setItem("codewave-focus", focusMix ? "on" : "off");
  renderFocus();
  updateMix();
});

ui.volume.addEventListener("input", updateMix);

const stream = new EventSource("/api/events");
stream.addEventListener("state", message => { station = JSON.parse(message.data); render(); });
stream.addEventListener("listeners", message => { station.listeners = JSON.parse(message.data).listeners; render(); });
stream.addEventListener("codewave", message => {
  const previousStyle = station.style;
  station = JSON.parse(message.data).state;
  render();
  if (audio?.state === "running") {
    if (station.style !== previousStyle) pendingStyle = station.style;
    const event = station.recentEvents.at(-1);
    if (["commit", "deploy", "test_pass", "test_fail", "error"].includes(event.type)) {
      pendingAccent = { type: event.type, intensity: event.intensity };
    }
  }
});

renderFocus();
fetch("/api/state").then(response => response.json()).then(value => { station = value; render(); });

