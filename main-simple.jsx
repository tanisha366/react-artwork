import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

const artworks = [
  {
    id: 1,
    title: 'Landscape',
    artist: 'Claude Monet',
    description: 'Rolling hills meet golden horizons in timeless serenity.',
    year: '1876',
    image: 'https://zigguratss.com/assets/upload/art/zapzvhydui0y7dp164ls.jpg'
  },
  {
    id: 2,
    title: 'Abstract',
    artist: 'Wassily Kandinsky', 
    description: 'Colors dance beyond form, revealing hidden emotions.',
    year: '1923',
    image: 'https://zigguratss.com/assets/upload/art/zigguratss_9ac9271a773f47a6a63d426d2ab2373b.jpg'
  }
];

function App() {
  const [showDetails, setShowDetails] = useState(false);
  const [scrollIndex, setScrollIndex] = useState(0);
  const containerRef = React.useRef(null);

  // Scroll handler
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const scrollLeft = containerRef.current.scrollLeft;
      const width = containerRef.current.offsetWidth;
      const index = Math.round(scrollLeft / width);
      setScrollIndex(index);
    };
    const ref = containerRef.current;
    if (ref) {
      ref.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (ref) {
        ref.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  return (
    <div style={{ 
      height: '100vh', 
      background: '#1c1917', 
      color: 'white', 
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'center',
      overflow: 'hidden',
      padding: 0
    }}>
      <h1 style={{margin: '20px 0'}}>Art Gallery Test</h1>
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          width: '100vw',
          height: 'calc(100vh - 120px)',
        }}
      >
        {artworks.map((art, idx) => (
          <div
            key={art.id}
            style={{
              flex: '0 0 100vw',
              scrollSnapAlign: 'start',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              boxSizing: 'border-box',
              padding: '40px 0',
            }}
          >
            <h2>{art.title}</h2>
            <p>by {art.artist}</p>
            <p>{art.description}</p>
            <img 
              src={art.image} 
              alt={art.title}
              style={{ width: '400px', height: '300px', objectFit: 'cover', borderRadius: '12px' }}
            />
            <button 
              onClick={() => setShowDetails(idx === scrollIndex ? !showDetails : true)}
              style={{ 
                padding: '10px 20px', 
                background: '#FFD700', 
                color: 'black',
                border: 'none',
                cursor: 'pointer',
                marginTop: '20px'
              }}
            >
              {showDetails && idx === scrollIndex ? 'Hide' : 'Show'} Details
            </button>
            {showDetails && idx === scrollIndex && (
              <div style={{ marginTop: '20px', background: '#333', padding: '20px', borderRadius: '8px', width: '320px' }}>
                <h3>Details View</h3>
                <p>Year: {art.year}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{marginTop: '10px', color: '#FFD700'}}>Scroll horizontally to view more artworks</div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
