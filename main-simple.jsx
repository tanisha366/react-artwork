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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  const currentArtwork = artworks[currentIndex];

  return (
    <div style={{ 
      height: '100vh', 
      background: '#1c1917', 
      color: 'white', 
      padding: '20px'
    }}>
      <h1>Art Gallery Test</h1>
      <div style={{ marginBottom: '20px' }}>
        <h2>{currentArtwork.title}</h2>
        <p>by {currentArtwork.artist}</p>
        <p>{currentArtwork.description}</p>
        <img 
          src={currentArtwork.image} 
          alt={currentArtwork.title}
          style={{ width: '300px', height: '200px', objectFit: 'cover' }}
        />
      </div>
      
      <button 
        onClick={() => setCurrentIndex((prev) => (prev + 1) % artworks.length)}
        style={{ 
          padding: '10px 20px', 
          background: '#amber', 
          color: 'black',
          border: 'none',
          cursor: 'pointer',
          marginRight: '10px'
        }}
      >
        Next
      </button>
      
      <button 
        onClick={() => setShowDetails(!showDetails)}
        style={{ 
          padding: '10px 20px', 
          background: '#amber', 
          color: 'black',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        {showDetails ? 'Hide' : 'Show'} Details
      </button>
      
      {showDetails && (
        <div style={{ marginTop: '20px', background: '#333', padding: '20px' }}>
          <h3>Details View</h3>
          <p>Year: {currentArtwork.year}</p>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);