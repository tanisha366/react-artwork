import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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
import './index.css';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger, TextPlugin);

const PRELOADED = new Set();
const FAILED_IMAGES = new Set();

// ========== PRELOAD IMAGES ==========
function preloadImages(urls, { concurrency = 20 } = {}) {
  let cancelled = false;
  const queue = (urls ?? []).filter(
    u => typeof u === 'string' && u.length && !u.startsWith('data:') && !PRELOADED.has(u) && !FAILED_IMAGES.has(u)
  );
  let inFlight = 0, i = 0;
  const pump = () => {
    if (cancelled) return;
    while (inFlight < concurrency && i < queue.length) {
      const url = queue[i++];
      if (PRELOADED.has(url) || FAILED_IMAGES.has(url)) continue;
      PRELOADED.add(url);
      inFlight++;
      const img = new Image();
      img.decoding = 'async';
      const done = () => { inFlight--; pump(); };
      img.onload = done;
      img.onerror = () => {
        FAILED_IMAGES.add(url);
        PRELOADED.delete(url);
        done();
      };
      img.src = url;
    }
  };
  pump();
  return () => { cancelled = true; };
}

// ========== MEDIA QUERY HOOK ==========
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

// ========== RANDOM GENERATOR ==========
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ========== RATIO FUNCTIONS ==========
function ratioHeightFactor(r) {
  if (r === 'ratio-square') return 1;
  if (r === 'ratio-square-tall') return 16/15;
  if (r === 'ratio-square-wide') return 15/16;
  if (r === 'ratio-portrait') return 7/6;
  if (r === 'ratio-landscape') return 6/7;
  return 1;
}

function pickRatio(rnd, disallow) {
  const ratios = ['ratio-square', 'ratio-square-tall', 'ratio-square-wide', 'ratio-portrait', 'ratio-landscape'];
  const pool = [
    ...Array(8).fill('ratio-square'),
    ...Array(5).fill('ratio-square-tall'),
    ...Array(5).fill('ratio-square-wide'),
    ...Array(2).fill('ratio-portrait'),
    ...Array(2).fill('ratio-landscape')
  ];
  let chosen = pool[Math.floor(rnd() * pool.length)];
  for (let a = 0; a < ratios.length; a++) {
    if (!disallow?.has(chosen)) break;
    chosen = ratios[(Math.floor(rnd() * ratios.length) + a) % ratios.length];
  }
  return chosen;
}

// ========== MASONRY COLUMNS ==========
function buildMasonryColumns({ sources, columns, seed }) {
  const uniqueSources = [...new Set(sources)];
  const rnd = mulberry32(seed >>> 0);
  const colCount = Math.max(1, columns | 0);
  const cols = Array.from({ length: colCount }, () => ({ items: [], height: 0, lastRatio: null }));
  const firstRatios = shuffleInPlace(
    ['ratio-square', 'ratio-square-tall', 'ratio-square-wide', 'ratio-portrait', 'ratio-landscape'],
    rnd
  );
  let idx = 0;
  const used = new Set();
  for (let c = 0; c < colCount && idx < uniqueSources.length; c++) {
    const src = uniqueSources[idx];
    const ratio = firstRatios[c % firstRatios.length];
    cols[c].items.push({ src, ratio, index: idx, uniqueId: `${seed}-${idx}-${c}` });
    cols[c].lastRatio = ratio;
    cols[c].height += ratioHeightFactor(ratio) + 0.08;
    used.add(src);
    idx++;
  }
  for (; idx < uniqueSources.length; idx++) {
    const src = uniqueSources[idx];
    let best = 0;
    for (let c = 1; c < colCount; c++) if (cols[c].height < cols[best].height) best = c;
    const disallow = new Set([cols[best].lastRatio]);
    const ratio = pickRatio(rnd, disallow);
    cols[best].items.push({ src, ratio, index: idx, uniqueId: `${seed}-${idx}-${best}` });
    cols[best].lastRatio = ratio;
    cols[best].height += ratioHeightFactor(ratio) + 0.08;
  }
  return cols.map(c => c.items);
}

