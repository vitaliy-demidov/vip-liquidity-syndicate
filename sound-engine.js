/**
 * ============================================================================
 * VIP LIQUIDITY SYNDICATE - PROCEDURAL WEB AUDIO API SOUND ENGINE
 * ============================================================================
 * Pure JavaScript, 100% offline, zero external audio asset dependencies.
 * 
 * Aesthetic: Institutional Bloomberg / Hedge-Fund / High-End Cybernetic Fintech
 * Soundtrack: Hans Zimmer / Interstellar / Succession / Neo-Classical Ambient
 * 
 * Architecture & Features:
 * 1. Procedural Motivational Background Music Generator (Cinematic Ambient):
 *    - Evolving 4-chord progression: C minor -> Ab major -> Eb major -> Bb major (32s cycle)
 *    - Soft polyphonic analog pad (dual-oscillator warmth, low-pass filter 600-900 Hz,
 *      breathing 0.08Hz LFO modulation, dual-bank seamless equal-power crossfading)
 *    - Delicate crystalline high-register arpeggio (sine + octave overtone, fast attack,
 *      bell-like decay, procedural ping-pong delay & 2.4s algorithmic scoring stage reverb)
 *    - Deep velvet sub-bass (32.7 - 58.3 Hz) with portamento glide and steep 85Hz lowpass
 *    - Analog scoring stage tape air / brownian noise floor (-42dB)
 * 2. Delicate Volume Balancing:
 *    - Music Master Gain calibrated at 0.14 - 0.15 (14-15%), delicate & non-intrusive
 *    - Smooth 2.5s fade-in upon activation, zero audio clicks or pops
 *    - Smooth 1.2s fade-out upon muting
 *    - Intelligent sidechain ducking during payout confirmations
 * 3. Interactive UI Sound Effects:
 *    - High-End Haptic Click / Swiss dial detent (for sliders, presets, buttons)
 *    - Precision Mechanical Switch (CNC relay click for tabs and modals)
 *    - Scene Transition Swoosh (aerodynamic sweep harmonized to narrative scenes)
 *    - Seismic Payout Confirmation (38Hz sub thud + 6-partial crystal bell chime)
 * 4. Header UI Synchronization & Soft-Start:
 *    - Animated equalizer bars and '[AUDIO: MOTIVATION ON/OFF]' status
 *    - Synchronized across cinematic-story.html and index.html
 *    - Seamless unlock on first user interaction with keyboard shortcut 'M'
 * ============================================================================
 */

