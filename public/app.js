const styles = {
  synthwave: {
    bpm: 98, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], progressions: [[0, 5, 3, 6], [0, 3, 5, 4], [5, 3, 0, 6], [0, 5, 2, 4]],
    lead: "sawtooth", bass: "sawtooth", pad: "triangle", title: "Midnight Compile"
  },
  chiptune: {
    bpm: 136, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], progressions: [[0, 3, 5, 4], [0, 5, 3, 6], [3, 4, 0, 5], [0, 2, 5, 4]],
    lead: "square", bass: "square", pad: "square", title: "8-Bit Build"
  },
  fm: {
    bpm: 108, root: 50, scale: [0, 2, 3, 5, 7, 9, 10], progressions: [[0, 2, 5, 3], [0, 5, 2, 4], [3, 5, 0, 2], [0, 3, 6, 4]],
    lead: "sine", bass: "triangle", pad: "sine", title: "Operator Flow"
  },
  italo: {
    bpm: 118, root: 50, scale: [0, 2, 4, 5, 7, 9, 11], progressions: [[0, 5, 3, 6], [0, 3, 5, 4], [5, 6, 0, 3], [0, 5, 4, 3]],
    lead: "sawtooth", bass: "square", pad: "sawtooth", title: "Deploy to Milano"
  }
};

const ui = {
  play: document.getElementById("play"),
  playLabel: document.getElementById("play-label"),
  track: document.getElementById("track"),
  style: document.getElementById("style"),
  bpm: document.getElementById("bpm"),
  scene: document.getElementById("scene"),
  conductor: document.getElementById("conductor"),
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
let saturation;
let reverb;
let reverbWet;
let chorusDelay;
let chorusWet;
let chorusLfo;
let chorusDepth;
let noiseBuffer;
let warmSawWave;
let softPulseWave;
let schedulerTimer;
let visualTimer;
let nextNoteTime = 0;
let sequenceStep = 0;
let activeStyle = "synthwave";
let pendingStyle;
let pendingAccent;
const conductor = { tension: 0, celebration: 0, motif: 0, climaxBars: 0, color: 0 };
let focusMix = localStorage.getItem("codewave-focus") !== "off";
let isPlaying = false;
let playbackBusy = false;
const playbackId = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
const playbackChannel = "BroadcastChannel" in window ? new BroadcastChannel("codewave-playback") : undefined;

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

function createReverbBuffer(seconds = 2.2) {
  const length = Math.floor(audio.sampleRate * seconds);
  const buffer = audio.createBuffer(2, length, audio.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const decay = (1 - index / length) ** 2.8;
      data[index] = (Math.random() * 2 - 1) * decay;
    }
  }
  return buffer;
}

function saturationCurve(amount = 1.8) {
  const curve = new Float32Array(2048);
  for (let index = 0; index < curve.length; index += 1) {
    const value = index * 2 / (curve.length - 1) - 1;
    curve[index] = Math.tanh(value * amount) / Math.tanh(amount);
  }
  return curve;
}