// ========== HASH FUNCTION ==========
function hashStringToUint32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ========== BUILD TITLES ==========
function buildTitlePlan({ sources, category, seed }) {
  const uniqueSources = [...new Set(sources)];
  const cat = category ?? 'Artwork';
  const rnd = mulberry32(seed >>> 0);

  const vocab = {
    Landscape: {
      adjectives: ['Silent','Golden','Misty','Serene','Endless','Soft','Distant','Wandering','Tranquil','Emerald','Azure','Crimson','Verdant','Wild','Peaceful','Ancient'],
      nouns: ['Horizon','Valley','River','Cliff','Meadow','Highland','Coast','Forest','Mountain','Lake','Canyon','Plain','Waterfall','Vista','Ridge','Shore'],
      moments: ['Dawn','Morning','Twilight','Blue Hour','After Rain','Sunset','Noon','Dusk','First Light','Golden Hour']
    },
    Portrait: {
      adjectives: ['Quiet','Radiant','Restless','Gentle','Bold','Intimate','Still','Pensive','Vibrant','Mysterious','Contemplative','Serene','Dynamic','Elegant','Expressive'],
      nouns: ['Gaze','Presence','Profile','Silhouette','Expression','Figure','Portrait','Face','Character','Soul','Vision','Countenance','Visage','Aspect'],
      moments: ['Study','In Light','In Shadow','At Rest','Revealed','Captured','Unveiled','Reflected']
    },
    Abstract: {
      adjectives: ['Vivid','Electric','Luminous','Tangled','Harmonic','Fragmented','Fluid','Dynamic','Cosmic','Crystalline','Ethereal','Prismatic','Kinetic','Radiant','Infinite'],
      nouns: ['Rhythm','Echo','Pulse','Signal','Memory','Drift','Flow','Wave','Pattern','Energy','Spectrum','Field','Motion','Harmony','Resonance'],
      moments: ['No. I','No. II','No. III','Series A','Series B','Series C','Movement I','Movement II','Part One','Part Two']
    },
    Conceptual: {
      adjectives: ['Hidden','Measured','Unspoken','Spare','Precise','Uncertain','Minimal','Pure','Essential','Fundamental','Abstract','Theoretical','Rational','Logical'],
      nouns: ['Witness','Question','Trace','Interval','Observation','Threshold','Space','Time','Structure','Element','Form','Concept','Principle','Axiom'],
      moments: ['Note','Draft','Index','Study','Theorem','Proof','Hypothesis','Exploration']
    },
    Figurative: {
      adjectives: ['Graceful','Grounded','Tender','Weathered','Lyrical','Human','Dramatic','Natural','Poetic','Timeless','Vivid','Honest','Raw','Authentic'],
      nouns: ['Gesture','Moment','Memory','Scene','Story','Encounter','Dance','Movement','Life','Journey','Episode','Chapter','Narrative','Tale'],
      moments: ['I','II','III','Act One','Act Two','Scene 1','Scene 2','Chapter A','Chapter B']
    },
    'Urban abstraction': {
      adjectives: ['Urban','Metropolitan','Modern','Industrial','Geometric','Angular','Bold','Concrete','Steel','Neon','Digital','Contemporary','Edgy','Raw'],
      nouns: ['City','Street','Structure','Building','Grid','Block','Tower','Plaza','Avenue','Skyline','Junction','Corner','Facade','Architecture'],
      moments: ['Night','Rush Hour','Midnight','Evening','Late Night','Downtown','Uptown','District']
    }
  };

  const bucket = vocab[cat] ?? {
    adjectives: ['Original','Modern','Classic','Curated','Signature'],
    nouns: ['Artwork','Composition','Study','Piece'],
    moments: ['Edition']
  };

  const used = new Set();
  const titles = [];

  for (let i = 0; i < uniqueSources.length; i++) {
    const src = uniqueSources[i];
    const srcSeed = hashStringToUint32(src) ^ ((seed >>> 0) + i * 97);
    const r = mulberry32(srcSeed);
    const adj = bucket.adjectives[Math.floor(r() * bucket.adjectives.length)];
    const noun = bucket.nouns[Math.floor(r() * bucket.nouns.length)];
    const mom = bucket.moments[Math.floor(r() * bucket.moments.length)];
    const m = src.match(/art-(\d+)/);
    const num = m ? m[1] : String(i+1).padStart(3,'0');
    let title = `${adj} ${noun} — ${mom} • #${num}`;
    let attempt = 0;
    while (used.has(title) && attempt < 5) {
      const a2 = bucket.adjectives[Math.floor(r() * bucket.adjectives.length)];
      const n2 = bucket.nouns[Math.floor(r() * bucket.nouns.length)];
      title = `${a2} ${n2} — ${mom} • #${num}-${String.fromCharCode(65+attempt)}`;
      attempt++;
    }
    used.add(title);
    titles.push(title);
  }
  return titles;
}

