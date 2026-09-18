/**
 * ============================================================================
 * VIDEO SCRUB ENGINE (60 FPS Production Class)
 * ============================================================================
 * High-performance, hardware-accelerated video scroll-scrubbing engine in JavaScript.
 * 
 * Key Features:
 * - 60 FPS requestAnimationFrame with Damped Exponential Lerp Loop (lerpFactor = 0.08).
 * - Multi-scene architecture: Seamlessly cross-fades between 4+ video clips OR
 *   scrubs through a single master concatenated timeline with scene checkpoints.
 * - Safari iOS & Mobile Touch Protection:
 *   * Passive touchmove / scroll / touchstart listeners for zero main-thread jank.
 *   * Anti-freeze decoder queue: avoids setting `video.currentTime` while `video.seeking` is true.
 *   * Frame interpolation fallback when decoder is saturated/seeking rapidly.
 *   * Clamped iOS rubber-band overscroll protection.
 *   * Automatic touch/gesture hardware decoder warmup for WebKit.
 * - Zero external dependencies, pure ES6 class with UMD/window fallback.
 * 
 * @author Senior Core Web Performance & Motion Engineer
 * @version 1.0.0
 * ============================================================================
 */

export class VideoScrubEngine {
  /**
   * Default configuration options.
   */
  static DEFAULTS = {
    // Mode: 'auto' | 'multi' | 'master'
    mode: 'auto',

    // Physics & Timing
    lerpFactor: 0.08,           // Damping factor (0.05 = heavier inertia, 0.15 = snappier)
    threshold: 0.0001,          // Progress delta threshold below which RAF rests
    velocityFastSeekThreshold: 0.15, // Progress change/sec to activate browser fastSeek()
    enableFastSeek: true,       // Use video.fastSeek() when scrubbing rapidly if supported

    // Multi-Scene Crossfade Options
    crossfadeWindow: 0.06,      // Fraction of scroll depth where adjacent clips blend (6%)
    scenes: null,               // Custom scene definitions (weights or time ranges)

    // Safari iOS / Mobile Protections
    preventIOSFreeze: true,     // Queue seeks when video.seeking is true
    autoWarmupIOS: true,        // Touchstart/pointerdown media pipeline warmup
    touchFriction: 1.0,         // Optional touch responsiveness multiplier

    // Frame Interpolation & Fallback
    canvas: null,               // Optional HTMLCanvasElement for hardware frame blending
    enableCanvasInterpolation: false, // Draw smooth intermediate frames to canvas

    // Event Callbacks
    onProgress: null,           // ({ progress, targetProgress, activeSceneIndex, sceneProgress, ... }) => {}
    onSceneChange: null,        // ({ currentIndex, previousIndex, scene }) => {}
    onInterpolate: null,        // ({ channel, virtualTime, pendingSeek }) => {}
    onReady: null,              // ({ engine, mode, sceneCount, totalDuration }) => {}
    onSeekStart: null,          // ({ index, time }) => {}
    onSeekEnd: null             // ({ index, time }) => {}
  };