function createAnalogWaves() {
  const harmonics = 24;
  const real = new Float32Array(harmonics);
  const sawImag = new Float32Array(harmonics);
  const pulseImag = new Float32Array(harmonics);
  for (let harmonic = 1; harmonic < harmonics; harmonic += 1) {
    const rolloff = Math.exp(-harmonic / 9);
    sawImag[harmonic] = ((harmonic % 2 ? 1 : -1) / harmonic) * rolloff;
    pulseImag[harmonic] = harmonic % 2 ? (1 / harmonic) * Math.exp(-harmonic / 7) : 0;
  }
  warmSawWave = audio.createPeriodicWave(real, sawImag);
  softPulseWave = audio.createPeriodicWave(real, pulseImag);
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
  saturation = audio.createWaveShaper();
  reverb = audio.createConvolver();
  reverbWet = audio.createGain();
  chorusDelay = audio.createDelay(.05);
  chorusWet = audio.createGain();
  chorusLfo = audio.createOscillator();
  chorusDepth = audio.createGain();

  toneFilter.type = "lowpass";
  compressor.threshold.value = -22;
  compressor.knee.value = 16;
  compressor.ratio.value = 5;
  compressor.attack.value = .01;
  compressor.release.value = .3;
  delay.delayTime.value = .24;
  delayFeedback.gain.value = .16;
  delayWet.gain.value = .12;
  saturation.curve = saturationCurve();
  saturation.oversample = "4x";
  reverb.buffer = createReverbBuffer();
  reverbWet.gain.value = .1;
  chorusDelay.delayTime.value = .018;
  chorusWet.gain.value = .07;
  chorusLfo.frequency.value = .23;
  chorusDepth.gain.value = .004;

  musicBus.connect(toneFilter).connect(saturation).connect(compressor).connect(master).connect(audio.destination);
  musicBus.connect(delay).connect(delayWet).connect(toneFilter);
  delay.connect(delayFeedback).connect(delay);
  musicBus.connect(reverb).connect(reverbWet).connect(compressor);
  musicBus.connect(chorusDelay).connect(chorusWet).connect(toneFilter);
  chorusLfo.connect(chorusDepth).connect(chorusDelay.delayTime);
  chorusLfo.start();
  createAnalogWaves();
  noiseBuffer = createNoiseBuffer();
  updateMix();
}

function updateMix() {
  if (!audio) return;
  const now = audio.currentTime;
  const volume = Number(ui.volume.value) / 100;
  const synthwave = activeStyle === "synthwave";
  const preset = styles[activeStyle] || styles.synthwave;
  master.gain.setTargetAtTime(volume * .32, now, .04);
  toneFilter.frequency.setTargetAtTime(focusMix ? (synthwave ? 3100 : 3600) : 8200, now, .08);
  delay.delayTime.setTargetAtTime(60 / preset.bpm * .75, now, .08);
  delayWet.gain.setTargetAtTime(focusMix ? (synthwave ? .07 : .045) : .11, now, .08);
  reverbWet.gain.setTargetAtTime(focusMix ? (synthwave ? .08 : .055) : .12, now, .08);
  chorusWet.gain.setTargetAtTime(focusMix ? (synthwave ? .085 : .04) : (synthwave ? .13 : .075), now, .08);
}

function voiceProfile(style, layer, fallbackWave) {
  const profiles = {
    synthwave: {
      pad: [["warmSaw", 0, -11, .4], ["warmSaw", 0, 11, .4], ["triangle", -12, 0, .18]],
      bass: [["warmSaw", 0, 0, .68], ["softPulse", -12, -2, .25]],
      pluck: [["triangle", 0, 0, .68], ["warmSaw", 0, -4, .22]],
      lead: [["warmSaw", 0, -7, .42], ["warmSaw", 0, 7, .42], ["triangle", -12, 0, .16]],
      accent: [["warmSaw", 0, -8, .4], ["warmSaw", 0, 8, .4], ["triangle", -12, 0, .15]]
    },
    chiptune: {
      pad: [["triangle", 0, 0, .68], ["square", 12, 0, .16]],
      bass: [["triangle", 0, 0, .75], ["square", -12, 0, .2]],
      pluck: [["square", 0, 0, .82], ["triangle", 12, 0, .16]],
      lead: [["square", 0, 0, .7], ["triangle", 12, 0, .24]],
      accent: [["square", 0, 0, .7], ["square", 12, 0, .18]]
    },
    fm: {
      pad: [["sine", 0, 0, 1]], bass: [["sine", 0, 0, 1]],
      pluck: [["sine", 0, 0, 1]], lead: [["sine", 0, 0, 1]], accent: [["sine", 0, 0, 1]]
    },
    italo: {
      pad: [["sawtooth", 0, -12, .38], ["sawtooth", 0, 12, .38], ["triangle", 12, 0, .16]],
      bass: [["square", 0, 0, .56], ["sawtooth", -12, -3, .34]],
      pluck: [["sawtooth", 0, -5, .58], ["square", 12, 4, .24]],
      lead: [["sawtooth", 0, -8, .43], ["sawtooth", 0, 8, .43], ["square", 12, 0, .12]],
      accent: [["sawtooth", 0, -9, .4], ["sawtooth", 0, 9, .4], ["square", 12, 0, .16]]
    }
  };
  return profiles[style]?.[layer] || [[fallbackWave || "triangle", 0, 0, 1]];
}

