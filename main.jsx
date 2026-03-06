import { Swiper, SwiperSlide } from "swiper/react";
import { Mousewheel, EffectCards, EffectCreative } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-cards";
import "swiper/css/effect-creative";
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform, useSpring } from 'framer-motion';
import { createRoot } from 'react-dom/client';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { TextPlugin } from 'gsap/TextPlugin';
import {
  artworks,
  getSafeImagesForCategory,
  createColorfulFallback,
  FALLBACK_IMAGES
} from './artworksData.js';
import StartingPage from './StartingPage.jsx';
import './index.css';

gsap.registerPlugin(ScrollTrigger, TextPlugin);

const PRELOADED = new Set();
const FAILED_IMAGES = new Set();
const IMAGES_PER_SECTION = 16;

// lightweight media-query hook used in several places
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    try { return window.matchMedia(query).matches; } catch { return false; }
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    let m;
    try { m = window.matchMedia(query); } catch { return; }
    const handler = (e) => setMatches(e.matches);
    // modern API
    if (m.addEventListener) m.addEventListener('change', handler);
    else m.addListener && m.addListener(handler);
    // set initial
    setMatches(m.matches);
    return () => {
      if (m.removeEventListener) m.removeEventListener('change', handler);
      else m.removeListener && m.removeListener(handler);
    };
  }, [query]);
  return matches;
}

// small deterministic hash -> uint32 for seeding image pickers
function hashStringToUint32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

// small PRNG for deterministic layouts
function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Build simple caption plan for a set of images
function buildTitlePlan({ sources = [], category = 'Artwork', seed = 1 }) {
  const rnd = mulberry32(typeof seed === 'number' ? seed : hashStringToUint32(String(seed)));
  return sources.map((s, i) => {
    // Try to pull a meaningful token from the filename or URL
    let token = '';
    if (typeof s === 'string') {
      try {
        const url = new URL(s, window.location.href);
        const parts = url.pathname.split('/').filter(Boolean);
        const last = parts.length ? parts[parts.length - 1] : '';
        token = last.replace(/\.jpg$|\.jpeg$|\.png$|\.webp$/i, '').replace(/[-_]/g, ' ').replace(/\d+/g, '').trim();
      } catch (e) {
        token = '';
      }
    }
    const short = (token && token.length > 1) ? token : `${category} ${i+1}`;
    const adjective = ['Vivid', 'Quiet', 'Hidden', 'Radiant', 'Worn', 'Luminous'][Math.floor(rnd() * 6)];
    return `${short.length > 28 ? short.slice(0, 28) : short} — ${adjective}`;
  });
}

// Build a masonry columns layout: distribute sources into `columns` arrays
function buildMasonryColumns({ sources = [], columns = 3, seed = 1 }) {
  const rnd = mulberry32(typeof seed === 'number' ? seed : hashStringToUint32(String(seed)));
  const ratioList = ['ratio-square','ratio-square-tall','ratio-square-wide','ratio-portrait','ratio-portrait-2','ratio-tall','ratio-tall-2','ratio-landscape','ratio-landscape-2'];
  const cols = Array.from({ length: Math.max(1, columns) }, () => []);
  // simple balancing: push to shortest column
  sources.forEach((src, idx) => {
    const ratio = ratioList[Math.floor(rnd() * ratioList.length)];
    let target = 0;
    for (let c = 1; c < cols.length; c++) if (cols[c].length < cols[target].length) target = c;
    cols[target].push({ src, index: idx, ratio, uniqueId: `${seed}-${idx}` });
  });
  return cols;
}