(function(window) {
  'use strict';

  // --------------------------------------------------------------------------
  // HARMONIC PROGRESSION DEFINITIONS (C minor -> Ab major -> Eb major -> Bb major)
  // --------------------------------------------------------------------------
  const CHORD_PROGRESSION = [
    {
      name: 'C minor (Introspection & Focus)',
      rootFreq: 32.703, // C1 Velvet Sub-Bass
      subFreq2: 65.406, // C2 Sub-Octave
      padNotes: [130.81, 155.56, 196.00, 261.63, 311.13], // C3, Eb3, G3, C4, Eb4
      arpNotes: [261.63, 311.13, 392.00, 466.16, 523.25, 622.25, 783.99, 1046.50] // C4, Eb4, G4, Bb4, C5, Eb5, G5, C6
    },
    {
      name: 'Ab major (Emotional Horizon & Inspiration)',
      rootFreq: 51.913, // Ab1 Velvet Sub-Bass
      subFreq2: 103.83, // Ab2 Sub-Octave
      padNotes: [103.83, 130.81, 155.56, 207.65, 261.63], // Ab2, C3, Eb3, Ab3, C4
      arpNotes: [261.63, 311.13, 415.30, 523.25, 622.25, 830.61, 1046.50, 1244.51] // C4, Eb4, Ab4, C5, Eb5, Ab5, C6, Eb6
    },
    {
      name: 'Eb major (Breakthrough & Nobility)',
      rootFreq: 38.891, // Eb1 Velvet Sub-Bass
      subFreq2: 77.782, // Eb2 Sub-Octave
      padNotes: [116.54, 155.56, 196.00, 233.08, 311.13], // Bb2, Eb3, G3, Bb3, Eb4
      arpNotes: [233.08, 311.13, 392.00, 466.16, 622.25, 783.99, 932.33, 1244.51] // Bb3, Eb4, G4, Bb4, Eb5, G5, Bb5, Eb6
    },
    {
      name: 'Bb major (Forward Momentum & Resolution)',
      rootFreq: 58.270, // Bb1 Velvet Sub-Bass
      subFreq2: 116.54, // Bb2 Sub-Octave
      padNotes: [116.54, 146.83, 174.61, 233.08, 293.66], // Bb2, D3, F3, Bb3, D4
      arpNotes: [233.08, 293.66, 349.23, 466.16, 587.33, 698.46, 932.33, 1174.66] // Bb3, D4, F4, Bb4, D5, F5, Bb5, D6
    }
  ];

  // Hans Zimmer / Interstellar minimalist 16-step undulating arpeggio motif
  const ARP_MOTIF_PATTERN = [0, 2, 4, 7, 5, 4, 2, 3, 1, 3, 5, 6, 7, 5, 4, 2];

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.isMuted = true; // Muted by default for respectful browser UX
      this.isInitialized = false;

      // Master audio nodes
      this.masterGain = null;
      this.compressor = null;
      this.sfxGain = null;

      // Motivation music bus & parameters
      this.musicGain = null;
      this.musicMasterVolume = 0.15; // Delicate & non-intrusive (~15%)
      this.isMusicPlaying = false;
      
      // Pad synthesis & dual-bank crossfader
      this.padFilter = null;
      this.padLfo = null;
      this.padLfoGain = null;
      this.activePadBank = null;
      this.padBankA = null;
      this.padBankB = null;

      // Velvet Sub-Bass
      this.subOsc = null;
      this.subOscWarmth = null;
      this.subFilter = null;
      this.subGain = null;

      // Spatial FX (Procedural Reverb & Stereo Ping-Pong Delay)
      this.reverbNode = null;
      this.reverbGain = null;
      this.delayL = null;
      this.delayR = null;
      this.delayFeedback = null;
      this.delayFilter = null;
      this.delayDryGain = null;
      this.delayWetGain = null;

      // Procedural Tape Air Buffer
      this.noiseBuffer = null;
      this.tapeNoiseSource = null;

      // Musical Sequencer & Clock State
      this.currentChordIndex = 0;
      this.chordStartTime = 0;
      this.chordDuration = 8.0; // 8.0s per chord = 32s full cycle
      this.arpStepInterval = 0.235; // 16th note pulse (~64 BPM)
      this.currentArpStep = 0;
      this.nextArpTime = 0;
      this.schedulerTimer = null;

      // Haptic Slider Throttling & State
      this.lastSliderTickTime = 0;
      this.lastSliderValue = 25000;
      this.toastTimeout = null;

      // Bind methods
      this.init = this.init.bind(this);
      this.toggle = this.toggle.bind(this);
      this.toggleMute = this.toggleMute.bind(this);
      this.startMotivationMusic = this.startMotivationMusic.bind(this);
      this.stopMotivationMusic = this.stopMotivationMusic.bind(this);
      this.musicScheduleTick = this.musicScheduleTick.bind(this);
    }

    /**
     * Lazy-initialize the Web Audio Context upon user interaction
     */
    init() {
      if (this.isInitialized && this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        return;
      }

      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          console.warn('[SyndicateAudio] Web Audio API is not supported in this environment.');
          return;
        }

        this.ctx = new AudioContextClass();

        // 1. Master Limiter / Dynamics Compressor (Prevents digital clipping & glues the mix)
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime); // dB
        this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);        // dB
        this.compressor.ratio.setValueAtTime(4.5, this.ctx.currentTime);     // 4.5:1 ratio
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);   // 3ms attack
        this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);   // 250ms release

        // 2. Master Gain Node
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);

        // 3. UI SFX Bus (Clicks, Switches, Payouts)
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        this.sfxGain.connect(this.masterGain);

        // 4. Procedural Buffers & Impulse Responses
        this.generateNoiseBuffer();
        this.buildSpatialFxGraph();

        // 5. Procedural Motivational Music Bus
        this.buildMotivationMusicGraph();

        this.isInitialized = true;
        this.updateToggleUI();

        // Safe unlock listener for mobile & autoplay policies
        const unlock = () => {
          if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
          }
          window.removeEventListener('click', unlock);
          window.removeEventListener('keydown', unlock);
          window.removeEventListener('touchstart', unlock);
        };
        window.addEventListener('click', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
        window.addEventListener('touchstart', unlock, { once: true });

        // Global 'M' hotkey listener for audio toggle
        window.addEventListener('keydown', (e) => {
          const isInput = e.target && typeof e.target.matches === 'function' && e.target.matches('input, textarea, select, [contenteditable="true"]');
          if ((e.key === 'm' || e.key === 'M') && !isInput) {
            this.toggle();
          }
        });

      } catch (err) {
        console.error('[SyndicateAudio] Initialization failed:', err);
      }
    }

    /**
     * Generate procedural warm analog floor noise buffer (3 seconds)
     */
    generateNoiseBuffer() {
      if (!this.ctx) return;
      const sampleRate = this.ctx.sampleRate;
      const bufferSize = sampleRate * 3;
      const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        data[i] = lastOut * 2.5;
      }
      this.noiseBuffer = buffer;
    }

    /**
     * Generate procedural acoustic scoring-stage convolution reverb
     * Creates a natural 2.4s cinematic decay with warm high-frequency damping
     */
    generateImpulseResponse(duration = 2.4, decay = 2.5) {
      if (!this.ctx) return null;
      const sampleRate = this.ctx.sampleRate;
      const length = Math.floor(sampleRate * duration);
      const impulse = this.ctx.createBuffer(2, length, sampleRate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * decay);
        const damping = Math.exp(-t * 1.8);
        left[i] = (Math.random() * 2 - 1) * env * damping * 0.6;
        right[i] = (Math.random() * 2 - 1) * env * damping * 0.6;
      }
      return impulse;
    }

    /**
     * Builds the Spatial FX network:
     * - Procedural Stereo Ping-Pong Delay
     * - Algorithmic Scoring Stage Reverb
     */
    buildSpatialFxGraph() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      // --- Algorithmic Reverb Convolver ---
      this.reverbNode = this.ctx.createConvolver();
      const irBuffer = this.generateImpulseResponse(2.4, 2.6);
      if (irBuffer) {
        this.reverbNode.buffer = irBuffer;
      }

      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.setValueAtTime(0.35, t);
      this.reverbNode.connect(this.reverbGain);

      // --- Stereo Ping-Pong Delay Network ---
      this.delayL = this.ctx.createDelay(1.0);
      this.delayL.delayTime.setValueAtTime(0.24, t);

      this.delayR = this.ctx.createDelay(1.0);
      this.delayR.delayTime.setValueAtTime(0.36, t);

      this.delayFeedback = this.ctx.createGain();
      this.delayFeedback.gain.setValueAtTime(0.32, t);

      this.delayFilter = this.ctx.createBiquadFilter();
      this.delayFilter.type = 'lowpass';
      this.delayFilter.frequency.setValueAtTime(3200, t); // Tape damping

      this.delayDryGain = this.ctx.createGain();
      this.delayDryGain.gain.setValueAtTime(0.85, t);

      this.delayWetGain = this.ctx.createGain();
      this.delayWetGain.gain.setValueAtTime(0.28, t);

      // Ping-pong cross-wiring
      this.delayL.connect(this.delayFilter);
      this.delayFilter.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayR);
      this.delayR.connect(this.delayFeedback);

      this.delayL.connect(this.delayWetGain);
      this.delayR.connect(this.delayWetGain);
    }

    /**
     * Builds the complete procedural motivational music synthesis graph:
     * - Music Master Gain (0.15 level with smooth 2.5s fade-in)
     * - Polyphonic Analog Pad Filter + 0.08Hz Breathing LFO
     * - Velvet Sub-Bass Unit
     * - Tape Air Floor
     */
    buildMotivationMusicGraph() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      // Master Music Bus (Starts at 0.00001 for zero-click fade-in)
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.00001, t);
      this.musicGain.connect(this.masterGain);

      // Connect spatial returns into the music bus
      if (this.reverbGain) this.reverbGain.connect(this.musicGain);
      if (this.delayWetGain) this.delayWetGain.connect(this.musicGain);

      // --- WARM ANALOG PAD FILTER & LFO ---
      // Lowpass filter centered at 750 Hz with slow breathing LFO modulation (600-900 Hz)
      this.padFilter = this.ctx.createBiquadFilter();
      this.padFilter.type = 'lowpass';
      this.padFilter.frequency.setValueAtTime(750, t);
      this.padFilter.Q.setValueAtTime(1.2, t);

      this.padLfo = this.ctx.createOscillator();
      this.padLfo.type = 'sine';
      this.padLfo.frequency.setValueAtTime(0.083, t); // ~12 second slow breath

      this.padLfoGain = this.ctx.createGain();
      this.padLfoGain.gain.setValueAtTime(150, t); // Sweeps cutoff between 600 Hz and 900 Hz

      this.padLfo.connect(this.padLfoGain);
      this.padLfoGain.connect(this.padFilter.frequency);
      this.padLfo.start(t);

      // Pad filter feeds both direct music bus and reverb send
      this.padFilter.connect(this.musicGain);
      if (this.reverbNode) {
        const padReverbSend = this.ctx.createGain();
        padReverbSend.gain.setValueAtTime(0.28, t);
        this.padFilter.connect(padReverbSend);
        padReverbSend.connect(this.reverbNode);
      }

      // Initialize dual voice banks for seamless pad crossfading
      this.padBankA = this.createPadBank();
      this.padBankB = this.createPadBank();
      this.activePadBank = 'A';

      // --- VELVET SUB-BASS UNIT (32.7 - 58.3 Hz) ---
      this.subFilter = this.ctx.createBiquadFilter();
      this.subFilter.type = 'lowpass';
      this.subFilter.frequency.setValueAtTime(85, t); // Steep clean cutoff
      this.subFilter.Q.setValueAtTime(1.1, t);

      this.subGain = this.ctx.createGain();
      this.subGain.gain.setValueAtTime(0.085, t); // Solid, velvety weight

      this.subOsc = this.ctx.createOscillator();
      this.subOsc.type = 'sine';
      this.subOsc.frequency.setValueAtTime(CHORD_PROGRESSION[0].rootFreq, t);

      this.subOscWarmth = this.ctx.createOscillator();
      this.subOscWarmth.type = 'triangle';
      this.subOscWarmth.frequency.setValueAtTime(CHORD_PROGRESSION[0].rootFreq, t);
      const subWarmthGain = this.ctx.createGain();
      subWarmthGain.gain.setValueAtTime(0.12, t);

      this.subOsc.connect(this.subFilter);
      this.subOscWarmth.connect(subWarmthGain);
      subWarmthGain.connect(this.subFilter);

      this.subFilter.connect(this.subGain);
      this.subGain.connect(this.musicGain);

      this.subOsc.start(t);
      this.subOscWarmth.start(t);

      // --- ANALOG TAPE AIR / SCORING STAGE FLOOR ---
      if (this.noiseBuffer) {
        this.tapeNoiseSource = this.ctx.createBufferSource();
        this.tapeNoiseSource.buffer = this.noiseBuffer;
        this.tapeNoiseSource.loop = true;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(340, t);
        noiseFilter.Q.setValueAtTime(2.0, t);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.0035, t); // -49dB subtle tape air

        this.tapeNoiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.musicGain);

        this.tapeNoiseSource.start(t);
      }
    }

    /**
     * Helper to instantiate a polyphonic voice bank with dual-oscillator warmth
     */
    createPadBank() {
      if (!this.ctx) return null;
      const bankGain = this.ctx.createGain();
      bankGain.gain.setValueAtTime(0.00001, this.ctx.currentTime);
      bankGain.connect(this.padFilter);

      return {
        bankGain,
        voices: [] // Populated dynamically on chord triggers
      };
    }

    /**
     * Start / Fade in the Procedural Motivational Background Music
     * Smooth 2.5-second luxury ramp with zero audio clicks
     */
    startMotivationMusic() {
      if (!this.ctx) this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const t = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(t);
      const startVal = Math.max(this.musicGain.gain.value, 0.00001);
      this.musicGain.gain.setValueAtTime(startVal, t);
      
      // Smooth 2.5s luxury bloom to target master volume (0.15)
      this.musicGain.gain.linearRampToValueAtTime(this.musicMasterVolume, t + 2.5);
      this.isMusicPlaying = true;

      // Start chord and arpeggio clock
      this.chordStartTime = t;
      this.nextArpTime = t + 0.1;
      this.triggerPadChord(this.currentChordIndex, t);

      // Launch lookahead scheduler
      if (!this.schedulerTimer) {
        this.schedulerTimer = setInterval(this.musicScheduleTick, 50);
      }
    }

    /**
     * Fade out / Stop the Procedural Motivational Background Music
     * Smooth 1.2-second fade-out
     */
    stopMotivationMusic() {
      if (!this.ctx || !this.musicGain) return;
      const t = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(t);
      const startVal = Math.max(this.musicGain.gain.value, 0.00001);
      this.musicGain.gain.setValueAtTime(startVal, t);

      // Smooth 1.2s fade-out to silence
      this.musicGain.gain.exponentialRampToValueAtTime(0.00001, t + 1.2);
      this.isMusicPlaying = false;

      // Clear sequencer timer after fade-out
      setTimeout(() => {
        if (!this.isMusicPlaying && this.schedulerTimer) {
          clearInterval(this.schedulerTimer);
          this.schedulerTimer = null;
        }
      }, 1300);
    }

    /**
     * High-precision lookahead scheduler tick
     * Schedules chord transitions and arpeggiator notes accurately
     */
    musicScheduleTick() {
      if (!this.ctx || !this.isMusicPlaying) return;
      const now = this.ctx.currentTime;
      const lookahead = 0.18; // 180ms scheduling window

      // 1. Check Chord Progression Lifecycle (32-second continuous harmonic cycle)
      if (now >= this.chordStartTime + this.chordDuration) {
        this.currentChordIndex = (this.currentChordIndex + 1) % CHORD_PROGRESSION.length;
        this.chordStartTime = now;
        this.triggerPadChord(this.currentChordIndex, now);
      }

      // 2. Schedule Crystalline Arpeggio Notes
      while (this.nextArpTime < now + lookahead) {
        this.scheduleArpNote(this.nextArpTime);
        this.nextArpTime += this.arpStepInterval;
        this.currentArpStep++;
      }
    }

    /**
     * Triggers the warm polyphonic analog pad with dual-bank crossfading
     * and glides the velvet sub-bass
     */
    triggerPadChord(chordIdx, time) {
      if (!this.ctx) return;
      const chord = CHORD_PROGRESSION[chordIdx];
      const crossfadeTime = 2.4;

      // Glide velvet sub-bass smoothly into the new chord root
      if (this.subOsc) {
        this.subOsc.frequency.cancelScheduledValues(time);
        this.subOsc.frequency.setValueAtTime(this.subOsc.frequency.value, time);
        this.subOsc.frequency.exponentialRampToValueAtTime(chord.rootFreq, time + 0.85);

        this.subOscWarmth.frequency.cancelScheduledValues(time);
        this.subOscWarmth.frequency.setValueAtTime(this.subOscWarmth.frequency.value, time);
        this.subOscWarmth.frequency.exponentialRampToValueAtTime(chord.rootFreq, time + 0.85);
      }

      // Determine incoming vs outgoing bank
      const incomingBank = this.activePadBank === 'A' ? this.padBankB : this.padBankA;
      const outgoingBank = this.activePadBank === 'A' ? this.padBankA : this.padBankB;
      this.activePadBank = this.activePadBank === 'A' ? 'B' : 'A';

      // 1. Fade out outgoing bank over crossfadeTime
      if (outgoingBank && outgoingBank.bankGain) {
        outgoingBank.bankGain.gain.cancelScheduledValues(time);
        const currOut = Math.max(outgoingBank.bankGain.gain.value, 0.0001);
        outgoingBank.bankGain.gain.setValueAtTime(currOut, time);
        outgoingBank.bankGain.gain.exponentialRampToValueAtTime(0.0001, time + crossfadeTime);

        // Stop and clean up previous oscillators after fade
        const oldVoices = outgoingBank.voices;
        outgoingBank.voices = [];
        setTimeout(() => {
          oldVoices.forEach(v => {
            try {
              v.triOsc.stop();
              v.sawOsc.stop();
              v.triOsc.disconnect();
              v.sawOsc.disconnect();
            } catch (e) {}
          });
        }, (crossfadeTime + 0.2) * 1000);
      }

      // 2. Populate and fade in incoming bank
      if (incomingBank && incomingBank.bankGain) {
        incomingBank.voices = [];
        const perVoiceGain = 0.042 / chord.padNotes.length;

        chord.padNotes.forEach((freq, idx) => {
          // Primary warm triangle wave
          const triOsc = this.ctx.createOscillator();
          triOsc.type = 'triangle';
          triOsc.frequency.setValueAtTime(freq, time);

          // Secondary detuned saw wave for lush analog ensemble string sheen
          const sawOsc = this.ctx.createOscillator();
          sawOsc.type = 'sawtooth';
          sawOsc.frequency.setValueAtTime(freq, time);
          const detune = (idx % 2 === 0 ? 4.5 : -4.5);
          sawOsc.detune.setValueAtTime(detune, time);

          const voiceGain = this.ctx.createGain();
          voiceGain.gain.setValueAtTime(perVoiceGain, time);

          const sawAtten = this.ctx.createGain();
          sawAtten.gain.setValueAtTime(0.32, time); // Keep saw soft & warm

          triOsc.connect(voiceGain);
          sawOsc.connect(sawAtten);
          sawAtten.connect(voiceGain);
          voiceGain.connect(incomingBank.bankGain);

          triOsc.start(time);
          sawOsc.start(time);

          incomingBank.voices.push({ triOsc, sawOsc, voiceGain });
        });

        // Bloom in the new bank
        incomingBank.bankGain.gain.cancelScheduledValues(time);
        incomingBank.bankGain.gain.setValueAtTime(0.0001, time);
        incomingBank.bankGain.gain.linearRampToValueAtTime(0.048, time + 2.2);
      }
    }

    /**
     * Schedules a single crystalline high-register arpeggio note
     * Creates an ethereal, motivating Interstellar-inspired sparkle
     */
    scheduleArpNote(time) {
      if (!this.ctx) return;
      const chord = CHORD_PROGRESSION[this.currentChordIndex];
      const motifIdx = ARP_MOTIF_PATTERN[this.currentArpStep % ARP_MOTIF_PATTERN.length];
      const freq = chord.arpNotes[motifIdx % chord.arpNotes.length];

      // Pure Sine fundamental
      const sineOsc = this.ctx.createOscillator();
      sineOsc.type = 'sine';
      sineOsc.frequency.setValueAtTime(freq, time);

      // Subtle Octave overtone (+12 semitones) for crystal bell glass timbre
      const overtoneOsc = this.ctx.createOscillator();
      overtoneOsc.type = 'sine';
      overtoneOsc.frequency.setValueAtTime(freq * 2, time);

      const overtoneGain = this.ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.14, time);
      overtoneOsc.connect(overtoneGain);

      // Envelope: Fast 8ms attack, gentle 450ms exponential decay
      const noteGain = this.ctx.createGain();
      noteGain.gain.setValueAtTime(0.0001, time);
      noteGain.gain.linearRampToValueAtTime(0.036, time + 0.008);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.46);

      // Air High-Shelf Sparkle Filter
      const sparkFilter = this.ctx.createBiquadFilter();
      sparkFilter.type = 'highpass';
      sparkFilter.frequency.setValueAtTime(320, time);

      sineOsc.connect(noteGain);
      overtoneGain.connect(noteGain);
      noteGain.connect(sparkFilter);

      // Stereo alternating pan
      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        const panValue = (this.currentArpStep % 2 === 0 ? -0.32 : 0.32);
        panner.pan.setValueAtTime(panValue, time);
        sparkFilter.connect(panner);
        
        panner.connect(this.musicGain);
        if (this.delayL) panner.connect(this.delayL);
        if (this.reverbNode) {
          const arpReverbSend = this.ctx.createGain();
          arpReverbSend.gain.setValueAtTime(0.38, time);
          panner.connect(arpReverbSend);
          arpReverbSend.connect(this.reverbNode);
        }
      } else {
        sparkFilter.connect(this.musicGain);
        if (this.delayL) sparkFilter.connect(this.delayL);
        if (this.reverbNode) sparkFilter.connect(this.reverbNode);
      }

      sineOsc.start(time);
      overtoneOsc.start(time);
      sineOsc.stop(time + 0.5);
      overtoneOsc.stop(time + 0.5);
    }

    /**
     * Toggle audio on/off from any header button or keybinding
     * Synchronizes across both cinematic-story.html and index.html
     */
    toggle() {
      if (!this.isInitialized) {
        this.init();
      }

      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      this.isMuted = !this.isMuted;

      if (!this.isMuted) {
        this.startMotivationMusic();
        this.playMechanicalSwitch({ pitch: 1.15, direction: 'up' });
        this.showToast('МОТИВИРУЮЩИЙ САУНДТРЕК ВКЛЮЧЕН • HANS ZIMMER STYLE');
      } else {
        this.stopMotivationMusic();
        this.playMechanicalSwitch({ pitch: 0.85, direction: 'down' });
        this.showToast('АУДИО ВЫКЛЮЧЕНО');
      }

      this.updateToggleUI();
      return !this.isMuted;
    }

    /**
     * Compatibility alias for toggleMute() - returns isMuted (true when muted)
     */
    toggleMute() {
      this.toggle();
      return this.isMuted;
    }

    /**
     * Check if background music is active
     */
    isAudioPlaying() {
      return !this.isMuted && this.isMusicPlaying;
    }

    /**
     * Set music master volume level safely (0.12 - 0.18 range)
     */
    setMusicVolume(vol) {
      this.musicMasterVolume = Math.min(Math.max(vol, 0.05), 0.35);
      if (this.isMusicPlaying && this.ctx && this.musicGain) {
        const t = this.ctx.currentTime;
        this.musicGain.gain.cancelScheduledValues(t);
        this.musicGain.gain.linearRampToValueAtTime(this.musicMasterVolume, t + 0.3);
      }
    }

    /**
     * Synchronize header UI across both pages:
     * - cinematic-story.html (#audio-toggle-btn, #audio-eq-bars, #audio-mute-icon, #audio-status-label)
     * - index.html / portal.html (#syndicate-audio-toggle, #audio-toggle-text)
     */
    updateToggleUI() {
      const isPlaying = !this.isMuted;

      // 1. cinematic-story.html Controls
      const storyBtn = document.getElementById('audio-toggle-btn');
      const eqBars = document.getElementById('audio-eq-bars');
      const muteIcon = document.getElementById('audio-mute-icon');
      const storyLabel = document.getElementById('audio-status-label');

      if (storyBtn) {
        if (isPlaying) {
          if (eqBars) { eqBars.classList.remove('hidden'); eqBars.classList.add('flex'); }
          if (muteIcon) { muteIcon.classList.add('hidden'); }
          if (storyLabel) { storyLabel.innerText = '[AUDIO: MOTIVATION ON]'; }
          storyBtn.classList.add('border-brand-cyan', 'text-brand-cyan', 'shadow-[0_0_15px_rgba(0,240,255,0.25)]');
          storyBtn.classList.remove('border-white/[0.1]', 'text-white/70');
        } else {
          if (eqBars) { eqBars.classList.add('hidden'); eqBars.classList.remove('flex'); }
          if (muteIcon) { muteIcon.classList.remove('hidden'); }
          if (storyLabel) { storyLabel.innerText = '[AUDIO: MOTIVATION OFF]'; }
          storyBtn.classList.remove('border-brand-cyan', 'text-brand-cyan', 'shadow-[0_0_15px_rgba(0,240,255,0.25)]');
          storyBtn.classList.add('border-white/[0.1]', 'text-white/70');
        }
      }

      // 2. index.html / portal.html Controls
      const indexBtn = document.getElementById('syndicate-audio-toggle');
      const indexLabel = document.getElementById('audio-toggle-text');

      if (indexBtn) {
        if (isPlaying) {
          indexBtn.classList.add('audio-active', 'border-brand-cyan/60', 'text-brand-cyan', 'shadow-[0_0_15px_rgba(0,240,255,0.25)]');
          indexBtn.classList.remove('border-brand-surfaceBorder', 'text-brand-muted');
          if (indexLabel) { indexLabel.innerText = '[AUDIO: MOTIVATION ON]'; }
          indexBtn.setAttribute('aria-pressed', 'true');
        } else {
          indexBtn.classList.remove('audio-active', 'border-brand-cyan/60', 'text-brand-cyan', 'shadow-[0_0_15px_rgba(0,240,255,0.25)]');
          indexBtn.classList.add('border-brand-surfaceBorder', 'text-brand-muted');
          if (indexLabel) { indexLabel.innerText = '[AUDIO: MOTIVATION OFF]'; }
          indexBtn.setAttribute('aria-pressed', 'false');
        }
      }
    }

    /**
     * Sleek terminal HUD notification toast
     */
    showToast(message) {
      let toast = document.getElementById('syndicate-audio-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'syndicate-audio-toast';
        toast.className = 'fixed bottom-5 right-5 z-50 pointer-events-none px-3.5 py-2 rounded-lg bg-brand-surfaceLight/95 border border-brand-cyan/40 text-brand-cyan font-mono text-xs shadow-[0_0_20px_rgba(0,240,255,0.25)] backdrop-blur-md transition-all duration-300 transform translate-y-3 opacity-0 flex items-center gap-2';
        document.body.appendChild(toast);
      }

      toast.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-ping"></span><span>${message}</span>`;
      toast.classList.remove('translate-y-3', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');

      clearTimeout(this.toastTimeout);
      this.toastTimeout = setTimeout(() => {
        if (toast) {
          toast.classList.add('translate-y-3', 'opacity-0');
          toast.classList.remove('translate-y-0', 'opacity-100');
        }
      }, 2400);
    }

    /**
     * ========================================================================
     * HIGH-END HAPTIC CLICK (Slider ticks, detents, knurled dial steps)
     * ========================================================================
     */
    playHapticClick({ pitch = 1.0, volume = 1.0 } = {}) {
      if (this.isMuted || !this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const t = this.ctx.currentTime;

      // Layer 1: High crisp micro-transient (Apple haptic feel)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      const startFreq = 2600 * pitch;
      osc.frequency.setValueAtTime(startFreq, t);
      osc.frequency.exponentialRampToValueAtTime(450 * pitch, t + 0.010);

      gain.gain.setValueAtTime(0.075 * volume, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.014);

      // Layer 2: Low-mid body resonance (190 Hz damped thud)
      const bodyOsc = this.ctx.createOscillator();
      const bodyGain = this.ctx.createGain();
      bodyOsc.type = 'sine';
      bodyOsc.frequency.setValueAtTime(190 * pitch, t);
      bodyGain.gain.setValueAtTime(0.05 * volume, t);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.014);

      bodyOsc.connect(bodyGain);
      bodyGain.connect(this.sfxGain);

      bodyOsc.start(t);
      bodyOsc.stop(t + 0.016);
    }

    /**
     * Slider specific tick handler with pitch modulation and throttling
     */
    playSliderTick(currentVal) {
      if (this.isMuted) return;

      const now = performance.now();
      if (now - this.lastSliderTickTime < 32) return;
      this.lastSliderTickTime = now;

      const ratio = Math.min(Math.max((currentVal - 1000) / 99000, 0), 1);
      const pitch = 0.88 + (ratio * 0.45);

      this.playHapticClick({ pitch, volume: 0.95 });
      this.lastSliderValue = currentVal;
    }

    /**
     * ========================================================================
     * MECHANICAL SWITCH SOUND (Buttons, tabs, modal triggers)
     * ========================================================================
     */
    playMechanicalSwitch({ pitch = 1.0, direction = 'down' } = {}) {
      if (this.isMuted || !this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const t = this.ctx.currentTime;

      // Layer 1: Sharp contact click
      const snapOsc = this.ctx.createOscillator();
      const snapGain = this.ctx.createGain();
      snapOsc.type = 'triangle';
      const snapFreq = (direction === 'down' ? 1800 : 2100) * pitch;
      snapOsc.frequency.setValueAtTime(snapFreq, t);
      snapOsc.frequency.exponentialRampToValueAtTime(320, t + 0.016);

      snapGain.gain.setValueAtTime(0.095, t);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);

      snapOsc.connect(snapGain);
      snapGain.connect(this.sfxGain);
      snapOsc.start(t);
      snapOsc.stop(t + 0.022);

      // Layer 2: CNC-milled relay sensation
      const latchOsc = this.ctx.createOscillator();
      const latchGain = this.ctx.createGain();
      latchOsc.type = 'sine';
      latchOsc.frequency.setValueAtTime(520 * pitch, t + 0.003);
      latchOsc.frequency.exponentialRampToValueAtTime(140, t + 0.038);

      latchGain.gain.setValueAtTime(0.0001, t);
      latchGain.gain.setValueAtTime(0.07, t + 0.003);
      latchGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);

      latchOsc.connect(latchGain);
      latchGain.connect(this.sfxGain);
      latchOsc.start(t + 0.003);
      latchOsc.stop(t + 0.05);
    }

    /**
     * ========================================================================
     * SCENE TRANSITION (Harmonized Aerodynamic Swoosh & Scene Progression)
     * ========================================================================
     */
    playSceneTransition(sceneIndex) {
      // If a valid scene index (0-3) is passed and music is playing, harmonize progression
      if (typeof sceneIndex === 'number' && this.isMusicPlaying && this.ctx) {
        const targetChord = sceneIndex % CHORD_PROGRESSION.length;
        if (targetChord !== this.currentChordIndex) {
          this.currentChordIndex = targetChord;
          this.chordStartTime = this.ctx.currentTime;
          this.triggerPadChord(this.currentChordIndex, this.ctx.currentTime);
        }
      }

      if (this.isMuted || !this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const t = this.ctx.currentTime;
      const pitchMod = (typeof sceneIndex === 'number' ? 1.0 + sceneIndex * 0.12 : 1.0);

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220 * pitchMod, t);
      osc.frequency.exponentialRampToValueAtTime(460 * pitchMod, t + 0.08);
      osc.frequency.exponentialRampToValueAtTime(130, t + 0.22);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280, t);
      filter.frequency.linearRampToValueAtTime(850 * pitchMod, t + 0.09);
      filter.frequency.linearRampToValueAtTime(180, t + 0.22);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.045, t + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.26);
    }

    /**
     * ========================================================================
     * PAYOUT CONFIRMATION TRIGGER (Crisp Metallic Chime + Sub-Bass Thud)
     * ========================================================================
     * With intelligent sidechain ducking of background music
     */
    playPayoutConfirmation() {
      if (!this.isInitialized) {
        this.init();
      }

      const wasMuted = this.isMuted;
      if (wasMuted) {
        this.isMuted = false;
        this.startMotivationMusic();
        this.updateToggleUI();
        this.showToast('ВЫПЛАТА ПОДТВЕРЖДЕНА • СИМУЛЯЦИЯ ЗВУКА [AUDIO ON]');
      }

      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const t = this.ctx.currentTime;

      // Gentle sidechain ducking of music to spotlight the transaction confirmation
      if (this.musicGain && this.isMusicPlaying) {
        this.musicGain.gain.cancelScheduledValues(t);
        this.musicGain.gain.setValueAtTime(this.musicMasterVolume, t);
        this.musicGain.gain.linearRampToValueAtTime(0.05, t + 0.05);
        this.musicGain.gain.exponentialRampToValueAtTime(this.musicMasterVolume, t + 2.2);
      }

      // ----------------------------------------------------------------------
      // PART A: SEISMIC SUB-BASS THUD (Deep institutional capital impact)
      // ----------------------------------------------------------------------
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(118, t);
      subOsc.frequency.exponentialRampToValueAtTime(42, t + 0.065);
      subOsc.frequency.setValueAtTime(39, t + 0.12);
      subOsc.frequency.linearRampToValueAtTime(30, t + 0.75);

      subGain.gain.setValueAtTime(0.001, t);
      subGain.gain.linearRampToValueAtTime(0.38, t + 0.008);
      subGain.gain.exponentialRampToValueAtTime(0.14, t + 0.16);
      subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.78);

      subOsc.connect(subGain);
      subGain.connect(this.sfxGain);
      subOsc.start(t);
      subOsc.stop(t + 0.80);

      // Sub Punch Mid-Bass Transient
      const punchOsc = this.ctx.createOscillator();
      const punchGain = this.ctx.createGain();
      punchOsc.type = 'triangle';
      punchOsc.frequency.setValueAtTime(190, t);
      punchOsc.frequency.exponentialRampToValueAtTime(58, t + 0.045);

      punchGain.gain.setValueAtTime(0.16, t);
      punchGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

      punchOsc.connect(punchGain);
      punchGain.connect(this.sfxGain);
      punchOsc.start(t);
      punchOsc.stop(t + 0.10);

      // ----------------------------------------------------------------------
      // PART B: CRISP METALLIC CHIME (Gold bullion / crystal chime resonance)
      // ----------------------------------------------------------------------
      const partials = [
        { freq: 1174.66, gain: 0.18, decay: 2.3 }, // D6 Fundamental
        { freq: 1760.00, gain: 0.14, decay: 1.8 }, // A6 Perfect 5th
        { freq: 2349.32, gain: 0.12, decay: 1.4 }, // D7 Octave
        { freq: 3135.96, gain: 0.08, decay: 1.1 }, // G7 Inharmonic overtone
        { freq: 4186.01, gain: 0.06, decay: 0.8 }, // C8 Crystal chime
        { freq: 5587.65, gain: 0.035, decay: 0.5 } // F8 Ultra-air sparkle
      ];

      partials.forEach((p, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(p.freq, t);
        const detuneCents = (idx % 2 === 0 ? 3.5 : -3.5) * (idx + 1);
        osc.detune.setValueAtTime(detuneCents, t);

        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(p.gain, t + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + p.decay + 0.05);
      });
    }
  }

  // Instantiate singleton & attach globally
  const syndicateAudio = new SoundEngine();
  window.SyndicateAudio = syndicateAudio;

  // Auto-init on page load or DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => syndicateAudio.init());
  } else {
    syndicateAudio.init();
  }

})(typeof window !== 'undefined' ? window : this);