function synth(note, when, duration, options = {}) {
  if (!audio) return;
  const amp = audio.createGain();
  const filter = audio.createBiquadFilter();
  const panner = audio.createStereoPanner();
  const mixer = audio.createGain();
  const attack = options.attack ?? .012;
  const release = options.release ?? .12;
  const level = options.gain ?? .025;
  const layer = options.layer || "lead";
  const profile = voiceProfile(activeStyle, layer, options.wave);
  const oscillators = [];

  filter.type = "lowpass";
  const cutoff = options.cutoff || (focusMix ? 1800 : 4200);
  filter.frequency.setValueAtTime(Math.max(90, cutoff * .38), when);
  filter.frequency.exponentialRampToValueAtTime(cutoff, when + attack + .045);
  filter.frequency.exponentialRampToValueAtTime(Math.max(90, cutoff * .48), when + duration);
  filter.Q.value = options.resonance || .5;
  panner.pan.value = options.pan ?? Math.max(-.45, Math.min(.45, ((note % 7) - 3) * .1));
  amp.gain.setValueAtTime(.0001, when);
  amp.gain.exponentialRampToValueAtTime(level, when + attack);
  amp.gain.setValueAtTime(level, Math.max(when + attack, when + duration - release));
  amp.gain.exponentialRampToValueAtTime(.0001, when + duration);
  mixer.connect(filter).connect(amp).connect(panner).connect(musicBus);

  for (const [wave, octave, detune, weight] of profile) {
    const oscillator = audio.createOscillator();
    const oscillatorGain = audio.createGain();
    if (wave === "warmSaw") oscillator.setPeriodicWave(warmSawWave);
    else if (wave === "softPulse") oscillator.setPeriodicWave(softPulseWave);
    else oscillator.type = wave;
    oscillator.frequency.setValueAtTime(midi(note + octave), when);
    oscillator.detune.value = detune + (options.detune || 0);
    oscillatorGain.gain.value = weight;
    oscillator.connect(oscillatorGain).connect(mixer);
    oscillator.start(when);
    oscillator.stop(when + duration + .04);
    oscillators.push(oscillator);

    if (activeStyle === "fm" && wave === "sine") {
      const modulator = audio.createOscillator();
      const modulation = audio.createGain();
      const ratio = layer === "bass" ? 1 : layer === "pad" ? .5 : options.fmRatio || 2;
      const index = layer === "pluck" ? 1.5 : layer === "lead" ? 1.1 : .48;
      modulator.type = "sine";
      modulator.frequency.setValueAtTime(midi(note + octave) * ratio, when);
      modulation.gain.setValueAtTime(midi(note + octave) * index * (focusMix ? .55 : 1), when);
      modulation.gain.exponentialRampToValueAtTime(.001, when + duration);
      modulator.connect(modulation).connect(oscillator.frequency);
      modulator.start(when);
      modulator.stop(when + duration + .04);
    }
  }

  if (["lead", "pad"].includes(layer)) {
    const vibrato = audio.createOscillator();
    const vibratoDepth = audio.createGain();
    vibrato.frequency.value = layer === "pad" ? .35 : 5.1;
    vibratoDepth.gain.value = layer === "pad" ? 2.2 : 5;
    oscillators.forEach(oscillator => vibratoDepth.connect(oscillator.detune));
    vibrato.connect(vibratoDepth);
    vibrato.start(when);
    vibrato.stop(when + duration + .04);
  }
}

function kick(when, level = 1) {
  const oscillator = audio.createOscillator();
  const sub = audio.createOscillator();
  const amp = audio.createGain();
  const subAmp = audio.createGain();
  oscillator.type = "sine";
  sub.type = "triangle";
  oscillator.frequency.setValueAtTime(150, when);
  oscillator.frequency.exponentialRampToValueAtTime(52, when + .1);
  sub.frequency.setValueAtTime(62, when);
  sub.frequency.exponentialRampToValueAtTime(42, when + .18);
  amp.gain.setValueAtTime(.085 * level, when);
  amp.gain.exponentialRampToValueAtTime(.0001, when + .24);
  subAmp.gain.setValueAtTime(.035 * level, when);
  subAmp.gain.exponentialRampToValueAtTime(.0001, when + .3);
  oscillator.connect(amp).connect(musicBus);
  sub.connect(subAmp).connect(musicBus);
  oscillator.start(when);
  sub.start(when);
  oscillator.stop(when + .23);
  sub.stop(when + .31);
}