// Simple tile image renderer with fallback handling
function TileImage({ src, alt, index, fallbackPool = [] }) {
  const fallback = (fallbackPool && fallbackPool.length) ? fallbackPool[index % fallbackPool.length] : FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
  const placeholder = createColorfulFallback(index + 12345);
  const [bg, setBg] = useState(placeholder);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    let mounted = true;
    const desired = (src && typeof src === 'string' && /^https?:\/\//i.test(src)) ? src : fallback;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.loading = 'eager';
    img.decoding = 'async';
    img.onload = () => {
      if (!mounted) return;
      setBg(desired);
      setLoaded(true);
    };
    img.onerror = () => {
      if (!mounted) return;
      if (desired !== fallback) {
        const fb = fallback;
        const img2 = new Image();
        img2.loading = 'eager';
        img2.onload = () => { if (!mounted) return; setBg(fb); setLoaded(true); };
        img2.onerror = () => { if (!mounted) return; setBg(createColorfulFallback(Date.now())); setLoaded(true); };
        img2.src = fb;
      } else {
        setBg(createColorfulFallback(Date.now()));
        setLoaded(true);
      }
    };
    img.src = desired;
    return () => { mounted = false; };
  }, [src, index, fallbackPool]);

  // observe when tile enters the nearest scroll container to trigger framer animations
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      // Fallback: if IntersectionObserver is not available, show immediately
      setInView(true);
      return;
    }
    const root = el.closest('.collage-scroll') || null;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => setInView(en.isIntersecting));
    }, { root, threshold: 0.1 }); // Reduced threshold for earlier visibility
    io.observe(el);
    
    // Fallback timeout: show after 2 seconds regardless of intersection
    const fallbackTimer = setTimeout(() => setInView(true), 2000);
    
    return () => {
      io.disconnect();
      clearTimeout(fallbackTimer);
    };
  }, [ref]);

  const variants = {
    hidden: { opacity: 0, y: 30, scale: 0.9, rotateY: -10 },
    visible: {
      opacity: 1, y: 0, scale: 1, rotateY: 0,
      transition: { 
        duration: 0.6, 
        ease: [0.25, 0.46, 0.45, 0.94],
        delay: index * 0.03,
        type: "spring",
        stiffness: 120
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      className={`masonry-media ${loaded ? 'is-loaded' : ''}`}
      role="img"
      aria-label={alt}
      style={{ backgroundImage: `url(${bg})` }}
      initial="hidden"
      animate={reduce ? 'visible' : (inView ? 'visible' : 'hidden')}
      variants={variants}
      whileHover={{ 
        scale: 1.03,
        filter: "brightness(1.06) contrast(1.04) saturate(1.03)",
        transition: { 
          duration: 0.3, 
          ease: "easeOut"
        }
      }}
    />
  );
}

// ========== LOADING SCREEN ==========
function LoadingScreen({ onComplete }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    // Extended to 1900ms so the SVG draw-in completes before navigating
    const timer = window.setTimeout(() => { onComplete?.(); }, 1900);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  // SVG path-drawing variants (framer-motion pathLength)
  const pathVars = (delay = 0, dur = 1.2) => ({
    hidden: { pathLength: 0, opacity: 0 },
    visible: { pathLength: 1, opacity: 1, transition: { duration: dur, delay, ease: 'easeInOut' } },
  });

  const title = 'Our Artwork Collection';

  return (
    <div className="fixed inset-0 z-[999] bg-black flex flex-col items-center justify-center gap-8">
      {/* ── Artistic SVG frame drawing ── */}
      <motion.svg
        width="200" height="200" viewBox="0 0 200 200"
        fill="none" initial="hidden" animate="visible">
        {/* Outer decorative frame */}
        <motion.rect x="10" y="10" width="180" height="180" rx="6"
          stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" variants={pathVars(0, 1.3)} />
        {/* Inner mat border */}
        <motion.rect x="26" y="26" width="148" height="148" rx="2"
          stroke="rgba(255,255,255,0.25)" strokeWidth="1" variants={pathVars(0.25, 1.1)} />
        {/* Crosshair guides */}
        <motion.line x1="100" y1="26" x2="100" y2="174"
          stroke="rgba(255,255,255,0.14)" strokeWidth="0.8" variants={pathVars(0.5, 0.9)} />
        <motion.line x1="26" y1="100" x2="174" y2="100"
          stroke="rgba(255,255,255,0.14)" strokeWidth="0.8" variants={pathVars(0.65, 0.9)} />
        {/* Diagonal accent lines */}
        <motion.line x1="46" y1="46" x2="154" y2="154"
          stroke="rgba(255,255,255,0.09)" strokeWidth="0.8" variants={pathVars(0.8, 0.85)} />
        <motion.line x1="154" y1="46" x2="46" y2="154"
          stroke="rgba(255,255,255,0.09)" strokeWidth="0.8" variants={pathVars(0.9, 0.85)} />
        {/* Center circle */}
        <motion.circle cx="100" cy="100" r="22"
          stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" variants={pathVars(1.0, 0.75)} />
        {/* Corner diamond accents */}
        <motion.rect x="88" y="10" width="24" height="10" rx="2"
          stroke="rgba(255,255,255,0.35)" strokeWidth="1" variants={pathVars(1.2, 0.5)} />
        <motion.rect x="88" y="180" width="24" height="10" rx="2"
          stroke="rgba(255,255,255,0.35)" strokeWidth="1" variants={pathVars(1.2, 0.5)} />
        {/* Center dot — pops in at end */}
        <motion.circle cx="100" cy="100" r="5" fill="white"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.55, duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
        {/* Tiny sparkles at corners */}
        <motion.circle cx="26" cy="26" r="2.5" fill="rgba(255,255,255,0.6)"
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.35, duration: 0.3, ease: 'backOut' }} />
        <motion.circle cx="174" cy="26" r="2.5" fill="rgba(255,255,255,0.6)"
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.3, ease: 'backOut' }} />
        <motion.circle cx="26" cy="174" r="2.5" fill="rgba(255,255,255,0.6)"
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.45, duration: 0.3, ease: 'backOut' }} />
        <motion.circle cx="174" cy="174" r="2.5" fill="rgba(255,255,255,0.6)"
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.3, ease: 'backOut' }} />
      </motion.svg>

      {/* ── Title: letter-by-letter stagger ── */}
      <div className="flex flex-wrap justify-center overflow-hidden">
        {title.split('').map((ch, i) => (
          <motion.span
            key={i}
            className="text-white text-xl md:text-3xl font-semibold tracking-widest inline-block"
            style={{ minWidth: ch === ' ' ? '0.4em' : undefined }}
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 18, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: 0.3 + i * 0.038, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {ch === ' ' ? '\u00A0' : ch}
          </motion.span>
        ))}
      </div>

      {/* ── Animated progress bar with riding dot ── */}
      <div className="relative h-px w-52 bg-white/15 rounded-full overflow-visible">
        <motion.div
          className="absolute inset-0 bg-white rounded-full origin-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.7, ease: 'easeInOut', delay: 0.15 }}
        />
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white"
          style={{ boxShadow: '0 0 12px 5px rgba(255,255,255,0.55)', marginLeft: '-5px' }}
          initial={{ left: '0%' }}
          animate={{ left: '100%' }}
          transition={{ duration: 1.7, ease: 'easeInOut', delay: 0.15 }}
        />
      </div>
    </div>
  );
}