// ========== OPTIMIZED TILE IMAGE COMPONENT ==========
function TileImage({ src, alt, index, fallbackPool }) {
  const [resolvedSrc, setResolvedSrc] = useState(src);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const attempts = useRef(0);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    setResolvedSrc(src);
    setIsLoaded(false);
    setHasError(false);
    attempts.current = 0;
  }, [src, index]);

  useEffect(() => {
    if (isLoaded && imgRef.current && containerRef.current) {
      // Lightweight reveal animation using transform3d for GPU acceleration
      gsap.fromTo(imgRef.current, 
        { 
          opacity: 0, 
          scale: 1.1,
          filter: 'blur(10px)',
          rotation: gsap.utils.random(-2, 2)
        },
        { 
          opacity: 1, 
          scale: 1, 
          filter: 'blur(0px)',
          rotation: 0,
          duration: 0.9, 
          ease: 'power3.out',
          delay: index * 0.02,
          force3D: true
        }
      );
      
      gsap.fromTo(containerRef.current,
        { 
          boxShadow: '0 0 0 rgba(255,255,255,0)',
          borderColor: 'rgba(255,255,255,0.08)'
        },
        {
          boxShadow: '0 0 20px rgba(255,255,255,0.15)',
          borderColor: 'rgba(255,255,255,0.2)',
          duration: 0.6,
          ease: 'power2.out',
          yoyo: true,
          repeat: 1,
          force3D: true
        }
      );
    }
  }, [isLoaded, index]);

  const handleLoad = (e) => {
    setIsLoaded(true);
    e.currentTarget.classList.add('is-loaded');
  };

  const handleError = () => {
    attempts.current++;
    setHasError(true);
    
    if (attempts.current === 1 && fallbackPool?.length) {
      for (let i = 0; i < fallbackPool.length; i++) {
        const cand = fallbackPool[(index + i) % fallbackPool.length];
        if (cand && cand !== resolvedSrc && !cand.startsWith('data:')) {
          setResolvedSrc(cand);
          return;
        }
      }
    }
    if (attempts.current === 2) {
      setResolvedSrc(FALLBACK_IMAGES[Math.abs(index + Date.now()) % FALLBACK_IMAGES.length]);
      return;
    }
    setResolvedSrc(createColorfulFallback(hashStringToUint32(src + index + attempts.current)));
  };

  return (
    <div ref={containerRef} className="tile-image-container">
      <img
        ref={imgRef}
        key={resolvedSrc}
        className={`art-img-cover ${isLoaded ? 'is-loaded' : ''} ${hasError ? 'has-error' : ''}`}
        src={resolvedSrc}
        alt={alt}
        loading={index < 12 ? 'eager' : 'lazy'}
        decoding="async"
        fetchpriority={index < 12 ? 'high' : 'auto'}
        referrerPolicy="no-referrer"
        onLoad={handleLoad}
        onError={handleError}
        style={{ willChange: 'transform, opacity, filter' }}
      />
      {!isLoaded && !hasError && (
        <div className="image-placeholder">
          <div className="placeholder-pulse"></div>
        </div>
      )}
    </div>
  );
}

// ========== LOADING SCREEN ==========
function LoadingScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const progressBarRef = useRef(null);
  const counterRef = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        setTimeout(onComplete, 400);
      }
    });

    tl.fromTo(textRef.current,
      { opacity: 0, y: 40, scale: 0.9 },
      { opacity: 1, y: 0, scale: 1, duration: 1, ease: 'power3.out', force3D: true }
    );

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.random() * 8;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(interval);
        gsap.to(counterRef.current, {
          scale: 1.2,
          color: '#ffffff',
          duration: 0.3,
          yoyo: true,
          repeat: 1,
          force3D: true
        });
      }
      setProgress(Math.min(currentProgress, 100));
    }, 60);

    return () => clearInterval(interval);
  }, [onComplete]);

  useEffect(() => {
    if (progress === 100) {
      gsap.to(containerRef.current, {
        y: '-100%',
        duration: 1.2,
        ease: 'power4.inOut',
        delay: 0.3,
        force3D: true
      });
      gsap.to('.loading-content', {
        opacity: 0,
        y: -30,
        duration: 0.8,
        ease: 'power2.in',
        force3D: true
      });
    }
  }, [progress]);

  return (
    <motion.div ref={containerRef} className="loading-screen" initial={{ y: 0 }}>
      <div className="loading-content">
        <h1 ref={textRef} className="loading-title">Artwork Gallery</h1>
        <div className="loading-bar-container">
          <motion.div
            ref={progressBarRef}
            className="loading-bar"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: 'power2.out' }}
          />
        </div>
        <p ref={counterRef} className="loading-percentage">{Math.round(progress)}%</p>
        <p className="loading-subtitle">curating masterpieces</p>
      </div>
    </motion.div>
  );
}