  /**
   * Instantiate VideoScrubEngine.
   * @param {Object} options Configuration parameters.
   * @param {HTMLElement|string} options.container Outer scroll track / section element.
   * @param {Array<HTMLElement|string>|HTMLElement|string} [options.videos] Video element(s) for multi-clip mode.
   * @param {HTMLElement|string} [options.video] Single master video element.
   */
  constructor(options = {}) {
    this.options = Object.assign({}, VideoScrubEngine.DEFAULTS, options);

    // Resolve Container
    this.container = typeof this.options.container === 'string'
      ? document.querySelector(this.options.container)
      : this.options.container;

    if (!this.container && typeof window !== 'undefined') {
      console.warn('[VideoScrubEngine] Container not found or not provided. Defaulting to document.documentElement');
      this.container = document.documentElement;
    }

    // Determine Mode ('multi' or 'master')
    this.mode = this._resolveMode(options);

    // Core Physics State
    this.lerpFactor = Math.max(0.01, Math.min(1, this.options.lerpFactor));
    this.threshold = this.options.threshold;
    this.targetProgress = 0;    // Desired scroll progress [0..1]
    this.currentProgress = 0;   // Damped interpolated progress [0..1]
    this.lastProgress = 0;      // Previous frame progress for velocity calculation
    this.velocity = 0;          // Instantaneous progress delta per second
    this.isLerping = false;     // True when currentProgress is actively moving to target
    this.isDestroyed = false;
    this.isPaused = false;
    this.isReady = false;

    // Time Tracking for accurate delta time
    this.lastFrameTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    // Scene & Channel Management
    this.channels = [];         // Array of VideoChannel wrappers
    this.activeSceneIndex = 0;
    this.previousSceneIndex = -1;
    this.sceneRanges = [];      // [{ start: 0, end: 0.25, id, label, duration, ... }]
    this.totalDuration = 0;

    // Canvas fallback
    this.canvas = null;
    this.ctx = null;
    if (this.options.canvas) {
      this.canvas = typeof this.options.canvas === 'string'
        ? document.querySelector(this.options.canvas)
        : this.options.canvas;
      if (this.canvas && this.canvas.getContext) {
        this.ctx = this.canvas.getContext('2d');
      }
    }

    // Event listener storage for clean teardown
    this._listeners = new Map();
    this._domHandlers = {
      scroll: this._onScroll.bind(this),
      touchMove: this._onTouchMove.bind(this),
      touchStart: this._onTouchStart.bind(this),
      touchEnd: this._onTouchEnd.bind(this),
      resize: this._onResize.bind(this),
      visibility: this._onVisibilityChange.bind(this)
    };

    // Cache container geometry to prevent layout thrashing
    this.cachedRect = { top: 0, height: 0, scrollable: 1 };

    // Initialize Channels & DOM
    this._setupVideoChannels();
    this._setupSceneRanges();
    this._bindEvents();

    // Start 60 FPS RAF Loop
    this.rafId = requestAnimationFrame(this._tick.bind(this));
  }

  // ==========================================================================
  // INITIALIZATION & CONFIGURATION
  // ==========================================================================

  /**
   * Determine engine mode based on options.
   * @private
   */
  _resolveMode(opts) {
    if (opts.mode && opts.mode !== 'auto') {
      return opts.mode;
    }
    if (Array.isArray(opts.videos) && opts.videos.length > 1) {
      return 'multi';
    }
    if (opts.video || (Array.isArray(opts.videos) && opts.videos.length === 1)) {
      return 'master';
    }
    return 'multi';
  }

  /**
   * Query and wrap video elements with Safari/Mobile protective wrappers.
   * @private
   */
  _setupVideoChannels() {
    let rawElements = [];

    if (this.mode === 'multi') {
      const vList = this.options.videos || [];
      rawElements = (Array.isArray(vList) ? vList : [vList]).map(item => {
        return typeof item === 'string' ? document.querySelector(item) : item;
      }).filter(Boolean);
    } else {
      // Master timeline mode
      const v = this.options.video || (Array.isArray(this.options.videos) ? this.options.videos[0] : null);
      const el = typeof v === 'string' ? document.querySelector(v) : v;
      if (el) rawElements = [el];
    }

    if (rawElements.length === 0) {
      console.warn('[VideoScrubEngine] No valid video elements provided. Engine will run in simulation mode.');
    }

    // Wrap each video element into a VideoChannel
    this.channels = rawElements.map((videoEl, index) => {
      return this._createChannel(videoEl, index);
    });
  }