// ========== LEGACY INTRO SCREEN (preserved, not used) ==========

// Accent colours matched to artwork slide order (loops)
const SLIDE_ACCENTS = ['#3b82f6','#a855f7','#10b981','#ef4444','#f59e0b','#6366f1'];

/**
 * Canvas-based floating dust / light-spot particle system.
 * Particles drift with gentle mouse repulsion and change colour on slide change.
 * Returns null when prefers-reduced-motion is true for full accessibility.
 */
function ParticleCanvas({ accentColor = '#ffffff' }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -999, y: -999 });
  const reduce = useReducedMotion();
  const rafRef = useRef(null);

  useEffect(() => {
    if (reduce) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Parse hex accent → rgb
    const hex = accentColor.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    let W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W; canvas.height = H;

    const COUNT = 60;
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      radius: 1 + Math.random() * 2.8,
      alpha: 0.07 + Math.random() * 0.2,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.006 + Math.random() * 0.014,
    }));

    const onMouse = (e) => {
      const rc = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rc.left, y: e.clientY - rc.top };
    };
    const onResize = () => {
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      canvas.width = W; canvas.height = H;
    };
    window.addEventListener('mousemove', onMouse, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const { x: mx, y: my } = mouseRef.current;
      for (const p of particles) {
        // Gentle mouse repulsion within 110px
        const dx = p.x - mx, dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110 && dist > 0) {
          p.vx += (dx / dist) * 0.045;
          p.vy += (dy / dist) * 0.045;
        }
        // Speed cap
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > 0.65) { p.vx *= 0.65 / spd; p.vy *= 0.65 / spd; }
        // Friction
        p.vx *= 0.995; p.vy *= 0.995;
        p.x += p.vx; p.y += p.vy;
        p.pulse += p.pulseSpeed;
        // Wrap
        if (p.x < -6) p.x = W + 6; if (p.x > W + 6) p.x = -6;
        if (p.y < -6) p.y = H + 6; if (p.y > H + 6) p.y = -6;
        // Draw radial glow dot
        const a = p.alpha * (0.65 + 0.35 * Math.sin(p.pulse));
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3);
        grd.addColorStop(0, `rgba(${r},${g},${b},${a})`);
        grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', onResize);
    };
  }, [accentColor, reduce]);

  if (reduce) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1, opacity: 0.75 }}
    />
  );
}
function LegacyIntroScreen({ artworksList, onChoose }) {
  const containerRef = useRef(null);
  const imgRefs = useRef([]);
  const swiperInnerRef = useRef(null);

  // Heading letter animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.intro-letter', 
        { y: 30, opacity: 0, rotateX: -15 }, 
        { y: 0, opacity: 1, rotateX: 0, duration: 0.9, ease: 'back.out(1.4)', stagger: 0.03 }
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  // Hover tilt effect
  const handleMouseMove = (e, idx) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    gsap.to(card, {
      rotateY: x * 15,
      rotateX: y * -10,
      duration: 0.3,
      ease: 'power2.out',
      overwrite: 'auto',
    });
    // Also move image slightly for extra depth
    const img = imgRefs.current[idx];
    if (img) {
      gsap.to(img, {
        x: x * 10,
        y: y * 10,
        duration: 0.3,
        ease: 'power2.out',
      });
    }
  };

  const handleMouseLeave = (e, idx) => {
    const card = e.currentTarget;
    gsap.to(card, {
      rotateY: 0,
      rotateX: 0,
      duration: 0.5,
      ease: 'elastic.out(1, 0.3)',
    });
    const img = imgRefs.current[idx];
    if (img) {
      gsap.to(img, {
        x: 0,
        y: 0,
        duration: 0.5,
        ease: 'elastic.out(1, 0.3)',
      });
    }
  };

  // floating (subtle) animation to make cards feel alive
  useEffect(() => {
    const cards = containerRef.current?.querySelectorAll('.intro-card');
    if (!cards || !cards.length) return;
    const floatTws = [];
    cards.forEach((c, i) => {
      const amp = 6 + (i % 3) * 3;
      const rot = (i % 2 === 0) ? -1.2 : 1.2;
      const t = gsap.to(c, { y: `+=${amp}`, rotationZ: rot, duration: 4 + (i % 3), ease: 'sine.inOut', repeat: -1, yoyo: true });
      floatTws.push(t);
    });
    return () => floatTws.forEach(t => t.kill && t.kill());
  }, []);

  // wheel hijack / easier slide via accumulated delta
  useEffect(() => {
    const sc = containerRef.current?.querySelector('.intro-swiper');
    if (!sc) return;
    let acc = 0, timer = null;
    const onWheel = (e) => {
      // prefer native scrolling for touch devices; only handle mouse wheel
      if (e.deltaY === 0) return;
      acc += e.deltaY;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { acc = 0; }, 150);
      const TH = 36; // easier threshold
      if (Math.abs(acc) > TH && swiperInnerRef.current) {
        if (acc > 0) swiperInnerRef.current.slideNext(); else swiperInnerRef.current.slidePrev();
        acc = 0;
      }
    };
    sc.addEventListener('wheel', onWheel, { passive: true });
    return () => sc.removeEventListener('wheel', onWheel);
  }, []);

  // click-to-expand: clone card, animate to fullscreen, then call onChoose
  const handleExpand = (idx, e) => {
    const cardEl = e.currentTarget;
    const rect = cardEl.getBoundingClientRect();
    const clone = cardEl.cloneNode(true);
    clone.classList.add('intro-clone');
    // copy computed image src to avoid lazy issues
    const img = clone.querySelector('img');
    const origImg = cardEl.querySelector('img');
    if (img && origImg) img.src = origImg.src;
    document.body.appendChild(clone);
    // set initial position/size
    gsap.set(clone, { left: rect.left, top: rect.top, width: rect.width, height: rect.height, scale: 1, borderRadius: window.getComputedStyle(cardEl).borderRadius || '28px' });

    // fade others and add blur
    const siblings = containerRef.current.querySelectorAll('.intro-card');
    siblings.forEach(s => { if (s !== cardEl) s.classList.add('motion-blur'); });

    const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' } });
    tl.to(clone, { duration: 0.6, left: 0, top: 0, width: window.innerWidth, height: window.innerHeight, borderRadius: 0 })
      .to(clone, { duration: 0.6, scale: 1, rotation: 0 }, 0)
      .to(containerRef.current, { duration: 0.5, opacity: 0, ease: 'power2.out' }, 0.2)
      .call(() => {
        // navigate and cleanup
        onChoose(idx);
        siblings.forEach(s => s.classList.remove('motion-blur'));
        gsap.to(clone, { duration: 0.25, opacity: 0, onComplete: () => clone.remove() });
      });
  };

  return (
    <div ref={containerRef} className="intro-screen fixed inset-0 z-50 bg-black">
      {/* Light rays background */}
      <div className="light-rays" />

      {/* Fire particles */}
      <div className="fire-flakes" aria-hidden="true">
        {Array.from({ length: 40 }).map((_, i) => {
          const left = 5 + Math.round(Math.random() * 90);
          const size = 4 + Math.round(Math.random() * 8);
          const delay = Math.random() * 2;
          const dur = 3 + Math.random() * 4;
          return (
            <span
              key={i}
              className="fire-flake"
              style={{
                left: `${left}%`,
                width: `${size}px`,
                height: `${size}px`,
                animationDelay: `${delay}s`,
                animationDuration: `${dur}s`,
                opacity: 0.6 + Math.random() * 0.4,
              }}
            />
          );
        })}
      </div>

      <div className="intro-inner max-w-7xl mx-auto w-full text-center text-white py-12 px-4">
        <h1 className="intro-heading text-5xl md:text-7xl font-bold mb-4 inline-block">
          {String('Our Artwork Collection').split('').map((ch, i) => (
            <span key={i} className="intro-letter inline-block" style={{ display: 'inline-block' }}>
              {ch === ' ' ? '\u00A0' : ch}
            </span>
          ))}
        </h1>
        <p className="intro-sub text-base text-white/60 mb-12 tracking-widest">curated categories</p>

        {/* Horizontal Swiper – one card per view */}
        <Swiper
          modules={[Mousewheel, EffectCards]}
          direction="horizontal"
          slidesPerView={1}
          spaceBetween={50}
          mousewheel={{
            sensitivity: 1,
            thresholdDelta: 20,
          }}
          speed={800}
          effect="cards"
          cardsEffect={{
            slideShadows: true,
            rotate: true,
            perSlideOffset: 15,
          }}
          grabCursor={true}
          centeredSlides={true}
          loop={false}
          onSwiper={(s) => { swiperInnerRef.current = s; }}
          className="intro-swiper"
        >
          {artworksList.map((art, idx) => {
            const imgSrc = getSafeImagesForCategory(art.category, 1, hashStringToUint32(art.category + idx))[0] || createColorfulFallback(idx);
            return (
              <SwiperSlide key={art.id}>
                <div
                  className="intro-card"
                  onClick={(e) => handleExpand(idx, e)}
                  onMouseMove={(e) => handleMouseMove(e, idx)}
                  onMouseLeave={(e) => handleMouseLeave(e, idx)}
                >
                  <div className="intro-card-image-wrapper">
                    <img
                      ref={el => imgRefs.current[idx] = el}
                      src={imgSrc}
                      alt={art.title}
                      className="intro-card-image"
                    />
                    <div className="intro-card-overlay" />
                  </div>
                  <div className="intro-card-content">
                    <span className="intro-card-number">
                      {String(idx + 1).padStart(2, '0')}/{String(artworksList.length).padStart(2, '0')}
                    </span>
                    <h2 className="intro-card-title">{art.title}</h2>
                    <p className="intro-card-category">{art.category}</p>
                  </div>
                </div>
              </SwiperSlide>
            );
          })}
        </Swiper>

        {/* Scroll hint */}
        <div className="intro-scroll-hint mt-8 text-white/30 text-sm tracking-widest">
          ← swipe to explore →
        </div>
      </div>
    </div>
  );
}