function noiseHit(when, type) {
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const amp = audio.createGain();
  const panner = audio.createStereoPanner();
  source.buffer = noiseBuffer;
  filter.type = "highpass";
  const synthwave = activeStyle === "synthwave";
  filter.frequency.value = type === "hat" ? (synthwave ? 4800 : 6200) : (synthwave ? 900 : 1500);
  const duration = type === "hat" ? (synthwave ? .065 : .045) : (synthwave ? .22 : .15);
  const level = type === "hat"
    ? (focusMix ? (synthwave ? .005 : .008) : .013)
    : (focusMix ? (synthwave ? .014 : .018) : .029);
  amp.gain.setValueAtTime(level, when);
  amp.gain.exponentialRampToValueAtTime(.0001, when + duration);
  panner.pan.value = type === "hat" ? .28 : -.12;
  source.connect(filter).connect(amp).connect(panner).connect(musicBus);
  source.start(when);
  source.stop(when + duration);
  if (type === "snare") {
    const tone = audio.createOscillator();
    const toneAmp = audio.createGain();
    tone.type = "triangle";
    tone.frequency.setValueAtTime(190, when);
    tone.frequency.exponentialRampToValueAtTime(118, when + .1);
    toneAmp.gain.setValueAtTime(focusMix ? .012 : .02, when);
    toneAmp.gain.exponentialRampToValueAtTime(.0001, when + .14);
    tone.connect(toneAmp).connect(panner);
    tone.start(when);
    tone.stop(when + .15);
  }
}