  /**
   * Creates a managed VideoChannel with Safari anti-freeze queue & touch protection.
   * @private
   */
  _createChannel(videoEl, index) {
    // Apply Safari & Mobile required video attributes
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');
    videoEl.muted = true;
    videoEl.defaultMuted = true;
    videoEl.autoplay = false;
    videoEl.preload = 'auto';

    // GPU-accelerated styling for instant compositing
    videoEl.style.position = 'absolute';
    videoEl.style.top = '0';
    videoEl.style.left = '0';
    videoEl.style.width = '100%';
    videoEl.style.height = '100%';
    videoEl.style.objectFit = videoEl.style.objectFit || 'cover';
    videoEl.style.transform = 'translate3d(0, 0, 0)';
    videoEl.style.backfaceVisibility = 'hidden';
    videoEl.style.willChange = 'opacity';
    videoEl.style.pointerEvents = 'none';

    // Initial opacity state
    if (this.mode === 'multi') {
      videoEl.style.opacity = index === 0 ? '1' : '0';
      videoEl.style.visibility = index === 0 ? 'visible' : 'hidden';
    } else {
      videoEl.style.opacity = '1';
      videoEl.style.visibility = 'visible';
    }

    const channel = {
      index,
      video: videoEl,
      duration: videoEl.duration || 0,
      isReady: !isNaN(videoEl.duration) && videoEl.duration > 0,
      isSeeking: false,
      pendingSeekTime: null,      // Queue for rapid seeks during decoder busy state
      lastSeekTime: 0,
      lastRenderedTime: 0,
      targetTime: 0,
      opacity: index === 0 ? 1 : 0,
      isInterpolating: false,     // Fallback flag when decoder is lagging
      readyPromise: null,

      // Handler references for removal
      onLoadedMetadata: null,
      onSeeked: null,
      onSeeking: null,
      onError: null
    };

    // Event: loadedmetadata
    channel.onLoadedMetadata = () => {
      channel.duration = channel.video.duration;
      channel.isReady = true;
      this._checkOverallReady();
    };

    // Event: seeking
    channel.onSeeking = () => {
      channel.isSeeking = true;
      this._emit('seekstart', { index: channel.index, time: channel.video.currentTime });
    };

    // Event: seeked (Core Safari freeze protection dequeue)
    channel.onSeeked = () => {
      channel.isSeeking = false;
      channel.lastRenderedTime = channel.video.currentTime;
      this._emit('seekend', { index: channel.index, time: channel.video.currentTime });

      // If a pending seek was queued while the hardware decoder was busy, execute it NOW!
      if (channel.pendingSeekTime !== null) {
        const nextTime = channel.pendingSeekTime;
        channel.pendingSeekTime = null;

        // Skip microscopic changes to avoid infinite seek loop
        if (Math.abs(nextTime - channel.lastRenderedTime) > 0.003) {
          this._dispatchSeek(channel, nextTime);
        } else {
          channel.isInterpolating = false;
        }
      } else {
        channel.isInterpolating = false;
      }
    };

    // Event: error handling
    channel.onError = (e) => {
      console.error(`[VideoScrubEngine] Video Channel ${index} error:`, channel.video.error || e);
    };

    videoEl.addEventListener('loadedmetadata', channel.onLoadedMetadata, { passive: true });
    videoEl.addEventListener('seeking', channel.onSeeking, { passive: true });
    videoEl.addEventListener('seeked', channel.onSeeked, { passive: true });
    videoEl.addEventListener('error', channel.onError, { passive: true });

    // Ensure video is paused and preloaded
    try {
      videoEl.pause();
      videoEl.load();
    } catch (err) {
      // Ignored
    }

    return channel;
  }

  /**
   * Calculate scene ranges and timeline segment boundaries.
   * @private
   */
  _setupSceneRanges() {
    this.sceneRanges = [];

    if (this.mode === 'multi') {
      const count = Math.max(1, this.channels.length);
      const userScenes = this.options.scenes;

      if (Array.isArray(userScenes) && userScenes.length === count) {
        // Compute ranges based on custom weights or percentages
        let totalWeight = 0;
        userScenes.forEach(s => totalWeight += (s.weight || 1));

        let currentAcc = 0;
        this.sceneRanges = userScenes.map((s, idx) => {
          const weight = s.weight || 1;
          const share = weight / totalWeight;
          const range = {
            index: idx,
            id: s.id || `scene-${idx + 1}`,
            label: s.label || `Scene ${idx + 1}`,
            start: currentAcc,
            end: currentAcc + share,
            duration: share
          };
          currentAcc += share;
          return range;
        });
      } else {
        // Equal distribution across clips
        const segmentSize = 1 / count;
        for (let i = 0; i < count; i++) {
          this.sceneRanges.push({
            index: i,
            id: `scene-${i + 1}`,
            label: `Scene ${i + 1}`,
            start: i * segmentSize,
            end: (i + 1) * segmentSize,
            duration: segmentSize
          });
        }
      }
    } else {
      // Master timeline mode
      const userScenes = this.options.scenes;
      if (Array.isArray(userScenes) && userScenes.length > 0) {
        this.sceneRanges = userScenes.map((s, idx) => ({
          index: idx,
          id: s.id || `scene-${idx + 1}`,
          label: s.label || `Scene ${idx + 1}`,
          start: s.start || 0,
          end: s.end || 0,
          startProgress: s.startProgress ?? null,
          endProgress: s.endProgress ?? null
        }));
      } else {
        // Default 4 virtual scenes across master timeline
        for (let i = 0; i < 4; i++) {
          this.sceneRanges.push({
            index: i,
            id: `scene-${i + 1}`,
            label: `Scene ${i + 1}`,
            startProgress: i * 0.25,
            endProgress: (i + 1) * 0.25
          });
        }
      }
    }
  }

