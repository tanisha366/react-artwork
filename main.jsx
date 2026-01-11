import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const artworks = [
  {
    id: 1,
    title: 'Landscape',
    artist: 'Claude Monet',
    description: 'Rolling hills meet golden horizons in timeless serenity. This masterpiece captures the essence of natural beauty through the lens of impressionist vision.',
    year: '1876',
    medium: 'Oil on Canvas',
    dimensions: '81 × 100 cm',
    collection: 'Musée d\'Orsay, Paris',
    style: 'Impressionism',
    image: 'https://images.unsplash.com/photo-1549289524-06cf8837ace5?w=1200&q=80'
  },
  {
    id: 2,
    title: 'Abstract',
    artist: 'Wassily Kandinsky',
    description: 'Colors dance beyond form, revealing hidden emotions. A journey through the unconscious mind expressed in vibrant hues.',
    year: '1923',
    medium: 'Oil on Canvas',
    dimensions: '140 × 201 cm',
    collection: 'Guggenheim Museum, NYC',
    style: 'Abstract Expressionism',
    image: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=1200&q=80'
  },
  {
    id: 3,
    title: 'Portrait',
    artist: 'John Singer Sargent',
    description: 'Eyes that speak volumes of untold stories. The soul captured in pigment and light.',
    year: '1845',
    medium: 'Oil on Canvas',
    dimensions: '157 × 102 cm',
    collection: 'Metropolitan Museum, NYC',
    style: 'Realism',
    image: 'https://images.unsplash.com/photo-1580274455191-1c62238fa333?w=1200&q=80'
  },
  {
    id: 4,
    title: 'Conceptual',
    artist: 'Marcel Duchamp',
    description: 'Ideas materialized through brushstrokes and vision. Challenging the very definition of art itself.',
    year: '1968',
    medium: 'Mixed Media',
    dimensions: '92 × 73 cm',
    collection: 'MoMA, New York',
    style: 'Dadaism',
    image: 'https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?w=1200&q=80'
  },
  {
    id: 5,
    title: 'Figurative',
    artist: 'Edgar Degas',
    description: 'Human form captured in graceful motion. The poetry of movement frozen in time.',
    year: '1802',
    medium: 'Pastel on Paper',
    dimensions: '65 × 50 cm',
    collection: 'Louvre Museum, Paris',
    style: 'Baroque',
    image: 'https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=1200&q=80'
  },
  {
    id: 6,
    title: 'Urban Abstraction',
    artist: 'Piet Mondrian',
    description: 'City rhythms translated into geometric poetry. The urban landscape reimagined through primary colors.',
    year: '1985',
    medium: 'Acrylic on Canvas',
    dimensions: '120 × 120 cm',
    collection: 'Tate Modern, London',
    style: 'Neo-Plasticism',
    image: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=1200&q=80'
  }
];

