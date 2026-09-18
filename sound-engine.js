/**
 * ============================================================================
 * VIP LIQUIDITY SYNDICATE - PROCEDURAL WEB AUDIO API SOUND ENGINE
 * ============================================================================
 * Pure JavaScript, 100% offline, zero external audio asset dependencies.
 * 
 * Aesthetic: Institutional Bloomberg / Hedge-Fund / High-End Cybernetic Fintech
 * Features:
 * 1. Ambient Cinematic Drone / Lounge Frequency (Multi-oscillator, breathing LFO,
 *    analog warmth floor, binaural phasing, low volume, muted by default).
 * 2. High-End Haptic Click / Mechanical Switch (Precision tactile transient for
 *    sliders, rotary detents, and scene buttons).
 * 3. Crisp Metallic Chime / Sub-Bass Thud (Seismic sub impact paired with
 *    multi-partial shimmering crystal chime for payout / allocation confirmations).
 * 4. Header Luxury Audio Toggle ('[AUDIO: ON/OFF]' with animated equalizer).
 * ============================================================================
 */

(function(window) {
  'use strict';

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.isMuted = true; // Muted by default as specified
      this.isInitialized = false;

      // Master audio nodes
      this.masterGain = null;
      this.compressor = null;

      // Drone audio graph
      this.droneGain = null;
      this.droneNodes = [];
      this.isDronePlaying = false;

      // Slider throttling & state
      this.lastSliderTickTime = 0;
      this.lastSliderValue = 25000;

      // Noise buffer cache
      this.noiseBuffer = null;

      // Auto-bind methods
      this.toggle = this.toggle.bind(this);
      this.init = this.init.bind(this);
    }

    /**
     * Lazy-initialize the Web Audio Context upon first user interaction
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

        // 1. Master Dynamics Compressor (Gives high-end mastered limiter & prevents digital clipping)
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime); // dB
        this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);        // dB
        this.compressor.ratio.setValueAtTime(5, this.ctx.currentTime);        // 5:1 compression
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);   // 3ms attack
        this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);   // 250ms release

        // 2. Master Gain Node
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

        // Connect graph: masterGain -> compressor -> destination
        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);

        // Pre-generate procedural analog tape/air floor noise buffer (3 seconds mono loop)
        this.generateNoiseBuffer();

        // Initialize Ambient Drone Graph (starts in muted state)
        this.buildAmbientDroneGraph();

        this.isInitialized = true;
        this.updateToggleUI();

        // Check if browser suspended audio context
        if (this.ctx.state === 'suspended') {
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
        }
      } catch (err) {
        console.error('[SyndicateAudio] Initialization failed:', err);
      }
    }

    /**
     * Generate procedural warm analog floor noise
     */
    generateNoiseBuffer() {
      if (!this.ctx) return;
      const sampleRate = this.ctx.sampleRate;
      const bufferSize = sampleRate * 3; // 3 seconds
      const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;

      // Pink / brown filtered random walk for organic analog floor
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        data[i] = lastOut * 2.8;
      }
      this.noiseBuffer = buffer;
    }

    /**
     * Builds the procedural multi-oscillator cinematic drone & lounge frequency
     */
    buildAmbientDroneGraph() {
      if (!this.ctx) return;

      const t = this.ctx.currentTime;

      // Master gain for the ambient drone layer (very low volume as requested)
      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0.00001, t); // Starts muted

      // Main Drone Filter: Low-pass filter modulated by LFO
      const droneFilter = this.ctx.createBiquadFilter();
      droneFilter.type = 'lowpass';
      droneFilter.frequency.setValueAtTime(260, t);
      droneFilter.Q.setValueAtTime(1.8, t);

      // Layer 1: Sub-bass fundamental (A1 = 55 Hz / Warm Sine)
      const subOsc = this.ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(55.0, t);
      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.032, t);
      subOsc.connect(subGain);
      subGain.connect(droneFilter);
      subOsc.start(t);
      this.droneNodes.push(subOsc);

      // Layer 2: Warm 5th harmonic (82.5 Hz + slight detune +3 cents for binaural shimmer)
      const fifthOsc = this.ctx.createOscillator();
      fifthOsc.type = 'sine';
      fifthOsc.frequency.setValueAtTime(82.5, t);
      fifthOsc.detune.setValueAtTime(3.2, t);
      const fifthGain = this.ctx.createGain();
      fifthGain.gain.setValueAtTime(0.022, t);
      fifthOsc.connect(fifthGain);
      fifthGain.connect(droneFilter);
      fifthOsc.start(t);
      this.droneNodes.push(fifthOsc);

      // Layer 3: Warm Octave Triangle (110 Hz - slight detune -3 cents)
      const octOsc = this.ctx.createOscillator();
      octOsc.type = 'triangle';
      octOsc.frequency.setValueAtTime(110.0, t);
      octOsc.detune.setValueAtTime(-2.8, t);
      const octGain = this.ctx.createGain();
      octGain.gain.setValueAtTime(0.012, t);
      octOsc.connect(octGain);
      octGain.connect(droneFilter);
      octOsc.start(t);
      this.droneNodes.push(octOsc);

      // Layer 4: Analog Air / Tape Floor Texture
      if (this.noiseBuffer) {
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = this.noiseBuffer;
        noiseSource.loop = true;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(340, t);
        noiseFilter.Q.setValueAtTime(2.2, t);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.005, t);

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(droneFilter);

        noiseSource.start(t);
        this.droneNodes.push(noiseSource);
      }

      // Layer 5: Slow Breathing LFO (0.075 Hz = ~13.3 sec period)
      // Gently breathes the filter cutoff between 180Hz and 360Hz
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.075, t);

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(90, t); // +/- 90Hz sweep

      lfo.connect(lfoGain);
      lfoGain.connect(droneFilter.frequency);
      lfo.start(t);
      this.droneNodes.push(lfo);

      // Connect drone filter to drone master gain, then to engine master gain
      droneFilter.connect(this.droneGain);
      this.droneGain.connect(this.masterGain);
    }

    /**
     * Start/Fade in the ambient lounge drone
     */
    startAmbientDrone() {
      if (!this.ctx || !this.droneGain) return;
      const t = this.ctx.currentTime;
      this.droneGain.gain.cancelScheduledValues(t);
      this.droneGain.gain.setValueAtTime(Math.max(this.droneGain.gain.value, 0.00001), t);
      // Smooth luxury bloom (1.6s fade-in to ultra-low ambient volume 0.04)
      this.droneGain.gain.exponentialRampToValueAtTime(0.042, t + 1.6);
      this.isDronePlaying = true;
    }

    /**
     * Fade out the ambient lounge drone
     */
    stopAmbientDrone() {
      if (!this.ctx || !this.droneGain) return;
      const t = this.ctx.currentTime;
      this.droneGain.gain.cancelScheduledValues(t);
      this.droneGain.gain.setValueAtTime(Math.max(this.droneGain.gain.value, 0.00001), t);
      // Smooth fade-out in 0.8s
      this.droneGain.gain.exponentialRampToValueAtTime(0.00001, t + 0.8);
      this.isDronePlaying = false;
    }

    /**
     * Toggle audio on/off from the header '[AUDIO: ON/OFF]' button
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
        // Unmuting: start ambient drone + mechanical switch confirmation
        this.startAmbientDrone();
        this.playMechanicalSwitch({ pitch: 1.15, direction: 'up' });
        this.showToast('АУДИО ВКЛЮЧЕНО • 48kHz ПРОЦЕДУРНЫЙ СИНТЕЗАТОР');
      } else {
        // Muting: stop ambient drone
        this.stopAmbientDrone();
        this.playMechanicalSwitch({ pitch: 0.85, direction: 'down' });
        this.showToast('АУДИО ВЫКЛЮЧЕНО');
      }

      this.updateToggleUI();
      return !this.isMuted;
    }

    /**
     * Alias for toggleMute to support cinematic-story audio button
     * Returns true if muted, false if unmuted
     */
    toggleMute() {
      this.toggle();
      return this.isMuted;
    }

    /**
     * Update header button UI state
     */
    updateToggleUI() {
      const toggleBtn = document.getElementById('syndicate-audio-toggle');
      const toggleText = document.getElementById('audio-toggle-text');
      if (!toggleBtn || !toggleText) return;

      if (this.isMuted) {
        toggleBtn.classList.remove('audio-active', 'border-brand-cyan/60', 'text-brand-cyan', 'shadow-[0_0_15px_rgba(0,240,255,0.25)]');
        toggleBtn.classList.add('border-brand-surfaceBorder', 'text-brand-muted');
        toggleText.innerText = '[AUDIO: OFF]';
        toggleBtn.setAttribute('aria-pressed', 'false');
      } else {
        toggleBtn.classList.add('audio-active', 'border-brand-cyan/60', 'text-brand-cyan', 'shadow-[0_0_15px_rgba(0,240,255,0.25)]');
        toggleBtn.classList.remove('border-brand-surfaceBorder', 'text-brand-muted');
        toggleText.innerText = '[AUDIO: ON]';
        toggleBtn.setAttribute('aria-pressed', 'true');
      }
    }

    /**
     * Helper to show a sleek terminal toast notification
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
      }, 2200);
    }

    /**
     * ========================================================================
     * HIGH-END HAPTIC CLICK (Slider moves, detents, knurled dial ticks)
     * ========================================================================
     */
    playHapticClick({ pitch = 1.0, volume = 1.0 } = {}) {
      if (this.isMuted || !this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const t = this.ctx.currentTime;

      // Layer 1: High crisp micro-transient (Apple haptic / Swiss dial feel)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      const startFreq = 2600 * pitch;
      osc.frequency.setValueAtTime(startFreq, t);
      osc.frequency.exponentialRampToValueAtTime(450 * pitch, t + 0.010);

      gain.gain.setValueAtTime(0.075 * volume, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.014);

      // Layer 2: Subtle low-mid body thud (190 Hz damped resonance)
      const bodyOsc = this.ctx.createOscillator();
      const bodyGain = this.ctx.createGain();
      bodyOsc.type = 'sine';
      bodyOsc.frequency.setValueAtTime(190 * pitch, t);
      bodyGain.gain.setValueAtTime(0.05 * volume, t);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.014);

      bodyOsc.connect(bodyGain);
      bodyGain.connect(this.masterGain);

      bodyOsc.start(t);
      bodyOsc.stop(t + 0.016);
    }

    /**
     * Slider specific tick handler with pitch modulation and throttling
     */
    playSliderTick(currentVal) {
      if (this.isMuted) return;

      const now = performance.now();
      // Throttle to 32ms so dragging fast produces a smooth mechanical purr
      if (now - this.lastSliderTickTime < 32) return;
      this.lastSliderTickTime = now;

      // Pitch slightly rises as limit reaches SVIP levels ($1,000 -> $100,000)
      const ratio = Math.min(Math.max((currentVal - 1000) / 99000, 0), 1);
      const pitch = 0.88 + (ratio * 0.45); // 0.88x to 1.33x

      this.playHapticClick({ pitch, volume: 0.95 });
      this.lastSliderValue = currentVal;
    }

    /**
     * ========================================================================
     * MECHANICAL SWITCH SOUND (Buttons, tabs, modal open/close)
     * ========================================================================
     */
    playMechanicalSwitch({ pitch = 1.0, direction = 'down' } = {}) {
      if (this.isMuted || !this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const t = this.ctx.currentTime;

      // Layer 1: Sharp contact click (snap)
      const snapOsc = this.ctx.createOscillator();
      const snapGain = this.ctx.createGain();
      snapOsc.type = 'triangle';
      const snapFreq = (direction === 'down' ? 1800 : 2100) * pitch;
      snapOsc.frequency.setValueAtTime(snapFreq, t);
      snapOsc.frequency.exponentialRampToValueAtTime(320, t + 0.016);

      snapGain.gain.setValueAtTime(0.095, t);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);

      snapOsc.connect(snapGain);
      snapGain.connect(this.masterGain);
      snapOsc.start(t);
      snapOsc.stop(t + 0.022);

      // Layer 2: Resonant switch body latch (CNC-milled relay sensation)
      const latchOsc = this.ctx.createOscillator();
      const latchGain = this.ctx.createGain();
      latchOsc.type = 'sine';
      latchOsc.frequency.setValueAtTime(520 * pitch, t + 0.003);
      latchOsc.frequency.exponentialRampToValueAtTime(140, t + 0.038);

      latchGain.gain.setValueAtTime(0.0001, t);
      latchGain.gain.setValueAtTime(0.07, t + 0.003);
      latchGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);

      latchOsc.connect(latchGain);
      latchGain.connect(this.masterGain);
      latchOsc.start(t + 0.003);
      latchOsc.stop(t + 0.05);
    }

    /**
     * ========================================================================
     * SCENE TRANSITION (Smooth aerodynamic swoosh / zone navigation)
     * ========================================================================
     */
    playSceneTransition() {
      if (this.isMuted || !this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const t = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(460, t + 0.08);
      osc.frequency.exponentialRampToValueAtTime(130, t + 0.22);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280, t);
      filter.frequency.linearRampToValueAtTime(850, t + 0.09);
      filter.frequency.linearRampToValueAtTime(180, t + 0.22);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.045, t + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.26);
    }

    /**
     * ========================================================================
     * PAYOUT CONFIRMATION TRIGGER (Crisp Metallic Chime + Sub-Bass Thud)
     * ========================================================================
     * Designed for high-roller wire confirmations:
     * - Seismic Sub-Bass Thud (38Hz weight that anchors the transaction)
     * - Multi-Harmonic Crystal Bell Chime (D6/A6/D7/G7/C8 physical model)
     */
    playPayoutConfirmation() {
      // Auto-initialize if user clicked trigger while uninitialized
      if (!this.isInitialized) {
        this.init();
      }

      // If audio is muted, give them a momentary unlock experience with notification
      const wasMuted = this.isMuted;
      if (wasMuted) {
        this.isMuted = false;
        this.startAmbientDrone();
        this.updateToggleUI();
        this.showToast('ВЫПЛАТА ПОДТВЕРЖДЕНА • СИМУЛЯЦИЯ ЗВУКА [AUDIO ON]');
      }

      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const t = this.ctx.currentTime;

      // ----------------------------------------------------------------------
      // PART A: SUB-BASS THUD (Deep institutional capital impact)
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
      subGain.connect(this.masterGain);
      subOsc.start(t);
      subOsc.stop(t + 0.80);

      // Sub Punch Mid-Bass Transient (Ensures impact is felt on mobile/laptop speakers)
      const punchOsc = this.ctx.createOscillator();
      const punchGain = this.ctx.createGain();
      punchOsc.type = 'triangle';
      punchOsc.frequency.setValueAtTime(190, t);
      punchOsc.frequency.exponentialRampToValueAtTime(58, t + 0.045);

      punchGain.gain.setValueAtTime(0.16, t);
      punchGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

      punchOsc.connect(punchGain);
      punchGain.connect(this.masterGain);
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
        // Stereo shimmer detuning
        const detuneCents = (idx % 2 === 0 ? 3.5 : -3.5) * (idx + 1);
        osc.detune.setValueAtTime(detuneCents, t);

        // Immediate crisp strike + exponential metallic sustain
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(p.gain, t + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + p.decay + 0.05);
      });
    }
  }

  // Instantiate singleton and attach to window
  const syndicateAudio = new SoundEngine();
  window.SyndicateAudio = syndicateAudio;

  // Auto-init on page load or DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => syndicateAudio.init());
  } else {
    syndicateAudio.init();
  }

})(typeof window !== 'undefined' ? window : this);