  /**
   * Check if all channels are loaded and trigger onReady.
   * @private
   */
  _checkOverallReady() {
    const allReady = this.channels.length > 0 && this.channels.every(ch => ch.isReady);
    if (allReady && !this.isReady) {
      this.isReady = true;
      this.totalDuration = this.channels.reduce((acc, ch) => acc + ch.duration, 0);

      // In master mode, if user scenes had timecodes, normalize them
      if (this.mode === 'master' && this.channels[0]) {
        const masterDur = this.channels[0].duration;
        this.sceneRanges.forEach(scene => {
          if (scene.startProgress === null && scene.end !== undefined) {
            scene.startProgress = masterDur > 0 ? (scene.start / masterDur) : 0;
            scene.endProgress = masterDur > 0 ? (scene.end / masterDur) : 1;
          }
        });
      }

      this._updateContainerBounds();
      this._updateTargetFromScroll();

      if (typeof this.options.onReady === 'function') {
        this.options.onReady({
          engine: this,
          mode: this.mode,
          sceneCount: this.sceneRanges.length,
          totalDuration: this.totalDuration
        });
      }
      this._emit('ready', { mode: this.mode, sceneCount: this.sceneRanges.length });
    }
  }

  // ==========================================================================
  // EVENT BINDINGS (SAFARI & TOUCH PASSIVE OPTIMIZED)
  // ==========================================================================

  /**
   * Bind event listeners with high-performance passive configurations.
   * @private
   */
  _bindEvents() {
    if (typeof window === 'undefined') return;

    const passiveOpts = { passive: true };

    window.addEventListener('scroll', this._domHandlers.scroll, passiveOpts);
    window.addEventListener('touchmove', this._domHandlers.touchMove, passiveOpts);
    window.addEventListener('touchstart', this._domHandlers.touchStart, passiveOpts);
    window.addEventListener('touchend', this._domHandlers.touchEnd, passiveOpts);
    window.addEventListener('resize', this._domHandlers.resize, passiveOpts);
    document.addEventListener('visibilitychange', this._domHandlers.visibility, passiveOpts);

    // Initial bounding box calculation
    this._updateContainerBounds();
    this._updateTargetFromScroll();
  }

  /**
   * Warm up iOS WebKit hardware decoder on first touch/interaction.
   * Safari requires user gesture interaction to decode HTML5 video smoothly without restrictions.
   * @private
   */
  _onTouchStart(e) {
    if (this.options.autoWarmupIOS && !this._warmedUp) {
      this._warmupDecoder();
    }
  }

