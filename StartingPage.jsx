import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { getSafeImagesForCategory } from './artworksData.js';

// One curated cover image per category — clearly distinct & visually relevant
const CATEGORY_COVERS = {
  'Landscape':         'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=85&auto=format',
  'Abstract':          'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1200&q=85&auto=format',
  'Portrait':          'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1200&q=85&auto=format',
  'Conceptual':        'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=1200&q=85&auto=format',
  'Figurative':        'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=1200&q=85&auto=format',
  'Urban abstraction': 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=85&auto=format',
};

const categories = [
  { idx: 0, title: 'Landscape',         subtitle: "Nature's Canvas",     category: 'Landscape',         accent: '#3b82f6' },
  { idx: 1, title: 'Abstract',           subtitle: 'Forms & Imagination', category: 'Abstract',           accent: '#a855f7' },
  { idx: 2, title: 'Portrait',           subtitle: 'Human Stories',       category: 'Portrait',           accent: '#10b981' },
  { idx: 3, title: 'Conceptual',         subtitle: 'Ideas Made Visual',   category: 'Conceptual',         accent: '#ef4444' },
  { idx: 4, title: 'Figurative',         subtitle: 'Body & Movement',     category: 'Figurative',         accent: '#f59e0b' },
  { idx: 5, title: 'Urban abstraction',  subtitle: 'City Geometry',       category: 'Urban abstraction',  accent: '#6366f1' },
];

const BLOB_COLORS = [
  'rgba(59,130,246,0.12)', 'rgba(168,85,247,0.12)', 'rgba(16,185,129,0.11)',
  'rgba(239,68,68,0.11)',  'rgba(245,158,11,0.11)', 'rgba(99,102,241,0.12)',
];

const headingEnter = [
  { x: -80, opacity: 0, filter: 'blur(8px)' },
  { x:  80, opacity: 0, filter: 'blur(8px)' },
  { x: -60, opacity: 0, scale: 0.88 },
  { x:  60, opacity: 0, scale: 0.88 },
  { x: -100, opacity: 0 },
  { x:  100, opacity: 0, letterSpacing: '0.4em' },
];

/* SVG icon: octagonal lens / gallery mark */
function GalleryMark({ accent = '#fff' }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <polygon
        points="16,2 26,7 30,18 26,29 16,30 6,29 2,18 6,7"
        stroke={accent}
        strokeWidth="1.2"
        fill="none"
        opacity="0.55"
      />
      <circle cx="16" cy="16" r="5" stroke={accent} strokeWidth="1.4" fill="none" opacity="0.85" />
      <circle cx="16" cy="16" r="1.5" fill={accent} opacity="0.9" />
    </svg>
  );
}

/* Animated electric bolt SVG overlay */
function LightningBolts({ accent }) {
  return (
    <svg className="lightning-bolts-svg" viewBox="0 0 520 110" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {/* ── Left side bolts ── */}
      <polyline className="bolt bolt-left"  points="55,55 75,22 88,48 112,4"   stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
      <polyline className="bolt bolt-left2" points="20,70 38,42 50,60 68,20"   stroke={accent} strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
      {/* ── Right side bolts ── */}
      <polyline className="bolt bolt-right"  points="465,55 445,22 432,48 408,4"  stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
      <polyline className="bolt bolt-right2" points="500,70 482,42 470,60 452,20" stroke={accent} strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
      {/* ── Arcing bridges from bolts to heading ── */}
      <path className="bolt bolt-arc-l" d="M112,4 Q140,2 190,50" stroke={accent} strokeWidth="0.7" fill="none" opacity="0.25" strokeDasharray="4 3" />
      <path className="bolt bolt-arc-r" d="M408,4 Q380,2 330,50" stroke={accent} strokeWidth="0.7" fill="none" opacity="0.25" strokeDasharray="4 3" />
      {/* ── Sparkle nodes ── */}
      <circle className="spark s1" cx="112" cy="4"   r="3"   fill={accent} opacity="0.85" />
      <circle className="spark s2" cx="408" cy="4"   r="3"   fill={accent} opacity="0.85" />
      <circle className="spark s3" cx="55"  cy="55"  r="2"   fill={accent} opacity="0.5" />
      <circle className="spark s4" cx="465" cy="55"  r="2"   fill={accent} opacity="0.5" />
      <circle className="spark s5" cx="68"  cy="20"  r="1.5" fill={accent} opacity="0.6" />
      <circle className="spark s6" cx="452" cy="20"  r="1.5" fill={accent} opacity="0.6" />
      {/* ── Horizontal rays extending to edges ── */}
      <line className="hray" x1="0"   y1="55" x2="55"  y2="55" stroke={accent} strokeWidth="0.7" opacity="0.22" />
      <line className="hray" x1="465" y1="55" x2="520" y2="55" stroke={accent} strokeWidth="0.7" opacity="0.22" />
      <line className="hray" x1="0"   y1="70" x2="20"  y2="70" stroke={accent} strokeWidth="0.5" opacity="0.12" />
      <line className="hray" x1="500" y1="70" x2="520" y2="70" stroke={accent} strokeWidth="0.5" opacity="0.12" />
    </svg>
  );
}