function variation(bar, salt = 0) {
  const value = Math.sin((bar + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function sceneForBar(bar) {
  return ["DRIFT", "GROOVE", "LIFT", "BREAKDOWN"][Math.floor((bar % 16) / 4)];
}

function chordNotes(preset, degree, inversion = 0) {
  const notes = [0, 2, 4].map(offset => scaleNote(preset, degree + offset));
  for (let index = 0; index < inversion; index += 1) notes[index] += 12;
  return notes.sort((a, b) => a - b);
}

function scheduleAccent(when, preset, chord) {
  if (!pendingAccent) return;
  const accent = pendingAccent;
  pendingAccent = null;
  const gain = focusMix ? .018 : .03;
  const tense = ["error", "test_fail"].includes(accent.type);
  const notes = tense
    ? [chord[0] - 12, chord[1] - 13]
    : chord.map((note, index) => note + 12 + (accent.type === "deploy" && index === 2 ? 12 : 0));
  notes.forEach((note, index) => synth(note, when + index * .055, .42, {
    layer: "accent",
    wave: tense ? "triangle" : preset.lead,
    gain: gain * accent.intensity,
    attack: .025,
    release: .22,
    cutoff: focusMix ? 1900 : 5000
  }));
}

function conductorLabel() {
  if (conductor.climaxBars > 0) return "CLIMAX";
  if (conductor.tension > .42) return "TENSION";
  if (conductor.celebration > .28) return "RESOLUTION";
  return "FLOW";
}

function conduct(event) {
  switch (event.type) {
    case "error":
    case "test_fail":
      conductor.tension = 1;
      conductor.celebration = 0;
      break;
    case "test_pass":
      conductor.tension *= .2;
      conductor.celebration = 1;
      break;
    case "commit":
      conductor.motif = (conductor.motif + 1) % 4;
      conductor.celebration = Math.max(conductor.celebration, .65);
      break;
    case "deploy":
      conductor.motif = (conductor.motif + 1) % 4;
      conductor.climaxBars = 4;
      conductor.celebration = 1;
      conductor.tension = 0;
      break;
    case "file":
      conductor.color = (conductor.color + 1) % 3;
      break;
  }
  ui.conductor.textContent = conductorLabel();
}

function scheduleStep(step, when) {
  if (step % 16 === 0 && pendingStyle) {
    activeStyle = pendingStyle;
    pendingStyle = undefined;
    updateMix();
  }
  const preset = styles[activeStyle] || styles.synthwave;
  const beat = step % 16;
  const bar = Math.floor(step / 16);
  const section = Math.floor((bar % 16) / 4);
  const progression = preset.progressions[section];
  let degree = progression[bar % 4];
  if (conductor.tension > .55 && bar % 4 === 3) degree += 1;
  const inversion = focusMix ? (bar + conductor.color) % 2 : Math.floor(variation(bar, 1 + conductor.color) * 3);
  const chord = chordNotes(preset, degree, inversion);
  if (conductor.tension > .42) chord[1] -= 1;
  const sixteenth = 60 / preset.bpm / 4;
  const energy = station.energy;
  const isBreakdown = section === 3 && bar % 4 < 2;
  const isLift = section === 2;
  const isClimax = conductor.climaxBars > 0;

  if (beat === 0) {
    ui.scene.textContent = sceneForBar(bar);
    ui.conductor.textContent = conductorLabel();
    const padDuration = sixteenth * 15.4;
    chord.forEach((note, index) => synth(note, when + index * .012, padDuration, {
      layer: "pad",
      wave: preset.pad,
      gain: focusMix ? .009 : .013,
      attack: focusMix ? .28 : .16,
      release: .55,
      detune: index === 1 ? -5 : index === 2 ? 5 : 0,
      cutoff: focusMix ? 1250 : 2200
    }));
  }

  if (beat % 4 === 0 && (!isBreakdown || beat === 0)) kick(when, focusMix ? .68 : .9);
  if (!isBreakdown && (beat === 4 || beat === 12) && energy > .25) noiseHit(when, "snare");
  const hatRate = focusMix ? (isClimax ? 2 : 4) : isLift || isClimax ? 1 : 2;
  if (!isBreakdown && beat % hatRate === 2 % hatRate && energy > .32) noiseHit(when, "hat");

  const bassPatterns = [
    [[0, 0], [3, 0], [8, 0], [11, 4]],
    [[0, 0], [4, 0], [7, 4], [10, 0], [14, 2]],
    [[0, 0], [2, 0], [6, 4], [8, 0], [12, 5], [14, 4]],
    [[0, 0], [8, 0], [12, 4]]
  ];
  const bassPatternIndex = focusMix
    ? (isBreakdown ? 3 : section % 2)
    : Math.floor(variation(bar, 2) * bassPatterns.length);
  const bassPattern = bassPatterns[bassPatternIndex];
  const bassHit = bassPattern.find(([position]) => position === beat);
  if (bassHit) {
    const bassDegree = degree + bassHit[1];
    synth(scaleNote(preset, bassDegree, -12), when, sixteenth * 2.5, {
      layer: "bass",
      wave: preset.bass,
      gain: focusMix ? .027 : .04,
      attack: .008,
      release: .12,
      cutoff: focusMix ? 650 : 950
    });
  }

  const arpPatterns = [
    [0, 1, 2, 1, 0, 2, 1, 2],
    [0, 2, 1, 2, 0, 1, 2, 1],
    [2, 1, 0, 1, 2, 0, 1, 0],
    [0, 1, 0, 2, 1, 2, 0, 1]
  ];
  const arpRate = activeStyle === "synthwave"
    ? (focusMix ? 8 : energy > .72 || isLift ? 2 : 4)
    : (focusMix ? 4 : energy > .68 || isLift ? 1 : 2);
  const arpPattern = arpPatterns[(Math.floor(variation(bar, 3) * arpPatterns.length) + conductor.motif) % arpPatterns.length];
  const leaveSpace = variation(bar * 16 + beat, 4) < (focusMix ? .22 : .1);
  if (!isBreakdown && !leaveSpace && beat % arpRate === 0) {
    const arpOctave = activeStyle === "synthwave" && focusMix ? 0 : 12;
    const note = chord[arpPattern[Math.floor(beat / arpRate) % arpPattern.length]] + arpOctave;
    const pluckDuration = activeStyle === "synthwave" ? (focusMix ? 5.5 : 2.4) : (focusMix ? 2.8 : 1.5);
    synth(note, when, sixteenth * pluckDuration, {
      layer: "pluck",
      wave: preset.lead,
      gain: focusMix ? (activeStyle === "synthwave" ? .0065 : .009) : .014 + energy * .005,
      attack: activeStyle === "synthwave" ? .035 : .015,
      release: activeStyle === "synthwave" ? .28 : focusMix ? .18 : .08,
      cutoff: activeStyle === "synthwave" ? (focusMix ? 1350 : 2800) : focusMix ? 2000 : 4800
    });
  }

  const melodyPositions = [[6, 14], [2, 7, 14], [4, 10, 15], [3, 11]];
  const melodyDegrees = [[4, 6], [2, 4, 6], [5, 3, 6], [4, 2]];
  const motif = Math.floor(variation(bar, 5) * melodyPositions.length);
  const melodyIndex = melodyPositions[motif].indexOf(beat);
  if ((!focusMix || isClimax) && energy > .58 && !isBreakdown && melodyIndex >= 0) {
    const melodyDegree = degree + melodyDegrees[motif][melodyIndex] + conductor.motif;
    synth(scaleNote(preset, melodyDegree, 12), when, sixteenth * 3.2, {
      layer: "lead",
      wave: preset.lead, gain: .017, attack: .035, release: .2, cutoff: 5200
    });
  }

  const finalBar = bar % 8 === 7;
  if (!focusMix && finalBar && energy > .5 && [12, 14, 15].includes(beat)) {
    noiseHit(when, beat === 12 ? "snare" : "hat");
    if (beat === 15) kick(when, .72);
  }

  if (beat % 4 === 0) scheduleAccent(when, preset, chord);
  if (beat === 15) {
    conductor.tension *= .78;
    conductor.celebration *= .7;
    if (conductor.climaxBars > 0) conductor.climaxBars -= 1;
  }
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
  updateMix();
  nextNoteTime = audio.currentTime + .06;
  schedulerTimer = setInterval(scheduler, 25);
  visualTimer = setInterval(animateVisualizer, 80);
  scheduler();
}

function stopSequencer() {
  clearInterval(schedulerTimer);
  clearInterval(visualTimer);
}

function renderPlayback(playing) {
  ui.play.classList.toggle("active", playing);
  ui.visualizer.classList.toggle("playing", playing);
  ui.play.querySelector(".play-icon").textContent = playing ? "Ⅱ" : "▶";
  ui.playLabel.textContent = playing ? "The coding session is live" : "Resume the live session";
}

async function startPlayback() {
  playbackChannel?.postMessage({ type: "claim", id: playbackId });
  setupAudio();
  await audio.resume();
  isPlaying = true;
  startSequencer();
  renderPlayback(true);
}

async function stopPlayback() {
  isPlaying = false;
  stopSequencer();
  const context = audio;
  audio = undefined;
  renderPlayback(false);
  if (context && context.state !== "closed") await context.close();
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
  if (playbackBusy) return;
  playbackBusy = true;
  ui.play.disabled = true;
  try {
    if (isPlaying) await stopPlayback();
    else await startPlayback();
  } finally {
    playbackBusy = false;
    ui.play.disabled = false;
  }
});

playbackChannel?.addEventListener("message", event => {
  if (event.data?.type === "claim" && event.data.id !== playbackId && isPlaying) {
    void stopPlayback();
  }
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
  if (isPlaying && audio?.state === "running") {
    if (station.style !== previousStyle) pendingStyle = station.style;
    const event = station.recentEvents.at(-1);
    conduct(event);
    if (["commit", "deploy", "test_pass", "test_fail", "error"].includes(event.type)) {
      pendingAccent = { type: event.type, intensity: event.intensity };
    }
  }
});

renderFocus();
fetch("/api/state").then(response => response.json()).then(value => { station = value; render(); });

addEventListener("pagehide", () => {
  stopSequencer();
  playbackChannel?.close();
  if (audio?.state !== "closed") void audio?.close();
});