  /**
   * Hardware decoder warmup mechanism.
   * Plays muted video for 1 frame and immediately pauses.
   * @private
   */
  _warmupDecoder() {
    this._warmedUp = true;
    this.channels.forEach(ch => {
      if (ch.video && ch.video.paused) {
        const playPromise = ch.video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              ch.video.pause();
            })
            .catch(() => {
              // Browser policy fallback
            });
        }
      }
    });
  }

  /**
   * Passive touchmove listener.
   * @private
   */
  _onTouchMove(e) {
    // Recalculate target progress instantly without blocking mobile touch compositor thread
    this._updateTargetFromScroll();
  }

  /**
   * Passive touchend listener.
   * @private
   */
  _onTouchEnd() {
    this._updateTargetFromScroll();
  }

  /**
   * Passive scroll handler.
   * @private
   */
  _onScroll() {
    this._updateTargetFromScroll();
  }

  /**
   * Window resize handler: recalculates bounds avoiding continuous layout thrashing.
   * @private
   */
  _onResize() {
    this._updateContainerBounds();
    this._updateTargetFromScroll();
  }

  /**
   * Visibility change handler to pause RAF when tab is in background.
   * @private
   */
  _onVisibilityChange() {
    if (document.hidden) {
      this.isPaused = true;
    } else {
      this.isPaused = false;
      this.lastFrameTime = performance.now();
      this._updateContainerBounds();
      this._updateTargetFromScroll();
    }
  }

  /**
   * Cache container dimensions.
   * @private
   */
  _updateContainerBounds() {
    if (!this.container || typeof window === 'undefined') return;

    if (this.container === document.documentElement || this.container === document.body) {
      const docH = document.documentElement.scrollHeight || document.body.scrollHeight;
      const winH = window.innerHeight || 1;
      this.cachedRect = {
        top: 0,
        height: docH,
        scrollable: Math.max(1, docH - winH),
        isRoot: true
      };
    } else {
      const rect = this.container.getBoundingClientRect();
      const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      const absTop = rect.top + scrollY;
      const winH = window.innerHeight || 1;
      const scrollable = Math.max(1, rect.height - winH);

      this.cachedRect = {
        absTop,
        height: rect.height,
        scrollable,
        isRoot: false
      };
    }
  }

  /**
   * Compute normalized target progress [0.0 .. 1.0] with Safari bounce clamping.
   * @private
   */
  _updateTargetFromScroll() {
    if (this.isDestroyed || typeof window === 'undefined') return;

    let rawProgress = 0;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

    if (this.cachedRect.isRoot) {
      rawProgress = scrollY / this.cachedRect.scrollable;
    } else {
      const relativeY = scrollY - this.cachedRect.absTop;
      rawProgress = relativeY / this.cachedRect.scrollable;
    }

    // CLAMPING: Prevents iOS Safari rubber-band negative or > 1.0 scroll values
    this.targetProgress = Math.max(0, Math.min(1, rawProgress));
  }

  // ==========================================================================
  // CORE 60 FPS DAMPED LERP RENDER LOOP
  // ==========================================================================

  /**
   * Main requestAnimationFrame tick executing the Damped Lerp Loop.
   * @private
   * @param {DOMHighResTimeStamp} timestamp Current frame timestamp.
   */
  _tick(timestamp) {
    if (this.isDestroyed) return;

    // Delta Time Calculation
    const now = timestamp || (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const dt = Math.min(0.1, (now - this.lastFrameTime) / 1000); // Clamped to 100ms max to prevent jump on tab focus
    this.lastFrameTime = now;

    if (!this.isPaused) {
      // Damped Lerp Math:
      // currentProgress += (targetProgress - currentProgress) * lerpFactor
      const diff = this.targetProgress - this.currentProgress;

      if (Math.abs(diff) > this.threshold) {
        this.currentProgress += diff * this.lerpFactor;
        this.isLerping = true;
      } else {
        this.currentProgress = this.targetProgress;
        this.isLerping = false;
      }

      // Instantaneous Velocity (progress units per second)
      this.velocity = dt > 0 ? Math.abs(this.currentProgress - this.lastProgress) / dt : 0;
      this.lastProgress = this.currentProgress;

      // Dispatch scrubbing update to media channels
      this._renderScrubFrame(this.currentProgress, this.velocity);
    }

    this.rafId = requestAnimationFrame(this._tick.bind(this));
  }

  /**
   * Scrub frame dispatcher based on active mode.
   * @private
   */
  _renderScrubFrame(progress, velocity) {
    if (this.channels.length === 0) {
      // Simulation mode without video tags
      this._notifyProgress(progress, velocity, null);
      return;
    }

    if (this.mode === 'multi') {
      this._renderMultiClipFrame(progress, velocity);
    } else {
      this._renderMasterTimelineFrame(progress, velocity);
    }
  }

  // ==========================================================================
  // MULTI-SCENE CLIP CROSS-FADING LOGIC (4+ CLIPS)
  // ==========================================================================

  /**
   * Handles 4-clip crossfading, pre-buffering, and seamless seek dispatch.
   * @private
   */
  _renderMultiClipFrame(progress, velocity) {
    const numScenes = this.sceneRanges.length;
    const halfWindow = this.options.crossfadeWindow / 2;

    // 1. Identify primary scene
    let primaryIndex = 0;
    for (let i = 0; i < numScenes; i++) {
      const scene = this.sceneRanges[i];
      if (progress >= scene.start && progress <= scene.end) {
        primaryIndex = i;
        break;
      }
      if (i === numScenes - 1 && progress > scene.end) {
        primaryIndex = numScenes - 1;
      }
    }

    // Check for scene transition event
    if (primaryIndex !== this.activeSceneIndex) {
      this.previousSceneIndex = this.activeSceneIndex;
      this.activeSceneIndex = primaryIndex;
      this._notifySceneChange(this.activeSceneIndex, this.previousSceneIndex);
    }

    // 2. Compute opacity and target time for each channel
    const useFast = this.options.enableFastSeek && (velocity > this.options.velocityFastSeekThreshold);

    for (let i = 0; i < this.channels.length; i++) {
      const channel = this.channels[i];
      const scene = this.sceneRanges[i];
      if (!channel || !scene) continue;

      let opacity = 0;
      const isCurrent = (i === primaryIndex);
      const isPrevious = (i === primaryIndex - 1);
      const isNext = (i === primaryIndex + 1);

      // Calculate local progress [0..1] within this clip's scene range
      const localProgress = Math.max(0, Math.min(1, (progress - scene.start) / scene.duration));
      const targetTime = channel.duration > 0 ? localProgress * channel.duration : 0;
      channel.targetTime = targetTime;

      // Crossfade Calculation with smoothstep easing
      if (isCurrent) {
        opacity = 1;

        // Check crossfade with PREVIOUS clip near start boundary
        if (isPrevious !== undefined && i > 0 && progress < (scene.start + halfWindow)) {
          const t = Math.max(0, Math.min(1, (progress - (scene.start - halfWindow)) / this.options.crossfadeWindow));
          opacity = this._smoothstep(t);
        }
        // Check crossfade with NEXT clip near end boundary
        else if (i < numScenes - 1 && progress > (scene.end - halfWindow)) {
          const t = Math.max(0, Math.min(1, (progress - (scene.end - halfWindow)) / this.options.crossfadeWindow));
          opacity = 1 - this._smoothstep(t);
        }
      } else if (isNext && progress > (scene.start - halfWindow)) {
        // Next clip fading in
        const t = Math.max(0, Math.min(1, (progress - (scene.start - halfWindow)) / this.options.crossfadeWindow));
        opacity = this._smoothstep(t);
      } else if (isPrevious && progress < (scene.end + halfWindow)) {
        // Previous clip fading out
        const t = Math.max(0, Math.min(1, (progress - (scene.end - halfWindow)) / this.options.crossfadeWindow));
        opacity = 1 - this._smoothstep(t);
      } else {
        opacity = 0;
      }

      // Apply Opacity & Hardware Visibility
      channel.opacity = opacity;
      channel.video.style.opacity = opacity.toFixed(4);

      if (opacity > 0.001) {
        channel.video.style.visibility = 'visible';
        // Dispatch seek only if clip is active or in crossfade transition
        this._dispatchSeek(channel, targetTime, useFast);
      } else {
        // Distant clip: hide to save GPU fill-rate on mobile
        channel.video.style.visibility = 'hidden';

        // Preload next clip's first frame when approaching within 2x crossfade window
        if (isNext && progress > (scene.start - this.options.crossfadeWindow * 2)) {
          this._dispatchSeek(channel, 0, true);
        }
      }
    }

    // Canvas Frame Interpolation Fallback (if enabled)
    if (this.ctx && this.options.enableCanvasInterpolation) {
      this._renderCanvasFallback(primaryIndex);
    }

    // Progress Notification
    const activeCh = this.channels[primaryIndex];
    const activeScene = this.sceneRanges[primaryIndex];
    const activeSceneProgress = activeScene
      ? Math.max(0, Math.min(1, (progress - activeScene.start) / activeScene.duration))
      : 0;

    this._notifyProgress(progress, velocity, {
      activeIndex: primaryIndex,
      activeScene,
      sceneProgress: activeSceneProgress,
      currentTime: activeCh ? activeCh.video.currentTime : 0,
      targetTime: activeCh ? activeCh.targetTime : 0,
      isSeeking: activeCh ? activeCh.isSeeking : false,
      isInterpolating: activeCh ? activeCh.isInterpolating : false
    });
  }

  // ==========================================================================
  // SINGLE MASTER TIMELINE SCRUBBING LOGIC
  // ==========================================================================

  /**
   * Handles scrubbing through a single master concatenated timeline.
   * @private
   */
  _renderMasterTimelineFrame(progress, velocity) {
    const channel = this.channels[0];
    if (!channel || !channel.isReady || channel.duration <= 0) {
      this._notifyProgress(progress, velocity, null);
      return;
    }

    const targetTime = progress * channel.duration;
    channel.targetTime = targetTime;

    const useFast = this.options.enableFastSeek && (velocity > this.options.velocityFastSeekThreshold);
    this._dispatchSeek(channel, targetTime, useFast);

    // Identify active virtual scene checkpoint
    let activeIndex = 0;
    for (let i = 0; i < this.sceneRanges.length; i++) {
      const sc = this.sceneRanges[i];
      if (progress >= sc.startProgress && progress <= sc.endProgress) {
        activeIndex = i;
        break;
      }
      if (i === this.sceneRanges.length - 1 && progress > sc.endProgress) {
        activeIndex = i;
      }
    }

    if (activeIndex !== this.activeSceneIndex) {
      this.previousSceneIndex = this.activeSceneIndex;
      this.activeSceneIndex = activeIndex;
      this._notifySceneChange(this.activeSceneIndex, this.previousSceneIndex);
    }

    const currentScene = this.sceneRanges[activeIndex];
    const sceneProgress = currentScene && (currentScene.endProgress - currentScene.startProgress > 0)
      ? Math.max(0, Math.min(1, (progress - currentScene.startProgress) / (currentScene.endProgress - currentScene.startProgress)))
      : 0;

    if (this.ctx && this.options.enableCanvasInterpolation) {
      this._renderCanvasFallback(0);
    }

    this._notifyProgress(progress, velocity, {
      activeIndex,
      activeScene: currentScene,
      sceneProgress,
      currentTime: channel.video.currentTime,
      targetTime,
      isSeeking: channel.isSeeking,
      isInterpolating: channel.isInterpolating
    });
  }

  // ==========================================================================
  // SAFARI IOS ANTI-FREEZE & FRAME INTERPOLATION DISPATCHER
  // ==========================================================================

  /**
   * Safely dispatch seek with Safari iOS anti-freeze queue.
   * Never sets `currentTime` while `video.seeking === true`.
   * @private
   */
  _dispatchSeek(channel, targetTime, useFast = false) {
    if (!channel.isReady || channel.duration <= 0) return;

    // Clamp within valid video timeline (stay 0.02s before end to prevent EOS freeze)
    const clampedTime = Math.max(0, Math.min(channel.duration - 0.02, targetTime));

    // SAFARI IOS FREEZE PREVENTION:
    // If the WebKit media decoder is already seeking, DO NOT overwrite currentTime!
    if (this.options.preventIOSFreeze && (channel.video.seeking || channel.isSeeking)) {
      channel.pendingSeekTime = clampedTime;
      channel.isInterpolating = true;

      // Notify consumer that decoder is busy and virtual frame interpolation is running
      if (typeof this.options.onInterpolate === 'function') {
        this.options.onInterpolate({
          channelIndex: channel.index,
          virtualTime: clampedTime,
          lastRenderedTime: channel.lastRenderedTime,
          pendingSeek: clampedTime
        });
      }
      return;
    }

    // Execute Immediate Seek
    this._executeSeek(channel, clampedTime, useFast);
  }

  /**
   * Internal seek execution using fastSeek (if available) or sample-accurate currentTime.
   * @private
   */
  _executeSeek(channel, time, useFast) {
    channel.isSeeking = true;
    channel.lastSeekTime = time;

    // Use fastSeek on supported platforms (Safari/Firefox) during high velocity
    if (useFast && typeof channel.video.fastSeek === 'function') {
      try {
        channel.video.fastSeek(time);
      } catch (err) {
        channel.video.currentTime = time;
      }
    } else {
      channel.video.currentTime = time;
    }
  }

  /**
   * Canvas frame interpolation fallback.
   * Smoothly draws the video frame to a canvas, preventing blank frames during seek jumps.
   * @private
   */
  _renderCanvasFallback(channelIndex) {
    const ch = this.channels[channelIndex];
    if (!ch || !ch.video || !this.ctx || !this.canvas) return;

    try {
      if (ch.video.readyState >= 2) { // HAVE_CURRENT_DATA
        this.ctx.drawImage(ch.video, 0, 0, this.canvas.width, this.canvas.height);
      }
    } catch (e) {
      // Ignored if canvas tainted
    }
  }

  // ==========================================================================
  // UTILITY & MATH HELPERS
  // ==========================================================================

  /**
   * Smoothstep easing function (3x^2 - 2x^3) for seamless crossfade curves.
   * @private
   */
  _smoothstep(x) {
    const t = Math.max(0, Math.min(1, x));
    return t * t * (3 - 2 * t);
  }

  /**
   * Notify onProgress callback and event listeners.
   * @private
   */
  _notifyProgress(overallProgress, velocity, extraData) {
    const payload = Object.assign({
      progress: overallProgress,
      targetProgress: this.targetProgress,
      velocity,
      isLerping: this.isLerping,
      mode: this.mode
    }, extraData);

    if (typeof this.options.onProgress === 'function') {
      this.options.onProgress(payload);
    }
    this._emit('progress', payload);
  }

  /**
   * Notify onSceneChange callback and event listeners.
   * @private
   */
  _notifySceneChange(currentIndex, previousIndex) {
    const scene = this.sceneRanges[currentIndex] || null;
    const payload = {
      currentIndex,
      previousIndex,
      scene
    };

    if (typeof this.options.onSceneChange === 'function') {
      this.options.onSceneChange(payload);
    }
    this._emit('scenechange', payload);
  }

  // ==========================================================================
  // PUBLIC CONTROL API
  // ==========================================================================

  /**
   * Programmatically scrub to a normalized progress [0.0 .. 1.0].
   * @param {number} progress Target progress.
   * @param {boolean} [immediate=false] If true, bypasses lerp damping.
   */
  seekToProgress(progress, immediate = false) {
    const clamped = Math.max(0, Math.min(1, progress));
    this.targetProgress = clamped;
    if (immediate) {
      this.currentProgress = clamped;
      this._renderScrubFrame(this.currentProgress, 0);
    }
  }

  /**
   * Programmatically scrub to a specific scene by index.
   * @param {number} sceneIndex Index of the target scene.
   * @param {boolean} [immediate=false]
   */
  seekToScene(sceneIndex, immediate = false) {
    const scene = this.sceneRanges[sceneIndex];
    if (scene) {
      const target = scene.start !== undefined ? scene.start : scene.startProgress;
      this.seekToProgress(target, immediate);
    }
  }

  /**
   * Switch between 'multi' and 'master' modes dynamically.
   * @param {'multi'|'master'} newMode
   */
  setMode(newMode) {
    if (newMode !== 'multi' && newMode !== 'master') return;
    this.mode = newMode;
    this._setupSceneRanges();
    this._renderScrubFrame(this.currentProgress, 0);
  }

  /**
   * Update damping physics factor dynamically.
   * @param {number} factor Lerp factor between 0.01 and 1.0.
   */
  setLerpFactor(factor) {
    this.lerpFactor = Math.max(0.01, Math.min(1, factor));
  }

  /**
   * Pause the 60 FPS update loop.
   */
  pause() {
    this.isPaused = true;
  }

  /**
   * Resume the 60 FPS update loop.
   */
  resume() {
    this.isPaused = false;
    this.lastFrameTime = performance.now();
  }

  /**
   * Recalculate container bounds and viewport geometry.
   */
  resize() {
    this._updateContainerBounds();
    this._updateTargetFromScroll();
  }

  /**
   * Register event listener.
   * @param {string} event 'progress' | 'scenechange' | 'ready' | 'seekstart' | 'seekend'
   * @param {Function} handler
   */
  on(event, handler) {
    if (typeof handler !== 'function') return;
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);
  }

  /**
   * Unregister event listener.
   */
  off(event, handler) {
    if (this._listeners.has(event)) {
      this._listeners.get(event).delete(handler);
    }
  }

  /**
   * Internal event emitter.
   * @private
   */
  _emit(event, data) {
    const set = this._listeners.get(event);
    if (set) {
      set.forEach(fn => {
        try {
          fn(data);
        } catch (err) {
          console.error(`[VideoScrubEngine] Error in '${event}' handler:`, err);
        }
      });
    }
  }

  /**
   * Teardown and cleanup all event listeners, RAF loops, and DOM handles.
   */
  destroy() {
    this.isDestroyed = true;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this._domHandlers.scroll);
      window.removeEventListener('touchmove', this._domHandlers.touchMove);
      window.removeEventListener('touchstart', this._domHandlers.touchStart);
      window.removeEventListener('touchend', this._domHandlers.touchEnd);
      window.removeEventListener('resize', this._domHandlers.resize);
      document.removeEventListener('visibilitychange', this._domHandlers.visibility);
    }

    // Clean up video listeners
    this.channels.forEach(ch => {
      if (ch.video) {
        ch.video.removeEventListener('loadedmetadata', ch.onLoadedMetadata);
        ch.video.removeEventListener('seeking', ch.onSeeking);
        ch.video.removeEventListener('seeked', ch.onSeeked);
        ch.video.removeEventListener('error', ch.onError);
      }
    });

    this.channels = [];
    this._listeners.clear();
  }
}

// Global browser window fallback for script tag usage without bundlers
if (typeof window !== 'undefined') {
  window.VideoScrubEngine = VideoScrubEngine;
}