export default function StartingPage({ onSelectCategory }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [direction,  setDirection]  = useState(0);
  const containerRef = useRef(null);
  const imgRef       = useRef(null);
  const isScrolling  = useRef(false);
  const touchStart   = useRef({ y: 0, x: 0, t: 0 });

  const flakes = useMemo(() => {
    const count = 55;
    return Array.from({ length: count }, (_, i) => ({
      left:     `${(i / count) * 98 + 1}%`,
      width:    `${3 + (i % 7) * 1.8}px`,
      duration: `${6 + (i % 9) * 1.1}s`,
      delay:    `${(i * 0.38) % 10}s`,
      drift:    `${(i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0) * (10 + (i % 4) * 5)}px`,
      opacity:  `${0.55 + (i % 5) * 0.09}`,
    }));
  }, []);

  const coverImages = useMemo(() =>
    categories.map((item) => CATEGORY_COVERS[item.category] || getSafeImagesForCategory(item.category, 1, 991)[0]),
    []);

  const navigate = useCallback((dir) => {
    if (isScrolling.current) return;
    const next = currentIdx + dir;
    if (next < 0 || next >= categories.length) return;
    isScrolling.current = true;
    setDirection(dir);
    setCurrentIdx(next);
    setTimeout(() => { isScrolling.current = false; }, 350);
  }, [currentIdx]);

  useEffect(() => {
    let acc = 0, locked = false, timeout;
    const onWheel = (e) => {
      e.preventDefault();
      if (locked) return;
      acc += e.deltaY + e.deltaX;
      if (Math.abs(acc) > 18) {
        locked = true;
        navigate(acc > 0 ? 1 : -1);
        acc = 0;
        setTimeout(() => { locked = false; }, 380);
      }
      clearTimeout(timeout);
      timeout = setTimeout(() => { acc = 0; }, 150);
    };
    const el = containerRef.current;
    el?.addEventListener('wheel', onWheel, { passive: false });
    return () => { el?.removeEventListener('wheel', onWheel); clearTimeout(timeout); };
  }, [currentIdx, navigate]);

  useEffect(() => {
    let swiped = false;
    const onStart = (e) => {
      swiped = false;
      touchStart.current = { y: e.touches[0].clientY, x: e.touches[0].clientX, t: Date.now() };
    };
    const onMove = (e) => {
      if (swiped) return;
      const dx = touchStart.current.x - e.touches[0].clientX;
      const dy = touchStart.current.y - e.touches[0].clientY;
      if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) {
        swiped = true;
        navigate(dy > 0 ? 1 : -1);
      }
    };
    const onEnd = (e) => {
      if (swiped) return;
      const dy = touchStart.current.y - e.changedTouches[0].clientY;
      const dt = Math.max(Date.now() - touchStart.current.t, 1);
      if (Math.abs(dy) > 10 || Math.abs(dy) / dt > 0.08) {
        navigate(dy > 0 ? 1 : -1);
      }
    };
    const el = containerRef.current;
    el?.addEventListener('touchstart', onStart, { passive: true });
    el?.addEventListener('touchmove',  onMove,  { passive: true });
    el?.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      el?.removeEventListener('touchstart', onStart);
      el?.removeEventListener('touchmove', onMove);
      el?.removeEventListener('touchend', onEnd);
    };
  }, [currentIdx, navigate]);

  useEffect(() => {
    const onKey = (e) => {
      if (['ArrowDown','ArrowRight'].includes(e.key)) navigate(1);
      if (['ArrowUp','ArrowLeft'].includes(e.key))   navigate(-1);
      if (['Enter',' '].includes(e.key)) onSelectCategory(currentIdx);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIdx, navigate, onSelectCategory]);

  const cardVariants = {
    enter: (d) => ({
      rotateX: 0,
      y: d > 0 ? '60px' : '-60px',
      opacity: 0,
      scale: 1,
      filter: 'brightness(1)',
    }),
    center: {
      rotateX: 0,
      y: '0px',
      opacity: 1,
      scale: 1,
      filter: 'brightness(1)',
    },
    exit: (d) => ({
      rotateX: 0,
      y: d > 0 ? '-60px' : '60px',
      opacity: 0,
      scale: 1,
      filter: 'brightness(1)',
    }),
  };

  const hEnter = headingEnter[currentIdx % headingEnter.length];
  const accent = categories[currentIdx].accent;

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden bg-black" style={{ touchAction: 'none' }}>

      {/* ── Full-screen dynamic background — changes with each category ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">

        {/* Each category image as a full-screen blurred backdrop — only active one is visible */}
        {coverImages.map((src, i) => (
          <motion.div
            key={i}
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${src})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(22px) saturate(1.4) brightness(0.75)',
              transform: 'scale(1.12)',
            }}
            animate={{ opacity: i === currentIdx ? 1 : 0 }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
          />
        ))}

        {/* Deep vignette — darkens edges, keeps centre bright */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse 75% 75% at 50% 50%, transparent 30%, rgba(0,0,0,0.7) 100%)',
        }} />

        {/* Top & bottom dark bars so heading and nav are readable */}
        <div className="absolute inset-x-0 top-0 h-40" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)' }} />
        <div className="absolute inset-x-0 bottom-0 h-40" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }} />

        {/* Animated accent colour pulse in centre */}
        <motion.div
          className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse 60% 60% at 50% 50%, ${accent}30, transparent 70%)` }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          key={`pulse-${currentIdx}`}
        />

        {/* Slow-rotating diagonal light streak */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(115deg, transparent 30%, ${accent}18 50%, transparent 70%)`,
          }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2 }}
        />
      </div>

      {/* ── Fire flakes rising from bottom ── */}
      <div className="fire-flakes z-10" aria-hidden="true">
        {flakes.map((f, i) => (
          <div key={i} className="fire-flake" style={{ left: f.left, width: f.width, height: f.width, animationDuration: f.duration, animationDelay: f.delay, marginLeft: f.drift, opacity: f.opacity }} />
        ))}
      </div>


      {/* ══════════════════════════════════════════
          HEADING — pinned to top, black bar
      ══════════════════════════════════════════ */}
      <div className="absolute top-0 left-0 right-0 z-30 flex flex-col items-center px-4 sp-heading-bar"
        style={{
          paddingTop: 'clamp(18px, 3vh, 28px)',
          paddingBottom: '12px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0.85) 85%, transparent 100%)',
        }}>        {/* ── Top-edge glow line ── */}
        <div className="sp-heading-topline" style={{ background: `linear-gradient(90deg, transparent 0%, ${accent}99 30%, ${accent} 50%, ${accent}99 70%, transparent 100%)` }} />
        {/* ── Side accent streaks ── */}
        <div className="sp-heading-streak sp-heading-streak-l" style={{ background: `linear-gradient(180deg, ${accent}88, transparent)` }} />
        <div className="sp-heading-streak sp-heading-streak-r" style={{ background: `linear-gradient(180deg, ${accent}88, transparent)` }} />

        {/* Lightning SVG bolts flanking heading */}
        <div className="relative w-full flex justify-center">
          <AnimatePresence mode="wait">
            <motion.div key={`lightning-${currentIdx}`}
              className="sp-lightning-wrap"
              initial={{ opacity: 0, scaleX: 0.6 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0, scaleX: 0.5 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
              <LightningBolts accent={accent} />
            </motion.div>
          </AnimatePresence>

          {/* Heading text */}
          <AnimatePresence mode="wait">
            <motion.h1
              key={`h-${currentIdx}`}
              className="lightning-rays font-black text-white uppercase select-none text-center relative z-10"
              style={{
                fontSize: 'clamp(1rem, 3vw, 1.85rem)',
                letterSpacing: 'clamp(0.06em, 0.8vw, 0.14em)',
                lineHeight: 1.15,
                '--accent': accent,
              }}
              initial={{ ...hEnter }}
              animate={{ x: 0, y: 0, opacity: 1, scale: 1, filter: 'blur(0px)', rotateX: 0, letterSpacing: 'clamp(0.06em, 0.8vw, 0.14em)' }}
              exit={{ opacity: 0, y: direction > 0 ? -30 : 30, filter: 'blur(6px)', transition: { duration: 0.2 } }}
              transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
            >
              Our Artwork Collections
            </motion.h1>
          </AnimatePresence>
        </div>

        {/* Animated underline */}
        <AnimatePresence mode="wait">
          <motion.div key={`line-${currentIdx}`}
            className="mx-auto mt-1.5 h-[2px] rounded-full"
            style={{ width: 'clamp(40px, 12vw, 120px)', background: `linear-gradient(90deg,transparent,${accent}cc,transparent)` }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ scaleX: 0, opacity: 0 }}
            transition={{ duration: 0.55, delay: 0.15, ease: [0.22, 1, 0.36, 1] }} />
        </AnimatePresence>
      </div>

      {/* ══════════════════════════════════════════
          MAIN CONTENT AREA
      ══════════════════════════════════════════ */}
      <div className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ paddingLeft: '14px', paddingRight: '14px', paddingTop: 'clamp(80px, 12vh, 110px)', paddingBottom: 'clamp(36px, 5vh, 52px)' }}>

        <div className="relative z-10 w-full" style={{ maxWidth: 'min(820px, 94vw)' }}>

          {/* ── Scroll card ── */}
          <div>
            <AnimatePresence custom={direction} initial={false} mode="wait">
              <motion.div key={currentIdx} custom={direction}
                variants={cardVariants} initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{ willChange: 'transform, opacity' }}>

                <motion.div
                  className="relative cursor-pointer select-none overflow-hidden sp-card"
                  style={{
                    aspectRatio: '16/9',
                    borderRadius: '18px',
                    border: `1px solid ${accent}44`,
                    boxShadow: `0 40px 100px rgba(0,0,0,0.98), 0 0 0 1px rgba(0,0,0,0.8), 0 0 90px ${accent}28, inset 0 1px 0 rgba(255,255,255,0.09)`,
                  }}
                  onClick={() => onSelectCategory(categories[currentIdx].idx)}
                  whileTap={{ scale: 0.975 }}
                  onMouseMove={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    const x = (e.clientX - r.left) / r.width - 0.5;
                    const y = (e.clientY - r.top)  / r.height - 0.5;
                    gsap.to(e.currentTarget, { rotateY: x * 6, rotateX: y * -6, scale: 1.015, duration: 0.5, ease: 'power2.out', transformPerspective: 1400 });
                    if (imgRef.current) gsap.to(imgRef.current, { x: x * 9, y: y * 6, duration: 0.6, ease: 'power2.out' });
                  }}
                  onMouseLeave={(e) => {
                    gsap.to(e.currentTarget, { rotateY: 0, rotateX: 0, scale: 1, duration: 0.65, ease: 'power2.out', transformPerspective: 1400 });
                    if (imgRef.current) gsap.to(imgRef.current, { x: 0, y: 0, duration: 0.65, ease: 'power2.out' });
                  }}>

                  {/* Cover image with parallax */}
                  <div ref={imgRef} className="absolute inset-0 bg-cover bg-center will-change-transform"
                    style={{ backgroundImage: `url(${coverImages[currentIdx]})`, transformOrigin: 'center center', transform: 'scale(1.06)' }} />

                  {/* Overlay stack */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent pointer-events-none" />
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, transparent 52%, rgba(0,0,0,0.45) 100%)' }} />
                  {/* Accent colour wash */}
                  <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 80% 80%, ${accent}18, transparent 65%)` }} />

                  {/* Scanline micro-texture */}
                  <div className="sp-scanlines absolute inset-0 pointer-events-none" />

                  {/* ── Card inscription bottom-left ── */}
                  <AnimatePresence custom={direction} initial={false} mode="wait">
                    <motion.div key={`txt-${currentIdx}`} custom={direction}
                      initial={(d) => ({ y: d > 0 ? 50 : -50, opacity: 0 })}
                      animate={{ y: 0, opacity: 1, transition: { delay: 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
                      exit={(d) => ({ y: d > 0 ? -40 : 40, opacity: 0, transition: { duration: 0.18 } })}
                      className="absolute bottom-0 left-0 right-0 z-10"
                      style={{ padding: 'clamp(12px, 2.5vw, 28px) clamp(14px, 3.5vw, 36px)' }}>

                      {/* Collection index badge */}
                      <motion.p
                        className="uppercase font-bold mb-1"
                        style={{ fontSize: 'clamp(0.65rem, 1.4vw, 0.78rem)', letterSpacing: '0.28em', color: 'rgba(255,255,255,0.75)', textShadow: '0 1px 8px rgba(0,0,0,1)' }}
                        initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.36, duration: 0.4 }}>
                        {String(currentIdx + 1).padStart(2, '0')} / {String(categories.length).padStart(2, '0')} — Collection
                      </motion.p>

                      {/* Category title */}
                      <motion.h2
                        className="font-black text-white leading-tight"
                        style={{ fontSize: 'clamp(1.4rem, 4vw, 2.4rem)', textShadow: '0 2px 24px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,1)', letterSpacing: '-0.01em' }}
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }}>
                        {categories[currentIdx].title}
                      </motion.h2>

                      {/* Subtitle */}
                      <motion.p
                        className="font-semibold mt-1.5"
                        style={{ fontSize: 'clamp(0.7rem, 1.4vw, 0.85rem)', color: 'rgba(255,255,255,0.82)', textShadow: '0 1px 8px rgba(0,0,0,1)', letterSpacing: '0.18em' }}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48, duration: 0.42 }}>
                        {categories[currentIdx].subtitle}
                      </motion.p>

                      {/* CTA button */}
                      <motion.button
                        onClick={(e) => { e.stopPropagation(); onSelectCategory(categories[currentIdx].idx); }}
                        className="mt-4 inline-flex items-center gap-2 rounded-full font-bold tracking-wider shadow-2xl sp-cta-btn"
                        style={{
                          padding: 'clamp(7px, 1.1vh, 12px) clamp(16px, 2.8vw, 28px)',
                          fontSize: 'clamp(0.72rem, 1.3vw, 0.82rem)',
                          background: 'rgba(255,255,255,0.96)',
                          color: '#0a0a0a',
                          border: `1px solid ${accent}55`,
                          boxShadow: `0 0 22px ${accent}55`,
                        }}
                        initial={{ opacity: 0, scale: 0.82 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.56, duration: 0.4 }}
                        whileHover={{ scale: 1.07, x: 4, boxShadow: `0 0 32px ${accent}88` }}
                        whileTap={{ scale: 0.94 }}>
                        Explore Collection
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </motion.button>
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Progress bar + dots ── */}
          <AnimatePresence mode="wait">
            <motion.div key={`bar-${currentIdx}`}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ delay: 0.3, duration: 0.44 }}
              className="mt-4 flex items-center justify-between px-1">

              {/* Dot selector */}
              <div className="flex gap-2 items-center">
                {categories.map((cat, i) => (
                  <button key={i}
                    onClick={() => { setDirection(i > currentIdx ? 1 : -1); setCurrentIdx(i); }}
                    aria-label={`Go to ${cat.title}`}
                    className="transition-all duration-300 rounded-full"
                    style={{
                      width: i === currentIdx ? '28px' : '6px',
                      height: '5px',
                      background: i === currentIdx ? accent : 'rgba(255,255,255,0.2)',
                      boxShadow: i === currentIdx ? `0 0 10px ${accent}88` : 'none',
                    }} />
                ))}
              </div>

              {/* counter */}
              <span className="font-mono text-white/40 select-none" style={{ fontSize: '0.62rem', letterSpacing: '0.2em' }}>
                {String(currentIdx + 1).padStart(2,'0')}&nbsp;/&nbsp;{String(categories.length).padStart(2,'0')}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>


      {/* ── Swipe / navigate hint (first slide only) ── */}
      {currentIdx === 0 && (
        <motion.div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 select-none z-40"
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}>
          {}
          <div className="sp-scroll-ring" style={{ borderColor: `${accent}55` }}>
            <div className="sp-scroll-ring-dot" style={{ background: accent }} />
          </div>
          <span className="text-white/28 uppercase" style={{ fontSize: '0.55rem', letterSpacing: '0.32em' }}>Scroll</span>
        </motion.div>
      )}
    </div>
  );
}

