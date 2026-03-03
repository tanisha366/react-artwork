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
  { idx: 0, title: 'Landscape',         subtitle: "Nature's Canvas",     category: 'Landscape' },
  { idx: 1, title: 'Abstract',           subtitle: 'Forms & Imagination', category: 'Abstract' },
  { idx: 2, title: 'Portrait',           subtitle: 'Human Stories',       category: 'Portrait' },
  { idx: 3, title: 'Conceptual',         subtitle: 'Ideas Made Visual',   category: 'Conceptual' },
  { idx: 4, title: 'Figurative',         subtitle: 'Body & Movement',     category: 'Figurative' },
  { idx: 5, title: 'Urban abstraction',  subtitle: 'City Geometry',       category: 'Urban abstraction' },
];

const headingEnter = [
  { x: -90, opacity: 0, filter: 'blur(12px)' },
  { x:  90, opacity: 0, scale: 0.78 },
  { y: -55, opacity: 0, rotateX: -28 },
  { y:  55, opacity: 0, rotateX:  28 },
  { scale: 1.55, opacity: 0, filter: 'blur(16px)' },
  { opacity: 0, letterSpacing: '0.6em' },
];

export default function StartingPage({ onSelectCategory }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [direction,  setDirection]  = useState(0);
  const containerRef = useRef(null);
  const imgRef       = useRef(null);
  const isScrolling  = useRef(false);
  const touchStart   = useRef({ y: 0, x: 0, t: 0 });
  const morphTimer   = useRef(null);

  const flakes = useMemo(() => {
    const count = 28;
    return Array.from({ length: count }, (_, i) => ({
      left:     `${(i / count) * 96 + 2}%`,
      width:    `${5 + (i % 5) * 3}px`,
      duration: `${6 + (i % 7) * 1.4}s`,
      delay:    `${(i * 0.55) % 9}s`,
      drift:    `${(i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0) * 14}px`,
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
    setTimeout(() => { isScrolling.current = false; }, 980);
  }, [currentIdx]);

  const applyMorph = useCallback((v) => {
    if (!imgRef.current) return;
    const s = 1 + Math.min(Math.abs(v) * 0.0005, 0.08);
    gsap.to(imgRef.current, { scaleY: s, scaleX: 1 / s, duration: 0.16, ease: 'power2.out', overwrite: true });
    clearTimeout(morphTimer.current);
    morphTimer.current = setTimeout(() =>
      gsap.to(imgRef.current, { scaleY: 1, scaleX: 1, duration: 1.1, ease: 'elastic.out(1,0.42)', overwrite: true }), 170);
  }, []);

  useEffect(() => {
    let acc = 0, t;
    const onWheel = (e) => {
      e.preventDefault();
      acc += e.deltaY + e.deltaX;
      applyMorph(e.deltaY + e.deltaX);
      clearTimeout(t);
      t = setTimeout(() => { if (Math.abs(acc) > 10) navigate(acc > 0 ? 1 : -1); acc = 0; }, 28);
    };
    const el = containerRef.current;
    el?.addEventListener('wheel', onWheel, { passive: false });
    return () => { el?.removeEventListener('wheel', onWheel); clearTimeout(t); };
  }, [currentIdx, navigate, applyMorph]);

  useEffect(() => {
    const onStart = (e) => { touchStart.current = { y: e.touches[0].clientY, x: e.touches[0].clientX, t: Date.now() }; };
    const onMove  = (e) => applyMorph((touchStart.current.y - e.touches[0].clientY) * 2);
    const onEnd   = (e) => {
      const dy = touchStart.current.y - e.changedTouches[0].clientY;
      const dx = touchStart.current.x - e.changedTouches[0].clientX;
      const dt = Date.now() - touchStart.current.t;
      if (Math.max(Math.abs(dy), Math.abs(dx)) > 25 || Math.abs(dy) / dt > 0.25)
        navigate(dy > 0 || dx > 0 ? 1 : -1);
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
  }, [currentIdx, navigate, applyMorph]);

  useEffect(() => {
    const onKey = (e) => {
      if (['ArrowDown','ArrowRight'].includes(e.key)) { applyMorph(80); navigate(1); }
      if (['ArrowUp','ArrowLeft'].includes(e.key))    { applyMorph(-80); navigate(-1); }
      if (['Enter',' '].includes(e.key)) onSelectCategory(currentIdx);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIdx, navigate, applyMorph, onSelectCategory]);

  const cardVariants = {
    enter:  (d) => ({ rotateY: d > 0 ? 72 : -72, opacity: 0, scale: 0.88, x: d > 0 ? '10%' : '-10%', filter: 'brightness(0.45)' }),
    center: {       rotateY: 0, opacity: 1, scale: 1, x: '0%', filter: 'brightness(1)' },
    exit:   (d) => ({ rotateY: d > 0 ? -72 : 72, opacity: 0, scale: 0.88, x: d > 0 ? '-10%' : '10%', filter: 'brightness(0.45)' }),
  };

  const hEnter = headingEnter[currentIdx % headingEnter.length];

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden bg-black" style={{ touchAction: 'none' }}>

      {/* Fire flakes */}
      <div className="fire-flakes" aria-hidden="true">
        {flakes.map((f, i) => (
          <div key={i} className="fire-flake" style={{ left: f.left, width: f.width, height: f.width, animationDuration: f.duration, animationDelay: f.delay, marginLeft: f.drift }} />
        ))}
      </div>

      {/* Ambient lighting */}
      <div className="intro-lighting-effects" aria-hidden="true">
        <div className="spotlight-beam" />
        <div className="light-rays">
          <div className="light-ray ray-1" />
          <div className="light-ray ray-2" />
          <div className="light-ray ray-3" />
        </div>
        <div className="ambient-glow">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="glow-particle" style={{ left:`${8+((i*23)%84)}%`, top:`${8+((i*37)%84)}%`, animationDelay:`${(i*0.7)%5}s`, animationDuration:`${4+(i%3)*1.5}s` }} />
          ))}
        </div>
      </div>

      {/* Heading — pinned to top, separate from card */}
      <div className="absolute top-0 left-0 right-0 z-20 flex flex-col items-center" style={{ paddingTop: 'clamp(20px, 5vh, 48px)' }}>
        <AnimatePresence mode="wait">
          <motion.h1
            key={`h-${currentIdx}`}
            className="font-black text-white uppercase select-none text-center"
            style={{
              fontSize: 'clamp(1rem, 2.2vw, 1.7rem)',
              letterSpacing: '0.08em',
              lineHeight: 1.0,
              textShadow: '0 0 55px rgba(160,200,255,0.5), 0 3px 0 rgba(0,0,0,0.7)',
            }}
            initial={{ ...hEnter }}
            animate={{ x: 0, y: 0, opacity: 1, scale: 1, filter: 'blur(0px)', rotateX: 0, letterSpacing: '0.08em' }}
            exit={{ opacity: 0, y: -20, filter: 'blur(8px)', transition: { duration: 0.26 } }}
            transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          >
            Our Artwork Collections
          </motion.h1>
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div key={`line-${currentIdx}`}
            className="mx-auto mt-2 h-[2px] rounded-full"
            style={{ width: 'clamp(50px, 14vw, 130px)', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)' }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ scaleX: 0, opacity: 0 }}
            transition={{ duration: 0.55, delay: 0.15, ease: [0.22,1,0.36,1] }} />
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingLeft: '12px', paddingRight: '28px', paddingBottom: '16px' }}>

        {/* Colour blob */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div key={`blob-${currentIdx}`}
              className="absolute top-1/4 left-1/5 w-[700px] h-[700px] rounded-full blur-3xl"
              style={{ background: ['rgba(29,78,216,0.09)','rgba(109,40,217,0.09)','rgba(5,150,105,0.08)','rgba(220,38,38,0.08)','rgba(245,158,11,0.08)','rgba(79,70,229,0.09)'][currentIdx] }}
              initial={{ opacity: 0, scale: 0.65 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.25 }} transition={{ duration: 1.3, ease: 'easeOut' }} />
          </AnimatePresence>
        </div>

        <div className="relative z-10 w-full" style={{ maxWidth: 'min(860px, 96vw)' }}>


          {/* Ghost number */}
          <div className="absolute -top-6 -left-2 z-0 select-none font-black leading-none pointer-events-none"
            style={{ fontSize: 'clamp(5rem, 14vw, 10rem)', color: 'rgba(255,255,255,0.032)', letterSpacing: '-0.05em' }}>
            {String(currentIdx + 1).padStart(2, '0')}
          </div>

          {/* 3D page-turn card */}
          <div style={{ perspective: '1500px', perspectiveOrigin: '50% 50%' }}>
            <AnimatePresence custom={direction} initial={false}>
              <motion.div key={currentIdx} custom={direction}
                variants={cardVariants} initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.8, ease: [0.25, 0.85, 0.35, 1] }}
                style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}>

                <motion.div
                  className="relative cursor-pointer select-none overflow-hidden"
                  style={{
                    aspectRatio: '16/9',
                    borderRadius: '18px',
                    border: '1px solid rgba(255,255,255,0.11)',
                    boxShadow: '0 45px 100px rgba(0,0,0,0.92), 0 0 70px rgba(100,150,255,0.09)',
                  }}
                  onClick={() => onSelectCategory(categories[currentIdx].idx)}
                  whileTap={{ scale: 0.978 }}
                  onMouseMove={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    const x = (e.clientX - r.left) / r.width - 0.5;
                    const y = (e.clientY - r.top)  / r.height - 0.5;
                    gsap.to(e.currentTarget, { rotateY: x * 11, rotateX: y * -11, scale: 1.025, duration: 0.38, ease: 'power2.out', transformPerspective: 1500 });
                    if (imgRef.current) gsap.to(imgRef.current, { x: x * 16, y: y * 11, duration: 0.45, ease: 'power2.out' });
                  }}
                  onMouseLeave={(e) => {
                    gsap.to(e.currentTarget, { rotateY: 0, rotateX: 0, scale: 1, duration: 0.9, ease: 'elastic.out(1,0.5)', transformPerspective: 1500 });
                    if (imgRef.current) gsap.to(imgRef.current, { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.9, ease: 'elastic.out(1,0.5)' });
                  }}>

                  {/* Image */}
                  <div ref={imgRef} className="absolute inset-0 bg-cover bg-center will-change-transform"
                    style={{ backgroundImage: `url(${coverImages[currentIdx]})`, transformOrigin: 'center center' }} />

                  {/* Overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, transparent 55%, rgba(0,0,0,0.4) 100%)' }} />

                  {/* Card text */}
                  <AnimatePresence custom={direction} initial={false} mode="wait">
                    <motion.div key={`txt-${currentIdx}`} custom={direction}
                      initial={(d) => ({ y: d > 0 ? 40 : -40, opacity: 0 })}
                      animate={{ y: 0, opacity: 1, transition: { delay: 0.3, duration: 0.5, ease: [0.22,1,0.36,1] } }}
                      exit={(d) => ({ y: d > 0 ? -40 : 40, opacity: 0, transition: { duration: 0.2 } })}
                      className="absolute bottom-0 left-0 right-0 p-5 md:p-7 z-10">

                      {/* Category label — fully visible */}
                      <motion.p
                        className="text-[11px] uppercase tracking-[0.28em] text-white font-semibold mb-1.5"
                        style={{ textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}
                        initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.38, duration: 0.4 }}>
                        {String(currentIdx + 1).padStart(2,'0')} &mdash; Collection
                      </motion.p>

                      {/* Section title — one line, compact */}
                      <motion.h2
                        className="font-black text-white leading-none whitespace-nowrap"
                        style={{
                          fontSize: 'clamp(1rem, 2.4vw, 1.75rem)',
                          textShadow: '0 2px 18px rgba(0,0,0,0.95)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42, duration: 0.48 }}>
                        {categories[currentIdx].title}
                      </motion.h2>

                      {/* Subtitle */}
                      <motion.p
                        className="text-xs text-white/80 font-medium mt-1 tracking-wide"
                        style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}>
                        {categories[currentIdx].subtitle}
                      </motion.p>

                      <motion.button
                        onClick={(e) => { e.stopPropagation(); onSelectCategory(categories[currentIdx].idx); }}
                        className="mt-4 inline-flex items-center gap-2 px-5 py-2 bg-white/90 hover:bg-white rounded-full text-black text-xs font-bold tracking-wide shadow-xl transition-colors"
                        initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.58, duration: 0.38 }}
                        whileHover={{ scale: 1.08, x: 5 }} whileTap={{ scale: 0.93 }}>
                        Explore Collection
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </motion.button>
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom bar: dots + counter */}
          <AnimatePresence mode="wait">
            <motion.div key={`bar-${currentIdx}`}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ delay: 0.36, duration: 0.44 }}
              className="mt-4 flex items-center justify-between px-1">

              <div className="flex gap-2 items-center">
                {categories.map((_, i) => (
                  <button key={i}
                    onClick={() => { setDirection(i > currentIdx ? 1 : -1); setCurrentIdx(i); }}
                    className={`transition-all duration-300 rounded-full ${
                      i === currentIdx
                        ? 'w-7 h-1.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                        : 'w-1.5 h-1.5 bg-white/25 hover:bg-white/55'
                    }`} />
                ))}
              </div>

              <span className="font-mono text-xs tracking-widest text-white/40 select-none">
                {String(currentIdx + 1).padStart(2,'0')}
                <span className="mx-1.5 text-white/20">/</span>
                {String(categories.length).padStart(2,'0')}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Right dot nav */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
        {categories.map((_, i) => (
          <button key={i}
            title={categories[i].title}
            onClick={() => { setDirection(i > currentIdx ? 1 : -1); setCurrentIdx(i); }}
            className={`rounded-full transition-all duration-300 ${
              i === currentIdx ? 'w-1.5 h-6 bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'w-1.5 h-1.5 bg-white/25 hover:bg-white/55'
            }`} />
        ))}
      </div>

      {/* Scroll hint */}
      {currentIdx === 0 && (
        <motion.div className="fixed bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 text-white/25 select-none z-40"
          animate={{ y: [0, 7, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
          <span className="text-[9px] tracking-[0.3em] uppercase">Scroll</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </motion.div>
      )}
    </div>
  );
}
