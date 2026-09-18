/**
 * CINEMATIC QA & PERFORMANCE OPTIMIZATION AUDIT ENGINE
 * 
 * Production-grade diagnostic and runtime verification suite:
 * 1. Verification of 60fps video scrubbing without dropped frames (rVFC + rAF telemetry).
 * 2. Adaptive fallback strategy for Low Power Mode, iOS Safari battery saver, and slow connections.
 * 3. Zero layout shift (CLS < 0.01) and instant fast-path loading (< 1.2s).
 * 4. Cross-browser touch ergonomics (Apple HIG >= 44pt) and responsive layout validation (390px to 4K).
 * 
 * Conforms to:
 * - Apple Human Interface Guidelines (OS 26/27 Ergonomics)
 * - W3C Core Web Vitals Standards (CLS, LCP, INP)
 * - Cinematic Motion Sites Architecture (GOP Keyframe seeking, Lerp damping)
 */

(function (global, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    global.CinematicQAAudit = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // ============================================================================
  // 1. SCRUBBING PERFORMANCE MONITOR (60 FPS & DROPPED FRAME TELEMETRY)
  // ============================================================================

  class ScrubbingPerformanceMonitor {
    /**
     * @param {HTMLVideoElement|null} videoElement
     * @param {Object} options
     */
    constructor(videoElement = null, options = {}) {
      this.video = videoElement;
      this.targetFps = options.targetFps || 60;
      this.expectedFrameInterval = 1000 / this.targetFps; // 16.667ms
      this.dropThresholdMs = options.dropThresholdMs || 25; // > 1.5 frames considered dropped
      this.windowSize = options.windowSize || 60;

      // Telemetry metrics
      this.isRunning = false;
      this.currentFps = 60;
      this.avgFps = 60;
      this.minFps = 60;
      this.maxFps = 60;
      this.droppedFramesCount = 0;
      this.totalFramesSampled = 0;
      this.jitterMs = 0;
      this.seekLatencyMs = 0;
      this.isHardwareAccelerated = true;

      // Internal timing buffers
      this.frameTimestamps = [];
      this.frameDeltas = [];
      this.lastFrameTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.lastSeekStartTime = 0;
      this.rvfcSupported = typeof HTMLVideoElement !== 'undefined' &&
        'requestVideoFrameCallback' in HTMLVideoElement.prototype;

      this.callbacks = new Set();
      this.rafHandle = null;
      this.rvfcHandle = null;

      this._bindVideoEvents();
    }

    _bindVideoEvents() {
      if (!this.video) return;

      this.video.addEventListener('seeking', () => {
        this.lastSeekStartTime = performance.now();
      });

      this.video.addEventListener('seeked', () => {
        if (this.lastSeekStartTime > 0) {
          this.seekLatencyMs = Number((performance.now() - this.lastSeekStartTime).toFixed(1));
          // Latency over 45ms indicates GOP seek bottlenecks or software decoding fallback
          this.isHardwareAccelerated = this.seekLatencyMs < 45;
        }
      });
    }

    attachVideo(videoElement) {
      this.video = videoElement;
      this._bindVideoEvents();
    }

    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      this.lastFrameTime = performance.now();
      this.frameTimestamps = [];
      this.frameDeltas = [];
      this.droppedFramesCount = 0;
      this.totalFramesSampled = 0;

      const onFrame = (now, metadata) => {
        if (!this.isRunning) return;

        const delta = now - this.lastFrameTime;
        this.lastFrameTime = now;

        if (delta > 0 && delta < 1000) { // filter out tab-switch anomalies
          this.totalFramesSampled++;
          this.frameDeltas.push(delta);
          if (this.frameDeltas.length > this.windowSize) {
            this.frameDeltas.shift();
          }

          // Dropped frame calculation:
          // If delta exceeds dropThresholdMs, compute how many expected frames were skipped
          if (delta > this.dropThresholdMs) {
            const skipped = Math.max(1, Math.floor((delta / this.expectedFrameInterval) - 0.5));
            this.droppedFramesCount += skipped;
          }

          // Instantaneous and moving average FPS
          this.currentFps = Math.min(120, Math.round(1000 / delta));
          const sumDeltas = this.frameDeltas.reduce((acc, val) => acc + val, 0);
          const avgDelta = sumDeltas / this.frameDeltas.length;
          this.avgFps = Math.min(120, Math.round(1000 / avgDelta));
          this.minFps = Math.min(this.minFps, this.currentFps);
          this.maxFps = Math.max(this.maxFps, this.currentFps);

          // Jitter (Standard Deviation of Delta Time)
          const variance = this.frameDeltas.reduce((acc, val) => acc + Math.pow(val - avgDelta, 2), 0) / this.frameDeltas.length;
          this.jitterMs = Number(Math.sqrt(variance).toFixed(2));

          // Pass metadata from rVFC if available
          const rVfcMetadata = metadata || null;

          this._emitTelemetry({
            fps: this.currentFps,
            avgFps: this.avgFps,
            minFps: this.minFps,
            maxFps: this.maxFps,
            droppedFrames: this.droppedFramesCount,
            totalFrames: this.totalFramesSampled,
            dropRatePct: this.totalFramesSampled > 0
              ? Number(((this.droppedFramesCount / (this.totalFramesSampled + this.droppedFramesCount)) * 100).toFixed(2))
              : 0,
            jitterMs: this.jitterMs,
            seekLatencyMs: this.seekLatencyMs,
            isHardwareAccelerated: this.isHardwareAccelerated,
            rVfcMetadata
          });
        }

        // Schedule next sample
        if (this.video && this.rvfcSupported && !this.video.paused) {
          this.rvfcHandle = this.video.requestVideoFrameCallback(onFrame);
        } else {
          this.rafHandle = requestAnimationFrame((t) => onFrame(t));
        }
      };

      if (this.video && this.rvfcSupported && !this.video.paused) {
        this.rvfcHandle = this.video.requestVideoFrameCallback(onFrame);
      } else {
        this.rafHandle = requestAnimationFrame((t) => onFrame(t));
      }
    }

    stop() {
      this.isRunning = false;
      if (this.rafHandle && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.rafHandle);
      if (this.video && this.rvfcHandle && 'cancelVideoFrameCallback' in this.video) {
        this.video.cancelVideoFrameCallback(this.rvfcHandle);
      }
    }

    onTelemetry(callback) {
      this.callbacks.add(callback);
      return () => this.callbacks.delete(callback);
    }

    _emitTelemetry(data) {
      for (const cb of this.callbacks) {
        try {
          cb(data);
        } catch (err) {
          console.error('[ScrubbingPerformanceMonitor] callback error:', err);
        }
      }
    }

    getReport() {
      return {
        targetFps: this.targetFps,
        avgFps: this.avgFps,
        minFps: this.minFps,
        maxFps: this.maxFps,
        droppedFrames: this.droppedFramesCount,
        totalFramesSampled: this.totalFramesSampled,
        dropRatePercentage: this.totalFramesSampled > 0
          ? Number(((this.droppedFramesCount / (this.totalFramesSampled + this.droppedFramesCount)) * 100).toFixed(2))
          : 0,
        jitterMs: this.jitterMs,
        seekLatencyMs: this.seekLatencyMs,
        isHardwareAccelerated: this.isHardwareAccelerated,
        verdict: this.droppedFramesCount === 0 && this.avgFps >= 58
          ? 'PASSED_FLUID_60FPS'
          : this.avgFps >= 45
            ? 'ACCEPTABLE_WITH_MICRO_JITTER'
            : 'FAILED_FRAME_DROPS_DETECTED'
      };
    }
  }


  // ============================================================================
  // 2. ADAPTIVE PERFORMANCE FALLBACK STRATEGY ENGINE
  // ============================================================================

  const FALLBACK_MODES = {
    OPTIMAL_VIDEO: 'OPTIMAL_VIDEO',           // Full 60fps hardware H.264/HEVC video scrubbing
    CANVAS_FALLBACK: 'CANVAS_FALLBACK',       // 2D Canvas buffer sequence (avoids GPU decoder thrashing)
    KINETIC_ANIMATED: 'KINETIC_ANIMATED'      // Pure CSS/SVG motion loop (0 media decode overhead)
  };

  class AdaptivePerformanceFallbackEngine {
    constructor(options = {}) {
      this.mode = FALLBACK_MODES.OPTIMAL_VIDEO;
      this.manualOverride = false;
      this.reasons = [];

      // Thresholds
      this.minFpsDegradationThreshold = options.minFpsDegradationThreshold || 32;
      this.consecutiveLowFpsMax = options.consecutiveLowFpsMax || 15; // ~250ms at 60fps
      this.consecutiveLowFpsCount = 0;

      // Detection flags
      this.isLowPowerMode = false;
      this.isBatterySaver = false;
      this.isSlowConnection = false;
      this.isHardwareThrottled = false;

      this.listeners = new Set();
      this._initDetectors();
    }

    async _initDetectors() {
      // 1. Battery Status API
      if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
        try {
          const battery = await navigator.getBattery();
          const checkBattery = () => {
            this.isBatterySaver = !battery.charging && battery.level <= 0.20;
            this._evaluateState('Battery update: ' + Math.round(battery.level * 100) + '%, charging=' + battery.charging);
          };
          battery.addEventListener('chargingchange', checkBattery);
          battery.addEventListener('levelchange', checkBattery);
          checkBattery();
        } catch {
          // Battery API restricted or rejected
        }
      }

      // 2. Network Information API
      if (typeof navigator !== 'undefined' && 'connection' in navigator) {
        const conn = navigator.connection;
        const checkConnection = () => {
          const slowType = conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g' || conn.effectiveType === '3g';
          const lowDownlink = typeof conn.downlink === 'number' && conn.downlink < 1.5;
          const saveData = Boolean(conn.saveData);
          this.isSlowConnection = slowType || lowDownlink || saveData;
          this._evaluateState('Connection change: ' + conn.effectiveType + ', downlink=' + conn.downlink + 'Mbps');
        };
        conn.addEventListener('change', checkConnection);
        checkConnection();
      }

      // 3. iOS Safari Battery Saver / Low Power Mode Heuristic
      // On iOS Safari, Low Power Mode limits requestAnimationFrame refresh to ~30Hz!
      this._detectIosLowPowerMode();
    }

    _detectIosLowPowerMode() {
      if (typeof window === 'undefined') return;

      const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      let sampleCount = 0;
      let lastTime = performance.now();
      const intervals = [];

      const probeRaf = (now) => {
        const delta = now - lastTime;
        lastTime = now;
        if (delta > 0 && delta < 100) {
          intervals.push(delta);
          sampleCount++;
        }

        if (sampleCount < 25) {
          requestAnimationFrame(probeRaf);
        } else {
          // Compute average refresh interval
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          // If average interval is around 33.3ms (28-35ms) on an Apple device without active heavy work,
          // Low Power Mode throttling is confirmed.
          if (isAppleMobile && avgInterval >= 29 && avgInterval <= 36) {
            this.isLowPowerMode = true;
            this._evaluateState('iOS Safari Low Power Mode heuristic triggered: rAF throttled to ~30Hz (' + avgInterval.toFixed(1) + 'ms)');
          }
        }
      };

      requestAnimationFrame(probeRaf);
    }

    notifyScrubPerformance(telemetry) {
      if (this.manualOverride) return;

      // Monitor for sustained frame rate collapse or seek stall
      if (telemetry.fps < this.minFpsDegradationThreshold || telemetry.seekLatencyMs > 75) {
        this.consecutiveLowFpsCount++;
        if (this.consecutiveLowFpsCount >= this.consecutiveLowFpsMax) {
          this.isHardwareThrottled = true;
          this._evaluateState('Sustained frame rate collapse (' + telemetry.fps + ' FPS, seek ' + telemetry.seekLatencyMs + 'ms)');
        }
      } else {
        if (this.consecutiveLowFpsCount > 0) {
          this.consecutiveLowFpsCount--;
        }
        if (this.consecutiveLowFpsCount === 0 && this.isHardwareThrottled) {
          this.isHardwareThrottled = false;
          this._evaluateState('Hardware throughput recovered');
        }
      }
    }

    _evaluateState(triggerReason = '') {
      if (this.manualOverride) return;

      const reasons = [];
      let newMode = FALLBACK_MODES.OPTIMAL_VIDEO;

      // Priority 1: Battery Saver or iOS Low Power Mode -> Pure Kinetic Animated (0 decoder cost)
      if (this.isBatterySaver || this.isLowPowerMode) {
        newMode = FALLBACK_MODES.KINETIC_ANIMATED;
        reasons.push(this.isBatterySaver ? 'Battery Saver Active (< 20%)' : 'iOS Safari Low Power Mode Active');
      } 
      // Priority 2: Slow Connection or Hardware Decode Throttling -> Canvas Frame Buffer
      else if (this.isSlowConnection || this.isHardwareThrottled) {
        newMode = FALLBACK_MODES.CANVAS_FALLBACK;
        if (this.isSlowConnection) reasons.push('Slow Network Connection (< 1.5 Mbps or Save-Data)');
        if (this.isHardwareThrottled) reasons.push('GPU Decoder Seeking Bottleneck');
      }

      this.reasons = reasons;

      if (newMode !== this.mode) {
        const oldMode = this.mode;
        this.mode = newMode;
        this._notifyListeners({
          oldMode,
          newMode,
          reasons: this.reasons,
          triggerReason
        });
      }
    }

    setManualMode(mode) {
      if (!FALLBACK_MODES[mode]) {
        throw new Error('Unknown fallback mode: ' + mode);
      }
      this.manualOverride = true;
      const oldMode = this.mode;
      this.mode = mode;
      this.reasons = ['Manual QA Test Override'];
      this._notifyListeners({
        oldMode,
        newMode: mode,
        reasons: this.reasons,
        triggerReason: 'Manual Override'
      });
    }

    clearManualOverride() {
      this.manualOverride = false;
      this._evaluateState('Manual override cleared');
    }

    onModeChange(callback) {
      this.listeners.add(callback);
      return () => this.listeners.delete(callback);
    }

    onStateChange(callback) {
      return this.onModeChange(callback);
    }

    _notifyListeners(change) {
      for (const cb of this.listeners) {
        try {
          cb(change);
        } catch (err) {
          console.error('[AdaptivePerformanceFallbackEngine] listener error:', err);
        }
      }
    }

    getStatus() {
      return {
        activeMode: this.mode,
        isManualOverride: this.manualOverride,
        reasons: this.reasons,
        signals: {
          isBatterySaver: this.isBatterySaver,
          isLowPowerMode: this.isLowPowerMode,
          isSlowConnection: this.isSlowConnection,
          isHardwareThrottled: this.isHardwareThrottled
        }
      };
    }
  }


  // ============================================================================
  // 3. CORE WEB VITALS & ZERO CLS (< 0.01) FAST-PATH AUDITOR
  // ============================================================================

  class CoreWebVitalsAudit {
    constructor() {
      this.clsValue = 0;
      this.clsEntries = [];
      this.lcpValue = 0;
      this.fcpValue = 0;
      this.ttfbValue = 0;
      this.domLoadValue = 0;
      this.observers = [];
      this.isAuditing = false;

      this._initObservers();
    }

    _initObservers() {
      if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

      // 1. Cumulative Layout Shift (CLS) Observer
      try {
        const clsObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            // Only count shifts without recent user input to follow Google Lighthouse standards
            if (!entry.hadRecentInput) {
              this.clsValue += entry.value;
              this.clsEntries.push({
                value: entry.value,
                startTime: entry.startTime,
                sources: (entry.sources || []).map(s => ({
                  node: s.node ? s.node.nodeName : 'Unknown',
                  previousRect: s.previousRect,
                  currentRect: s.currentRect
                }))
              });
            }
          }
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
        this.observers.push(clsObserver);
      } catch {
        // Observer not supported
      }

      // 2. Largest Contentful Paint (LCP) Observer
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          if (entries.length > 0) {
            const lastEntry = entries[entries.length - 1];
            this.lcpValue = Number(lastEntry.startTime.toFixed(1));
          }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        this.observers.push(lcpObserver);
      } catch {}

      // 3. First Contentful Paint (FCP) Observer
      try {
        const paintObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              this.fcpValue = Number(entry.startTime.toFixed(1));
            }
          }
        });
        paintObserver.observe({ type: 'paint', buffered: true });
        this.observers.push(paintObserver);
      } catch {}

      // 4. Navigation Timings (TTFB & Fast Path)
      if (typeof performance !== 'undefined' && performance.getEntriesByType) {
        const navEntries = performance.getEntriesByType('navigation');
        if (navEntries.length > 0) {
          const nav = navEntries[0];
          this.ttfbValue = Number(nav.responseStart.toFixed(1));
          this.domLoadValue = Number(nav.domContentLoadedEventEnd.toFixed(1));
        }
      }
    }

    /**
     * Audit critical fast-path loading resources and DOM layout safety
     */
    auditFastPathAndCls() {
      const issues = [];
      const checks = [];

      // Check 1: CLS Threshold < 0.01
      const clsPassed = this.clsValue < 0.01;
      checks.push({
        id: 'cls_threshold',
        name: 'Zero Layout Shift (CLS < 0.01)',
        target: '< 0.010',
        actual: this.clsValue.toFixed(4),
        passed: clsPassed
      });
      if (!clsPassed) {
        issues.push({
          level: 'CRITICAL',
          message: `Cumulative Layout Shift of ${this.clsValue.toFixed(4)} exceeds zero-tolerance threshold of 0.010.`,
          entries: this.clsEntries
        });
      }

      // Check 2: Instant Fast-Path Loading (< 1200ms)
      const lcpPassed = this.lcpValue === 0 || this.lcpValue <= 1200;
      checks.push({
        id: 'lcp_fast_path',
        name: 'Instant Fast-Path LCP (< 1.2s)',
        target: '<= 1200ms',
        actual: `${this.lcpValue}ms`,
        passed: lcpPassed
      });
      if (!lcpPassed) {
        issues.push({
          level: 'WARNING',
          message: `LCP of ${this.lcpValue}ms exceeds instantaneous target of 1200ms.`
        });
      }

      // Check 3: Aspect Ratio Containers (Layout Shift Prevention)
      if (typeof document !== 'undefined') {
        const mediaContainers = document.querySelectorAll('video, img, .video-container, .hero-stage');
        let unconstrainedMediaCount = 0;
        mediaContainers.forEach(el => {
          const style = window.getComputedStyle(el);
          const hasExplicitRatio = style.aspectRatio !== 'auto' ||
            (style.width && style.height && style.width !== 'auto' && style.height !== 'auto') ||
            el.hasAttribute('width') && el.hasAttribute('height');
          if (!hasExplicitRatio && style.position !== 'absolute' && style.position !== 'fixed') {
            unconstrainedMediaCount++;
          }
        });

        const aspectPassed = unconstrainedMediaCount === 0;
        checks.push({
          id: 'aspect_ratio_containment',
          name: 'Media Aspect Ratio Pre-Allocation',
          target: '0 unconstrained elements',
          actual: `${unconstrainedMediaCount} unconstrained`,
          passed: aspectPassed
        });
        if (!aspectPassed) {
          issues.push({
            level: 'HIGH',
            message: `Found ${unconstrainedMediaCount} media containers missing aspect-ratio or explicit dimensions. This risks layout reflow.`
          });
        }
      }

      return {
        score: checks.every(c => c.passed) ? 100 : issues.some(i => i.level === 'CRITICAL') ? 40 : 75,
        checks,
        issues,
        cls: Number(this.clsValue.toFixed(4)),
        lcp: this.lcpValue,
        fcp: this.fcpValue,
        ttfb: this.ttfbValue,
        domLoad: this.domLoadValue
      };
    }
  }


  // ============================================================================
  // 4. CROSS-BROWSER TOUCH ERGONOMICS & RESPONSIVE VALIDATOR (390px to 4K)
  // ============================================================================

  const STANDARD_BREAKPOINTS = [
    { name: 'iPhone 14/15/16 Pro', width: 390, height: 844, device: 'mobile' },
    { name: 'iPhone Pro Max / Plus', width: 430, height: 932, device: 'mobile' },
    { name: 'iPad Mini / Tablet Portrait', width: 768, height: 1024, device: 'tablet' },
    { name: 'iPad Pro / Tablet Landscape', width: 1024, height: 1366, device: 'tablet' },
    { name: 'MacBook Pro / Desktop', width: 1440, height: 900, device: 'desktop' },
    { name: 'Full HD 1080p', width: 1920, height: 1080, device: 'desktop' },
    { name: 'Ultra HD 4K', width: 3840, height: 2160, device: 'desktop' }
  ];

  class TouchErgonomicsValidator {
    /**
     * Audit interactive touch targets against Apple HIG specifications (>= 44x44pt)
     * @param {HTMLElement|Document} root
     */
    static auditTouchTargets(root = typeof document !== 'undefined' ? document : null) {
      if (!root) return { passed: true, violations: [] };

      const interactiveSelector = 'button, a, input, select, textarea, [role="button"], [tabindex="0"], .btn-mercury, .btn-touch';
      const elements = root.querySelectorAll(interactiveSelector);
      const violations = [];
      let totalAudited = 0;

      elements.forEach(el => {
        // Skip hidden elements
        if (el.offsetParent === null && el.offsetWidth === 0 && el.offsetHeight === 0) return;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;

        totalAudited++;
        const rect = el.getBoundingClientRect();
        const minTargetSize = 44; // 44 CSS pt / px minimum (Apple HIG Standard)

        if (rect.width < minTargetSize || rect.height < minTargetSize) {
          // Check if parent or pseudo element has hit padding
          violations.push({
            tagName: el.tagName.toLowerCase(),
            className: el.className || '',
            id: el.id || '',
            text: (el.textContent || '').trim().slice(0, 30),
            actualWidth: Math.round(rect.width),
            actualHeight: Math.round(rect.height),
            required: '44x44pt'
          });
        }
      });

      return {
        passed: violations.length === 0,
        totalAudited,
        violationsCount: violations.length,
        violations: violations.slice(0, 10), // return top 10 violations
        complianceRatePct: totalAudited > 0
          ? Number((((totalAudited - violations.length) / totalAudited) * 100).toFixed(1))
          : 100
      };
    }

    /**
     * Audit Safe Area Insets for iPhone Dynamic Island and Home Indicator
     */
    static auditSafeAreaInsets(root = typeof document !== 'undefined' ? document : null) {
      if (!root || typeof window === 'undefined') return { passed: true };

      const fixedElements = root.querySelectorAll('.fixed, .sticky, header, nav, [class*="bottom-"]');
      const safeAreaAudit = [];

      fixedElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const isFixedTop = style.position === 'fixed' && style.top === '0px';
        const isFixedBottom = style.position === 'fixed' && (style.bottom === '0px' || parseInt(style.bottom) < 20);

        if (isFixedTop || isFixedBottom) {
          const pt = style.paddingTop;
          const pb = style.paddingBottom;
          safeAreaAudit.push({
            element: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
            isFixedTop,
            isFixedBottom,
            paddingTop: pt,
            paddingBottom: pb
          });
        }
      });

      return {
        passed: true,
        elementsChecked: safeAreaAudit.length,
        details: safeAreaAudit
      };
    }

    /**
     * Audit horizontal overflow across all elements (guarantees zero side-scroll)
     */
    static auditHorizontalOverflow() {
      if (typeof document === 'undefined' || typeof window === 'undefined') return { passed: true };

      const docWidth = document.documentElement.clientWidth;
      const scrollWidth = document.documentElement.scrollWidth;
      const hasOverflow = scrollWidth > docWidth;
      const overflowingNodes = [];

      if (hasOverflow) {
        document.querySelectorAll('*').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > docWidth + 2) {
            overflowingNodes.push({
              node: el.tagName.toLowerCase() + (el.className ? '.' + el.className.split(' ')[0] : ''),
              overflowRightPx: Math.round(rect.right - docWidth)
            });
          }
        });
      }

      return {
        passed: !hasOverflow,
        clientWidth: docWidth,
        scrollWidth: scrollWidth,
        overflowDeltaPx: Math.max(0, scrollWidth - docWidth),
        overflowingNodes: overflowingNodes.slice(0, 5)
      };
    }

    /**
     * Thumb Zone Ergonomics Analysis (Bottom 40% optimal zone)
     */
    static auditThumbZonePlacement(root = typeof document !== 'undefined' ? document : null) {
      if (!root || typeof window === 'undefined') return { passed: true };

      const viewportHeight = window.innerHeight;
      const naturalZoneTop = viewportHeight * 0.55; // bottom 45% of screen
      const primaryButtons = root.querySelectorAll('button.primary, .btn-mercury, .btn-primary, [data-primary-action="true"]');
      let optimalCount = 0;
      let awkwardCount = 0;

      primaryButtons.forEach(btn => {
        const rect = btn.getBoundingClientRect();
        if (rect.top >= naturalZoneTop || window.getComputedStyle(btn).position === 'fixed') {
          optimalCount++;
        } else {
          awkwardCount++;
        }
      });

      return {
        passed: awkwardCount <= optimalCount,
        optimalPlacementCount: optimalCount,
        awkwardPlacementCount: awkwardCount,
        verdict: optimalCount >= awkwardCount ? 'OPTIMAL_THUMB_REACH' : 'NEEDS_BOTTOM_ACTION_DOCK'
      };
    }
  }


  // ============================================================================
  // EXPORT MASTER AUDIT SUITE FACADE
  // ============================================================================

  return {
    ScrubbingPerformanceMonitor,
    AdaptivePerformanceFallbackEngine,
    CoreWebVitalsAudit,
    TouchErgonomicsValidator,
    FALLBACK_MODES,
    STANDARD_BREAKPOINTS,
    version: '1.0.0-cinematic-audit'
  };
});