function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState('next');
  const [showDetails, setShowDetails] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const nextSlide = () => {
    if (isAnimating) return;
    setDirection('next');
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev + 1) % artworks.length);
    setTimeout(() => setIsAnimating(false), 600);
  };

  const prevSlide = () => {
    if (isAnimating) return;
    setDirection('prev');
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev - 1 + artworks.length) % artworks.length);
    setTimeout(() => setIsAnimating(false), 600);
  };

  const openDetails = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setShowDetails(true);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 400);
  };

  const closeDetails = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setShowDetails(false);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 400);
  };

  const currentArtwork = artworks[currentIndex];

  return (
    <div className="h-screen w-screen overflow-hidden bg-stone-950">
      {/* Transition Overlay */}
      <div 
        className={`fixed inset-0 bg-stone-950 z-50 pointer-events-none transition-transform duration-500 ease-in-out
          ${isTransitioning ? 'translate-y-0' : '-translate-y-full'}`}
      />

      {/* Slider View */}
      <div 
        className={`h-screen w-screen p-4 md:p-8 transition-all duration-500 ease-out
          ${showDetails ? 'opacity-0 scale-95 pointer-events-none absolute' : 'opacity-100 scale-100'}`}
      >
        <div className="h-full w-full flex flex-col">
          {/* Header */}
          <header className="mb-4 md:mb-6">
            <h1 className="text-lg md:text-xl font-light tracking-[0.3em] text-stone-400 uppercase text-center">
              Our Artwork Collection
            </h1>
          </header>

          {/* Main Gallery Area */}
          <main className="flex-1 relative rounded-2xl overflow-hidden">
            {/* Background Images with Ken Burns effect */}
            <div className="absolute inset-0">
              {artworks.map((artwork, index) => (
                <div
                  key={artwork.id}
                  className={`absolute inset-0 transition-all duration-1000 ease-out
                    ${index === currentIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}
                >
                  <img
                    src={artwork.image}
                    alt={artwork.title}
                    className={`w-full h-full object-cover transition-transform duration-[8000ms] ease-out
                      ${index === currentIndex ? 'scale-110' : 'scale-100'}`}
                  />
                </div>
              ))}
              {/* Gradient overlays */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-black/60" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
            </div>

            {/* Content Layer */}
            <div className="relative z-10 h-full flex">
              {/* Left Side - Artwork Info */}
              <div className="w-full md:w-1/2 lg:w-2/5 h-full flex flex-col justify-center p-6 md:p-10 lg:p-14">
                <div className={`transition-all duration-700 ease-out
                  ${isAnimating 
                    ? (direction === 'next' ? 'opacity-0 -translate-x-8' : 'opacity-0 translate-x-8') 
                    : 'opacity-100 translate-x-0'}`}
                >
                  {/* Badge */}
                  <div className="flex items-center gap-3 mb-6">
                    <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full 
                                   text-white/70 text-[10px] tracking-widest uppercase border border-white/10">
                      {currentArtwork.style}
                    </span>
                    <span className="text-white/40 text-xs">•</span>
                    <span className="text-white/50 text-xs tracking-wider">{currentArtwork.year}</span>
                  </div>

                  {/* Title */}
                  <h2 className="text-4xl md:text-5xl lg:text-6xl font-light text-white mb-3 tracking-tight
                               transition-all duration-500 delay-100">
                    {currentArtwork.title}
                  </h2>

                  {/* Artist */}
                  <p className="text-lg md:text-xl text-amber-200/80 font-light mb-6 tracking-wide">
                    by {currentArtwork.artist}
                  </p>

                  {/* Description */}
                  <p className="text-sm md:text-base text-white/60 font-light leading-relaxed mb-8 max-w-md">
                    {currentArtwork.description}
                  </p>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="space-y-1">
                      <p className="text-white/30 text-[10px] tracking-widest uppercase">Medium</p>
                      <p className="text-white/80 text-sm font-light">{currentArtwork.medium}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-white/30 text-[10px] tracking-widest uppercase">Dimensions</p>
                      <p className="text-white/80 text-sm font-light">{currentArtwork.dimensions}</p>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <p className="text-white/30 text-[10px] tracking-widest uppercase">Collection</p>
                      <p className="text-white/80 text-sm font-light">{currentArtwork.collection}</p>
                    </div>
                  </div>

                  {/* View Details Button */}
                  <button 
                    onClick={openDetails}
                    className="group flex items-center gap-2 text-white/50 hover:text-amber-200 
                             transition-all duration-300"
                  >
                    <span className="text-xs tracking-widest uppercase font-light">View Details</span>
                    <svg className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" 
                         fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Right Side - Navigation */}
              <div className="hidden md:flex w-1/2 lg:w-3/5 h-full items-center justify-end pr-10 lg:pr-14">
                <div className="flex flex-col items-center gap-6">
                  {/* Up Arrow */}
                  <button
                    onClick={prevSlide}
                    disabled={isAnimating}
                    className="w-12 h-12 rounded-full bg-white/5 backdrop-blur-sm
                             hover:bg-white/15 flex items-center justify-center
                             transition-all duration-300 group border border-white/10
                             hover:scale-110 hover:border-white/30"
                  >
                    <svg className="w-5 h-5 text-white/70 group-hover:-translate-y-0.5 transition-transform" 
                         fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>

                  {/* Vertical Indicators */}
                  <div className="flex flex-col gap-2">
                    {artworks.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          if (!isAnimating && index !== currentIndex) {
                            setDirection(index > currentIndex ? 'next' : 'prev');
                            setIsAnimating(true);
                            setCurrentIndex(index);
                            setTimeout(() => setIsAnimating(false), 600);
                          }
                        }}
                        className={`w-1 rounded-full transition-all duration-500
                          ${index === currentIndex 
                            ? 'h-10 bg-white' 
                            : 'h-4 bg-white/20 hover:bg-white/40 hover:h-6'}`}
                      />
                    ))}
                  </div>

                  {/* Down Arrow */}
                  <button
                    onClick={nextSlide}
                    disabled={isAnimating}
                    className="w-12 h-12 rounded-full bg-white/5 backdrop-blur-sm
                             hover:bg-white/15 flex items-center justify-center
                             transition-all duration-300 group border border-white/10
                             hover:scale-110 hover:border-white/30"
                  >
                    <svg className="w-5 h-5 text-white/70 group-hover:translate-y-0.5 transition-transform" 
                         fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Navigation */}
            <div className="md:hidden absolute bottom-6 left-0 right-0 z-10 flex items-center justify-center gap-4">
              <button
                onClick={prevSlide}
                disabled={isAnimating}
                className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="flex gap-1.5">
                {artworks.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1 rounded-full transition-all duration-300
                      ${index === currentIndex ? 'w-6 bg-white' : 'w-2 bg-white/30'}`}
                  />
                ))}
              </div>

              <button
                onClick={nextSlide}
                disabled={isAnimating}
                className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </main>

          {/* Footer */}
          <footer className="mt-3 md:mt-4 flex justify-between items-center text-stone-600 text-[10px] tracking-widest uppercase">
            <span>Artwork {String(currentIndex + 1).padStart(2, '0')} of {String(artworks.length).padStart(2, '0')}</span>
            <span>© 2026 Gallery Collection</span>
          </footer>
        </div>
      </div>

      {/* Detail View */}
      {showDetails && (
        <div 
          className={`min-h-screen transition-all duration-500 ease-out
            ${isTransitioning ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}
        >
          {/* Close Button */}
          <button
            onClick={closeDetails}
            className="fixed top-6 right-6 md:top-10 md:right-10 z-40 w-12 h-12 
                     flex items-center justify-center group"
          >
            <span className="absolute w-8 h-[1px] bg-white/50 group-hover:bg-white rotate-45 
                           transition-all duration-300 group-hover:w-10" />
            <span className="absolute w-8 h-[1px] bg-white/50 group-hover:bg-white -rotate-45 
                           transition-all duration-300 group-hover:w-10" />
          </button>

          {/* Back Button */}
          <button
            onClick={closeDetails}
            className="fixed top-6 left-6 md:top-10 md:left-10 z-40 flex items-center gap-3
                     text-white/50 hover:text-white transition-colors duration-300 group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" 
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-xs tracking-widest uppercase hidden md:block">Back to Gallery</span>
          </button>

          {/* Content Layout */}
          <div className="min-h-screen flex flex-col lg:flex-row">
            {/* Image Section */}
            <div className="w-full lg:w-3/5 h-[50vh] lg:h-screen relative overflow-hidden">
              <img
                src={currentArtwork.image}
                alt={currentArtwork.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-stone-950/50 
                            hidden lg:block" />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-transparent to-transparent 
                            lg:hidden" />
            </div>

            {/* Info Section */}
            <div className="w-full lg:w-2/5 min-h-[50vh] lg:min-h-screen flex items-center 
                          px-6 md:px-12 lg:px-16 py-10 lg:py-20 bg-stone-950">
              <div className="w-full max-w-md">
                {/* Style Badge */}
                <div 
                  className="inline-block px-3 py-1.5 bg-amber-900/30 rounded-full mb-6
                           opacity-0 animate-fadeSlideUp"
                  style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}
                >
                  <span className="text-amber-200/80 text-[10px] tracking-[0.2em] uppercase">
                    {currentArtwork.style}
                  </span>
                </div>

                {/* Title */}
                <h1 
                  className="text-4xl md:text-5xl lg:text-6xl font-extralight text-white mb-3 tracking-tight
                           opacity-0 animate-fadeSlideUp"
                  style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}
                >
                  {currentArtwork.title}
                </h1>

                {/* Artist */}
                <p 
                  className="text-lg md:text-xl text-amber-200/70 font-light mb-8 tracking-wide
                           opacity-0 animate-fadeSlideUp"
                  style={{ animationDelay: '400ms', animationFillMode: 'forwards' }}
                >
                  by {currentArtwork.artist}
                </p>

                {/* Description */}
                <p 
                  className="text-white/50 text-sm md:text-base leading-relaxed mb-10
                           opacity-0 animate-fadeSlideUp"
                  style={{ animationDelay: '500ms', animationFillMode: 'forwards' }}
                >
                  {currentArtwork.description}
                </p>

                {/* Details */}
                <div 
                  className="space-y-4 pt-8 border-t border-white/10
                           opacity-0 animate-fadeSlideUp"
                  style={{ animationDelay: '600ms', animationFillMode: 'forwards' }}
                >
                  <div className="flex justify-between">
                    <span className="text-white/30 text-xs tracking-widest uppercase">Year</span>
                    <span className="text-white/70 text-sm">{currentArtwork.year}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/30 text-xs tracking-widest uppercase">Medium</span>
                    <span className="text-white/70 text-sm">{currentArtwork.medium}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/30 text-xs tracking-widest uppercase">Dimensions</span>
                    <span className="text-white/70 text-sm">{currentArtwork.dimensions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/30 text-xs tracking-widest uppercase">Collection</span>
                    <span className="text-white/70 text-sm text-right max-w-[180px]">{currentArtwork.collection}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