// ========== MAIN APP ==========
function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState('next');
  const [activeTile, setActiveTile] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);

  const shouldReduceMotion = useReducedMotion() || false;
  const galleryScrollRef = useRef(null);
  const headerRef = useRef(null);
  const titleRef = useRef(null);
  const mainContainerRef = useRef(null);
  const itemsRef = useRef([]);

  const isSmUp = useMediaQuery('(min-width: 640px)');
  const isMdUp = useMediaQuery('(min-width: 768px)');
  const isLgUp = useMediaQuery('(min-width: 1024px)');

  const imageCount = isLgUp ? 40 : isMdUp ? 34 : isSmUp ? 26 : 20;
  const masonryColumns = isLgUp ? 6 : isMdUp ? 5 : isSmUp ? 3 : 2;

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setRefreshKey(Date.now() + Math.random() * 1e6); }, []);

  const nextSlide = () => {
    if (isAnimating) return;
    const tl = gsap.timeline({
      onStart: () => setIsAnimating(true),
      onComplete: () => setIsAnimating(false)
    });
    tl.to('.masonry-grid', {
      x: -80,
      opacity: 0,
      rotation: -2,
      scale: 0.98,
      duration: 0.4,
      ease: 'power2.in',
      force3D: true,
      onComplete: () => {
        setDirection('next');
        setCurrentIndex(p => (p + 1) % artworks.length);
        gsap.set('.masonry-grid', { x: 80, opacity: 0, rotation: 2, scale: 0.98 });
        tl.to('.masonry-grid', {
          x: 0,
          opacity: 1,
          rotation: 0,
          scale: 1,
          duration: 0.6,
          ease: 'power3.out',
          stagger: { amount: 0.3, from: 'start' },
          force3D: true
        });
      }
    });
  };

  const prevSlide = () => {
    if (isAnimating) return;
    const tl = gsap.timeline({
      onStart: () => setIsAnimating(true),
      onComplete: () => setIsAnimating(false)
    });
    tl.to('.masonry-grid', {
      x: 80,
      opacity: 0,
      rotation: 2,
      scale: 0.98,
      duration: 0.4,
      ease: 'power2.in',
      force3D: true,
      onComplete: () => {
        setDirection('prev');
        setCurrentIndex(p => (p - 1 + artworks.length) % artworks.length);
        gsap.set('.masonry-grid', { x: -80, opacity: 0, rotation: -2, scale: 0.98 });
        tl.to('.masonry-grid', {
          x: 0,
          opacity: 1,
          rotation: 0,
          scale: 1,
          duration: 0.6,
          ease: 'power3.out',
          stagger: { amount: 0.3, from: 'start' },
          force3D: true
        });
      }
    });
  };

  const currentArtwork = artworks[currentIndex];

  const openModal = (item) => {
    setActiveTile({
      src: item.src,
      index: item.index,
      caption: captionPlan[item.index] ?? '',
      section: currentArtwork.title
    });
    gsap.fromTo('.art-modal',
      { scale: 0.8, opacity: 0, backdropFilter: 'blur(0px)' },
      { scale: 1, opacity: 1, backdropFilter: 'blur(12px)', duration: 0.5, ease: 'backOut(1.4)', force3D: true }
    );
  };

  const closeModal = () => {
    gsap.to('.art-modal', {
      scale: 0.8,
      opacity: 0,
      backdropFilter: 'blur(0px)',
      duration: 0.3,
      ease: 'power2.in',
      force3D: true,
      onComplete: () => setActiveTile(null)
    });
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ========== ALL useMemo HOOKS ==========
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

  // ========== OPTIMIZED INITIAL ANIMATIONS ==========
  useEffect(() => {
    if (!mounted || loading || !masonryPlan) return;

    const ctx = gsap.context(() => {
      const masterTl = gsap.timeline();

      masterTl.fromTo(headerRef.current,
        { y: -80, opacity: 0, scale: 0.9 },
        { y: 0, opacity: 1, scale: 1, duration: 1.2, ease: 'power3.out', force3D: true },
        0
      );

      masterTl.fromTo(titleRef.current,
        { scale: 0.7, opacity: 0, textShadow: '0 0 0px rgba(255,255,255,0)' },
        { scale: 1, opacity: 1, textShadow: '0 0 30px rgba(255,255,255,0.5)', duration: 1.4, ease: 'backOut(1.4)', delay: 0.2, force3D: true },
        0
      );

      masterTl.fromTo('.masonry-item',
        { 
          y: 100, 
          opacity: 0,
          rotationX: 15,
          rotationY: gsap.utils.random(-10, 10),
          scale: 0.7,
          filter: 'blur(10px)'
        },
        { 
          y: 0, 
          opacity: 1,
          rotationX: 0,
          rotationY: 0,
          scale: 1,
          filter: 'blur(0px)',
          duration: 1,
          stagger: { amount: 0.8, from: 'random', grid: 'auto', ease: 'power2.out' },
          ease: 'power3.out',
          delay: 0.3,
          force3D: true
        },
        0
      );

      masterTl.to('.art-bg', {
        rotation: 360,
        scale: 1.1,
        duration: 60,
        repeat: -1,
        ease: 'none',
        force3D: true
      }, 0);
    });

    return () => ctx.revert();
  }, [mounted, loading, masonryPlan]);

  // Scroll animations (optimized)
  useEffect(() => {
    if (!mounted || loading) return;

    const ctx = gsap.context(() => {
      gsap.to('.art-bg', {
        scrollTrigger: {
          trigger: '.collage-scroll',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.5
        },
        y: 200,
        rotation: 15,
        scale: 1.3,
        force3D: true
      });

      gsap.utils.toArray('.masonry-item').forEach((item, i) => {
        ScrollTrigger.create({
          trigger: item,
          start: 'top 85%',
          onEnter: () => {
            gsap.fromTo(item,
              { opacity: 0.5, y: 30, scale: 0.95 },
              { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power2.out', delay: i * 0.02, force3D: true }
            );
          },
          onLeaveBack: () => {
            gsap.to(item, { opacity: 0.5, y: 30, scale: 0.95, duration: 0.3, force3D: true });
          }
        });
      });

      gsap.utils.toArray('.art-tile .absolute.bottom-3').forEach((el, i) => {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 80%',
          onEnter: () => {
            gsap.fromTo(el,
              { x: -20, opacity: 0, filter: 'blur(5px)' },
              { x: 0, opacity: 1, filter: 'blur(0px)', duration: 0.5, ease: 'power2.out', delay: i * 0.03, force3D: true }
            );
          }
        });
      });
    });

    return () => ctx.revert();
  }, [mounted, loading]);

  // Hover animations
  useEffect(() => {
    itemsRef.current.forEach((item) => {
      if (!item) return;
      const hoverTl = gsap.timeline({ paused: true });
      hoverTl.to(item, {
        y: -8,
        scale: 1.03,
        boxShadow: '0 25px 40px -12px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.2)',
        borderColor: 'rgba(255,255,255,0.3)',
        duration: 0.3,
        ease: 'power2.out',
        force3D: true
      })
      .to(item.querySelector('img'), {
        scale: 1.08,
        duration: 0.4,
        ease: 'power2.out',
        force3D: true
      }, 0)
      .to(item.querySelector('.absolute.bottom-3'), {
        y: -5,
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out',
        force3D: true
      }, 0);

      item.addEventListener('mouseenter', () => hoverTl.play());
      item.addEventListener('mouseleave', () => hoverTl.reverse());
    });

    return () => {
      itemsRef.current.forEach((item) => {
        if (item) {
          item.removeEventListener('mouseenter', () => {});
          item.removeEventListener('mouseleave', () => {});
        }
      });
    };
  }, [masonryPlan]);

  if (!mounted) return null;

  return (
    <>
      {loading && <LoadingScreen onComplete={() => setLoading(false)} />}
      
      <div ref={mainContainerRef} className="h-screen w-screen overflow-hidden bg-stone-950">
        <div className="h-screen w-screen p-3 md:p-6">
          <main className="relative h-full w-full rounded-2xl overflow-hidden">
            <div className="absolute inset-0">
              <div className="art-bg" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20" />
            </div>

            <div className="relative z-10 h-full flex flex-col">
              <div ref={headerRef} className="shrink-0 pt-2 md:pt-3 pb-2">
                <motion.div 
                  ref={titleRef}
                  className="text-white/95 text-2xl md:text-4xl font-semibold tracking-wide text-center drop-shadow pointer-events-none"
                  animate={{ 
                    textShadow: [
                      '0 0 20px rgba(255,255,255,0.3)', 
                      '0 0 40px rgba(255,255,255,0.6)', 
                      '0 0 20px rgba(255,255,255,0.3)'
                    ]
                  }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  Our Artwork Collection
                </motion.div>
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.h2
                    key={currentArtwork.id}
                    custom={direction}
                    variants={{
                      initial: dir => ({ opacity:0, y: shouldReduceMotion ? 0 : (dir==='next' ? 20 : -20), filter: 'blur(10px)' }),
                      animate: { opacity:1, y:0, filter: 'blur(0px)', transition: { duration:0.5, ease:'power3.out' } },
                      exit: dir => ({ opacity:0, y: shouldReduceMotion ? 0 : (dir==='next' ? -20 : 20), filter: 'blur(10px)', transition: { duration:0.4 } })
                    }}
                    initial="initial" animate="animate" exit="exit"
                    className="mt-2 text-white/70 text-sm md:text-base font-medium tracking-[0.22em] uppercase text-center pointer-events-none"
                  >
                    {currentArtwork.title}
                  </motion.h2>
                </AnimatePresence>
              </div>

              <div ref={galleryScrollRef} className="collage-scroll flex-1">
                <div className="masonry-grid">
                  {masonryPlan.map((col, ci) => (
                    <div key={`col-${ci}-${refreshKey}`} className="masonry-col">
                      {col.map((item, ii) => (
                        <motion.div
                          ref={el => itemsRef.current[item.index] = el}
                          key={`${currentArtwork.id}-${item.uniqueId}`}
                          className={`masonry-item art-tile ${item.ratio}`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => openModal(item)}
                          role="button" 
                          tabIndex={0}
                          onKeyDown={e => { 
                            if (e.key==='Enter'||e.key===' ') { 
                              e.preventDefault(); 
                              openModal(item); 
                            } 
                          }}
                        >
                          <TileImage src={item.src} alt={currentArtwork.title} index={item.index} fallbackPool={sectionImages} />
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 via-black/0 to-transparent" />
                          <div className="pointer-events-none absolute left-3 right-3 bottom-3">
                            <div className="flex items-center gap-2">
                              <motion.svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                className="text-white/70"
                                animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                                transition={{ duration: 3, repeat: Infinity }}
                              >
                                <path d="M12 22s7-5.3 7-12a7 7 0 10-14 0c0 6.7 7 12 7 12z" />
                                <path d="M12 13.2a3.2 3.2 0 110-6.4 3.2 3.2 0 010 6.4z" />
                              </motion.svg>
                              <div className="text-[11px] md:text-xs text-white/80 font-light tracking-wide line-clamp-1">
                                {captionPlan[item.index] ?? ''}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <AnimatePresence>
                {activeTile && (
                  <motion.div
                    className="art-modal"
                    initial={{ opacity:0, scale:0.8, backdropFilter: 'blur(0px)' }}
                    animate={{ opacity:1, scale:1, backdropFilter: 'blur(12px)' }}
                    exit={{ opacity:0, scale:0.8, backdropFilter: 'blur(0px)' }}
                    transition={{ duration:0.4, ease:'backOut' }}
                    onClick={closeModal} 
                    role="dialog" 
                    aria-modal="true"
                  >
                    <motion.div
                      className="art-modal-panel"
                      initial={shouldReduceMotion ? { opacity:1 } : { opacity:0, y: 50, scale: 0.8, rotate: -3 }}
                      animate={shouldReduceMotion ? { opacity:1 } : {
                        opacity:1, y: 0, scale: 1, rotate: 0,
                        transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }
                      }}
                      exit={shouldReduceMotion ? { opacity:0 } : { opacity:0, y: 30, scale: 0.9, rotate: 2, transition: { duration: 0.3 } }}
                      onClick={e => e.stopPropagation()}
                    >
                      <motion.div 
                        className="art-hanger" 
                        aria-hidden="true"
                        animate={{ rotate: [0, -5, 5, 0], y: [0, -2, 2, 0] }}
                        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <div className="art-hanger-line" />
                        <div className="art-hanger-knot" />
                      </motion.div>

                      <motion.button 
                        className="art-modal-close" 
                        onClick={closeModal} 
                        aria-label="Close"
                        whileHover={{ scale: 1.2, rotate: 90 }}
                        whileTap={{ scale: 0.9 }}
                      >
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
                          onLoad={e => e.currentTarget.classList.add('is-loaded')}
                          onError={e => e.currentTarget.src = createColorfulFallback(Date.now())}
                        />
                        <motion.div 
                          className="art-modal-meta"
                          initial={{ y: 30, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ duration: 0.4, delay: 0.4 }}
                        >
                          <div className="art-modal-section">{activeTile.section}</div>
                          <div className="art-modal-caption">{activeTile.caption}</div>
                        </motion.div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 right-6 lg:right-10 z-20">
                <div className="flex flex-col items-center gap-6">
                  <motion.button 
                    onClick={prevSlide} 
                    disabled={isAnimating}
                    className="nav-button w-12 h-12 rounded-full bg-white/5 backdrop-blur-sm hover:bg-white/15 flex items-center justify-center transition-all duration-300 group border border-white/10"
                    whileHover={{ scale: 1.1, borderColor: 'rgba(255,255,255,0.3)' }}
                    whileTap={{ scale: 0.9 }}
                    animate={{ y: [0, -5, 0], boxShadow: ['0 0 0 rgba(255,255,255,0)', '0 0 20px rgba(255,255,255,0.2)', '0 0 0 rgba(255,255,255,0)'] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <svg className="w-5 h-5 text-white/90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </motion.button>
                  
                  <div className="flex flex-col gap-2">
                    {artworks.map((_, idx) => (
                      <motion.button
                        key={idx}
                        onClick={() => { if (!isAnimating && idx !== currentIndex) { setDirection(idx > currentIndex ? 'next' : 'prev'); setIsAnimating(true); setCurrentIndex(idx); setTimeout(() => setIsAnimating(false), 600); } }}
                        className={`w-1 rounded-full transition-all duration-500 ${idx === currentIndex ? 'h-10 bg-white' : 'h-4 bg-white/20'}`}
                        whileHover={{ scale: 1.5, backgroundColor: 'rgba(255,255,255,0.4)' }}
                        animate={idx === currentIndex ? { scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] } : {}}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    ))}
                  </div>

                  <motion.button 
                    onClick={nextSlide} 
                    disabled={isAnimating}
                    className="nav-button w-12 h-12 rounded-full bg-white/5 backdrop-blur-sm hover:bg-white/15 flex items-center justify-center transition-all duration-300 group border border-white/10"
                    whileHover={{ scale: 1.1, borderColor: 'rgba(255,255,255,0.3)' }}
                    whileTap={{ scale: 0.9 }}
                    animate={{ y: [0, 5, 0], boxShadow: ['0 0 0 rgba(255,255,255,0)', '0 0 20px rgba(255,255,255,0.2)', '0 0 0 rgba(255,255,255,0)'] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <svg className="w-5 h-5 text-white/90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </motion.button>
                </div>
              </div>

              <div className="md:hidden absolute bottom-6 left-0 right-0 z-20 flex items-center justify-center gap-4">
                <motion.button 
                  onClick={prevSlide} 
                  disabled={isAnimating}
                  className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </motion.button>
                
                <div className="flex gap-1.5">
                  {artworks.map((_, idx) => (
                    <motion.div 
                      key={idx} 
                      className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-6 bg-white' : 'w-2 bg-white/30'}`}
                      animate={idx === currentIndex ? { scale: [1, 1.2, 1], backgroundColor: ['#ffffff', '#f0f0f0', '#ffffff'] } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  ))}
                </div>

                <motion.button 
                  onClick={nextSlide} 
                  disabled={isAnimating}
                  className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);