// ========== MAIN APP ==========
function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState('next');
  const [activeTile, setActiveTile] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const swiperRef = useRef(null);

  const shouldReduceMotion = useReducedMotion() || false;
  const headerRef = useRef(null);
  const titleRef = useRef(null);
  const mainContainerRef = useRef(null);
  const itemsRef = useRef([]);

  const isSmUp = useMediaQuery('(min-width: 640px)');
  const isMdUp = useMediaQuery('(min-width: 768px)');
  const isLgUp = useMediaQuery('(min-width: 1024px)');

  const imageCount = IMAGES_PER_SECTION;
  const masonryColumns = isLgUp ? 5 : isMdUp ? 4 : isSmUp ? 3 : 2;

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setRefreshKey(Date.now() + Math.random() * 1e6); }, []);

  useEffect(() => {
    if (!loading) return;
    const safety = window.setTimeout(() => setLoading(false), 2200);
    return () => window.clearTimeout(safety);
  }, [loading]);

  // ========== WHEEL EVENT HANDLING (unchanged) ==========
  useEffect(() => {
    if (!mounted || loading) return;
    const handleWheel = (e) => {
      if (e.target.closest('.collage-scroll')) e.stopPropagation();
    };
    document.addEventListener('wheel', handleWheel, { passive: true, capture: true });
    return () => document.removeEventListener('wheel', handleWheel, { capture: true });
  }, [mounted, loading]);

  // ========== SMOOTH TRACKPAD SUPPORT (unchanged) ==========
  useEffect(() => {
    if (!mounted || loading) return;
    let acc = 0, resetTimer = null;
    const container = document.querySelector('.swiper');
    const onWheelSmooth = (e) => {
      if (e.target.closest('.collage-scroll')) return;
      acc += e.deltaY;
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { acc = 0; }, 150);
      if (Math.abs(acc) >= 24 && swiperRef.current) {
        if (acc > 0) swiperRef.current.slideNext();
        else swiperRef.current.slidePrev();
        acc = 0;
      }
    };
    container?.addEventListener('wheel', onWheelSmooth, { passive: true });
    return () => container?.removeEventListener('wheel', onWheelSmooth);
  }, [mounted, loading]);

  // ========== DATA FOR CURRENT SLIDE ==========
  const currentArtwork = artworks[currentIndex];
  const sectionImages = useMemo(() => {
    try {
      const seed = hashStringToUint32(currentArtwork.category + currentIndex);
      return getSafeImagesForCategory(currentArtwork.category, imageCount, seed);
    } catch {
      return Array(imageCount).fill(0).map((_, i) => createColorfulFallback(i));
    }
  }, [currentArtwork.category, currentIndex, imageCount, refreshKey]);

  const captionPlan = useMemo(() => buildTitlePlan({
    sources: sectionImages,
    category: currentArtwork.category,
    seed: (currentIndex+1)*99173 + refreshKey
  }), [sectionImages, currentArtwork.category, currentIndex, refreshKey]);

  const masonryPlan = useMemo(() => buildMasonryColumns({
    sources: sectionImages,
    columns: masonryColumns,
    seed: (currentIndex+1)*4242 + refreshKey
  }), [sectionImages, masonryColumns, currentIndex, refreshKey]);

  // ========== ENHANCED ENTRANCE ANIMATIONS ==========
  useEffect(() => {
    if (!mounted || loading || !masonryPlan) return;
    const ctx = gsap.context(() => {
      const masterTl = gsap.timeline();
      
      // Clean header entrance
      masterTl.fromTo(headerRef.current, 
        { y: -50, opacity: 0, scale: 0.9 }, 
        { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(1.4)' }, 0
      );
      
      // Title with gentle 3D effect
      masterTl.fromTo(titleRef.current, 
        { scale: 0.8, opacity: 0, rotationX: 15 }, 
        { scale: 1, opacity: 1, rotationX: 0, duration: 1, ease: 'back.out(1.2)' }, 0.2
      );
      
      // Professional staggered tile entrance
      masterTl.fromTo('.masonry-item', 
        { 
          y: 40, 
          opacity: 0, 
          scale: 0.9, 
          rotationY: -10 
        }, 
        { 
          y: 0, 
          opacity: 1, 
          scale: 1, 
          rotationY: 0, 
          duration: 0.6, 
          stagger: { 
            amount: 1.2, 
            from: 'start', 
            ease: 'power2.out' 
          }, 
          ease: 'back.out(1.1)', 
          clearProps: 'transform' 
        }, 0.4
      );
      
      // Subtle background rotation
      masterTl.to('.art-bg', 
        { rotation: 360, scale: 1.1, duration: 60, repeat: -1, ease: 'none' }, 0
      );
    });
    return () => ctx.revert();
  }, [mounted, loading, masonryPlan, masonryColumns]);

  // ========== FRAMER MOTION PARALLAX SCROLL ==========
  const scrollRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ["start end", "end start"]
  });
  
  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const backgroundRotate = useTransform(scrollYProgress, [0, 1], [0, 5]);
  const backgroundScale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);



  // ========== ADDITION: GSAP SLIDE CHANGE ANIMATION ==========
  useEffect(() => {
    if (!mounted || loading) return;

    // Target only the items in the currently active slide
    const activeItems = document.querySelectorAll('.swiper-slide-active .masonry-item');
    if (!activeItems.length) return;

    // Subtle reveal for active items
    gsap.fromTo(activeItems,
      {
        scale: 0.95,
        opacity: 0,
        y: 20,
        filter: 'blur(2px)',
      },
      {
        scale: 1,
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.6,
        stagger: {
          amount: 0.5,
          from: 'start',
          ease: 'power2.out',
        },
        ease: 'power3.out',
        clearProps: 'transform, filter',
      }
    );
  }, [currentIndex, mounted, loading, masonryColumns]); // runs on every slide change

  // ========== MODAL FUNCTIONS ==========
  const openModal = (item) => {
    // Find the clicked tile element
    const clickedTile = itemsRef.current[item.index];
    
    if (clickedTile) {
      // Create smooth flip animation before opening modal
      const flipTl = gsap.timeline();
      flipTl.to(clickedTile, {
        rotationY: 15,
        scale: 0.98,
        duration: 0.2,
        ease: 'power2.in',
        transformOrigin: 'center center',
        onComplete: () => {
          // Set modal content
          setActiveTile({
            src: item.src,
            index: item.index,
            caption: captionPlan[item.index] ?? '',
            section: currentArtwork.title
          });
          
          // Animate modal entrance
          gsap.fromTo('.art-modal', 
            { scale: 0.8, opacity: 0, backdropFilter: 'blur(0px)' }, 
            { scale: 1, opacity: 1, backdropFilter: 'blur(15px)', duration: 0.5, ease: 'back.out(1.3)' }
          );
        }
      })
      .to(clickedTile, {
        rotationY: 0,
        scale: 1,
        duration: 0.3,
        ease: 'back.out(1.2)'
      });
    } else {
      // Fallback if tile ref not found
      setActiveTile({
        src: item.src,
        index: item.index,
        caption: captionPlan[item.index] ?? '',
        section: currentArtwork.title
      });
      gsap.fromTo('.art-modal', 
        { scale: 0.8, opacity: 0, backdropFilter: 'blur(0px)' }, 
        { scale: 1, opacity: 1, backdropFilter: 'blur(15px)', duration: 0.5, ease: 'back.out(1.3)' }
      );
    }
  };

  const closeModal = () => {
    gsap.to('.art-modal', { scale: 0.8, opacity: 0, backdropFilter: 'blur(0px)', duration: 0.3, ease: 'power2.in', force3D: true, onComplete: () => setActiveTile(null) });
  };

  // navigate modal images with swipe gestures
  const nextImage = useCallback(() => {
    const imgs = sectionImages || [];
    if (!activeTile) return;
    const nextIndex = (activeTile.index + 1) % imgs.length;
    setActiveTile(prev => prev ? ({ ...prev, index: nextIndex, src: imgs[nextIndex], caption: captionPlan[nextIndex] ?? '' }) : prev);
  }, [activeTile, sectionImages, captionPlan]);

  const prevImage = useCallback(() => {
    const imgs = sectionImages || [];
    if (!activeTile) return;
    const prevIndex = (activeTile.index - 1 + imgs.length) % imgs.length;
    setActiveTile(prev => prev ? ({ ...prev, index: prevIndex, src: imgs[prevIndex], caption: captionPlan[prevIndex] ?? '' }) : prev);
  }, [activeTile, sectionImages, captionPlan]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!mounted) return null;

  return (
    <>
      {loading && <LoadingScreen onComplete={() => setLoading(false)} />}

      {!loading && showIntro && (
        <StartingPage
          onSelectCategory={(idx) => {
            setCurrentIndex(idx);
            setShowIntro(false);
            setTimeout(() => { swiperRef.current?.slideTo(idx, 700); }, 80);
          }}
        />
      )}

      {!showIntro && (
      <div ref={mainContainerRef} className="h-screen w-screen overflow-hidden bg-stone-950">
        <div className="h-screen w-screen p-3 md:p-6">
          <main className="relative h-full w-full rounded-2xl overflow-hidden">
            <div className="absolute inset-0">
              <motion.div 
                className="art-bg" 
                style={{
                  y: backgroundY,
                  rotate: backgroundRotate,
                  scale: backgroundScale
                }}
              />
              {/* Canvas particle system — colour synced to current slide accent */}
              <ParticleCanvas accentColor={SLIDE_ACCENTS[currentIndex % SLIDE_ACCENTS.length]} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20" />
            </div>

            <div className="relative z-10 h-full">
              {/* Back button (visible only when intro is hidden) */}
              {!showIntro && (
                <div className="absolute top-3 left-3 z-20">
                  <button
                    onClick={() => setShowIntro(true)}
                    className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-sm"
                    aria-label="Back to categories"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Main Swiper – unchanged */}
              <Swiper
                modules={[Mousewheel, EffectCreative]}
                effect="creative"
                creativeEffect={{
                  prev: {
                    shadow: true,
                    translate: ['-20%', 0, -400],
                    scale: 0.8,
                    opacity: 0,
                  },
                  next: {
                    translate: ['100%', 0, 0],
                    opacity: 0,
                  },
                }}
                direction="horizontal"
                slidesPerView={1}
                spaceBetween={0}
                mousewheel={{ sensitivity: 0.8, thresholdDelta: 1, thresholdTime: 60, releaseOnEdges: true, forceToAxis: true }}
                speed={820}
                touchRatio={1.2}
                threshold={2}
                touchAngle={45}
                longSwipesRatio={0.2}
                shortSwipes={true}
                longSwipes={true}
                resistanceRatio={0.6}
                followFinger={true}
                simulateTouch={true}
                allowTouchMove={true}
                onSwiper={(swiper) => { swiperRef.current = swiper; }}
                onSlideChange={(swiper) => {
                  setCurrentIndex(swiper.activeIndex);
                  setDirection(swiper.activeIndex > currentIndex ? 'next' : 'prev');
                }}
                className="h-full w-full"
              >
                {artworks.map((artwork, idx) => {
                  const seed = hashStringToUint32(artwork.category + idx);
                  const images = getSafeImagesForCategory(artwork.category, imageCount, seed);
                  const captions = buildTitlePlan({ sources: images, category: artwork.category, seed: (idx+1)*99173 + refreshKey });
                  const masonry = buildMasonryColumns({ sources: images, columns: masonryColumns, seed: (idx+1)*4242 + refreshKey });
                  return (
                    <SwiperSlide key={artwork.id}>
                      <div className="h-full flex flex-col">
                        <div ref={idx === 0 ? headerRef : null} className="shrink-0 pt-12 sm:pt-6 md:pt-3 pb-2 sm:pb-1 px-3">
                          <motion.div ref={idx === 0 ? titleRef : null} className="text-white/95 text-xl sm:text-2xl md:text-4xl font-semibold tracking-wide text-center drop-shadow pointer-events-none" animate={{ textShadow: ['0 0 20px rgba(255,255,255,0.3)', '0 0 40px rgba(255,255,255,0.6)', '0 0 20px rgba(255,255,255,0.3)'] }} transition={{ duration: 4, repeat: Infinity }}>
                            Our Artwork Collection
                          </motion.div>
                          <AnimatePresence mode="wait">
                            {/* Word-by-word spring stagger — each word flies up with slight rotate */}
                            <motion.div
                              key={artwork.id}
                              className="mt-2 flex flex-wrap justify-center gap-x-[0.3em] pointer-events-none"
                              initial="hidden" animate="visible" exit="exit"
                            >
                              {artwork.title.split(' ').map((word, wi) => (
                                <motion.span
                                  key={word + wi}
                                  className="text-white/70 text-xs sm:text-sm md:text-base font-medium tracking-[0.22em] uppercase inline-block overflow-hidden"
                                  variants={{
                                    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 18, rotate: shouldReduceMotion ? 0 : -5, filter: shouldReduceMotion ? 'none' : 'blur(4px)' },
                                    visible: { opacity: 1, y: 0, rotate: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 280, damping: 22, delay: wi * 0.07 } },
                                    exit: { opacity: 0, y: shouldReduceMotion ? 0 : -10, transition: { duration: 0.18, delay: wi * 0.03 } },
                                  }}
                                >
                                  {word}
                                </motion.span>
                              ))}
                            </motion.div>
                          </AnimatePresence>
                        </div>
                        <div ref={scrollRef} className="collage-scroll flex-1" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
                          {/* Use CSS multi-column masonry for denser packing */}
                          <div className="masonry-columns" style={{ columnCount: masonryColumns, columnGap: '12px' }}>
                            {masonry.flat().map((item, index) => (
                              <motion.div
                                ref={el => { if (idx === currentIndex) itemsRef.current[item.index] = el; }}
                                key={`${artwork.id}-${item.uniqueId}`}
                                className={`masonry-item art-tile ${item.ratio}`}
                                onClick={() => { if (idx === currentIndex) openModal({ ...item, caption: captions[item.index] }); }}
                                role="button" tabIndex={0}
                                onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); if (idx === currentIndex) openModal({ ...item, caption: captions[item.index] }); } }}
                                style={{ display: 'inline-block', width: '100%' }}
                                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                animate={{ 
                                  opacity: 1, 
                                  y: 0, 
                                  scale: 1,
                                  transition: { 
                                    delay: index * 0.05,
                                    duration: 0.4,
                                    ease: [0.25, 0.46, 0.45, 0.94]
                                  }
                                }}
                                whileHover={{ 
                                  y: -4, 
                                  scale: 1.02,
                                  boxShadow: "0 12px 25px -8px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.15)",
                                  transition: { 
                                    duration: 0.3, 
                                    ease: "easeOut"
                                  }
                                }}
                                whileTap={{ 
                                  scale: 0.98,
                                  transition: { duration: 0.15, ease: "easeInOut" }
                                }}
                              >
                              <TileImage src={item.src} alt={artwork.title} index={item.index} fallbackPool={images} />
                                {/* Enhanced gradient overlay for better text readability - always visible */}
                                <motion.div 
                                  className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/90 via-black/50 to-transparent"
                                  initial={{ opacity: 1, scaleY: 1 }}
                                  whileHover={{ 
                                    opacity: 1, 
                                    scaleY: 1.02,
                                    transition: { duration: 0.3, ease: "easeOut" }
                                  }}
                                />
                                {/* Enhanced caption with always visible titles */}
                                <motion.div 
                                  className="pointer-events-none absolute left-3 right-3 bottom-3"
                                  initial={{ y: 0, opacity: 1, scale: 1 }}
                                  whileHover={{ 
                                    y: -3, 
                                    opacity: 1, 
                                    scale: 1.02,
                                    transition: { 
                                      duration: 0.3, 
                                      ease: "easeOut",
                                      type: "spring",
                                      stiffness: 200,
                                      damping: 25
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-3 bg-black/50 backdrop-blur-md rounded-lg px-4 py-2.5 border border-white/15 shadow-lg">
                                    <motion.svg 
                                      width="16" 
                                      height="16" 
                                      viewBox="0 0 24 24" 
                                      fill="none" 
                                      stroke="currentColor" 
                                      strokeWidth="2" 
                                      className="text-white/95 flex-shrink-0"
                                      whileHover={{ scale: 1.1, rotate: 8 }}
                                    >
                                      <path d="M12 22s7-5.3 7-12a7 7 0 10-14 0c0 6.7 7 12 7 12z" />
                                      <path d="M12 13.2a3.2 3.2 0 110-6.4 3.2 3.2 0 010 6.4z" />
                                    </motion.svg>
                                    <div className="text-sm md:text-base text-white font-semibold tracking-wide line-clamp-2 leading-relaxed drop-shadow-sm">
                                      {captions[item.index] ?? 'Untitled Artwork'}
                                    </div>
                                  </div>
                                </motion.div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </SwiperSlide>
                  );
                })}
              </Swiper>

              {/* Pagination dots (unchanged) */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20 pointer-events-none">
                {artworks.map((_, idx) => (
                  <motion.div
                    key={idx}
                    className={`rounded-full transition-all duration-300 relative ${
                      idx === currentIndex ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/35'
                    }`}
                    animate={idx === currentIndex
                      ? { scale: [1, 1.15, 1], boxShadow: ['0 0 0px 0px rgba(255,255,255,0.4)', '0 0 10px 4px rgba(255,255,255,0.55)', '0 0 0px 0px rgba(255,255,255,0.4)'] }
                      : { scale: 1, boxShadow: 'none' }
                    }
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ))}
              </div>

              {/* Modal (unchanged) */}
              <AnimatePresence>
                {activeTile && (
                  <motion.div
                    className="art-modal"
                    initial={{ opacity:0, scale:0.8, backdropFilter: 'blur(0px)' }}
                    animate={{ opacity:1, scale:1, backdropFilter: 'blur(12px)' }}
                    exit={{ opacity:0, scale:0.8, backdropFilter: 'blur(0px)' }}
                    transition={{ duration:0.4, ease:'backOut' }}
                    onClick={closeModal} role="dialog" aria-modal="true"
                  >
                    <motion.div
                      className="art-modal-panel"
                      initial={shouldReduceMotion ? { opacity:1 } : { opacity:0, y: 50, scale: 0.8, rotate: -3 }}
                      animate={shouldReduceMotion ? { opacity:1 } : { opacity:1, y: 0, scale: 1, rotate: 0 }}
                      transition={shouldReduceMotion ? {} : { type: 'spring', stiffness: 340, damping: 22, delay: 0.08 }}
                      exit={shouldReduceMotion ? { opacity:0 } : { opacity:0, y: 28, scale: 0.88, rotate: 2, transition: { duration: 0.28, ease: 'power2.in' } }}
                      onClick={e => e.stopPropagation()}
                    >
                      <motion.div className="art-hanger" aria-hidden="true" animate={{ rotate: [0, -5, 5, 0], y: [0, -2, 2, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
                        <div className="art-hanger-line" />
                        <div className="art-hanger-knot" />
                      </motion.div>
                      <motion.button className="art-modal-close" onClick={closeModal} aria-label="Close" whileHover={{ scale: 1.2, rotate: 90 }} whileTap={{ scale: 0.9 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </motion.button>
                      <div className="art-modal-frame">
                        <motion.img
                          src={activeTile.src}
                          alt={activeTile.section}
                          className="art-modal-img"
                          loading="eager"
                          fetchpriority="high"
                          initial={{ scale: 1.3, opacity: 0, filter: 'blur(20px)' }}
                          animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                          transition={{ duration: 0.6, delay: 0.2, ease: 'power3.out', force3D: true }}
                          drag="x"
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={0.18}
                          whileTap={{ scale: 0.995 }}
                          onPanEnd={(e, info) => {
                            // swipe left => next, swipe right => prev
                            if (info.offset.x < -40) nextImage();
                            else if (info.offset.x > 40) prevImage();
                          }}
                          onLoad={e => e.currentTarget.classList.add('is-loaded')}
                          onError={e => e.currentTarget.src = createColorfulFallback(Date.now())}
                        />
                        <motion.div className="art-modal-meta" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4, delay: 0.4 }}>
                          <div className="art-modal-section">{activeTile.section}</div>
                          <div className="art-modal-caption">{activeTile.caption}</div>
                        </motion.div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
      )}
    </>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);