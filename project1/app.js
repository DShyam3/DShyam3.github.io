document.addEventListener('DOMContentLoaded', () => {
    const MAPBOX_ACCESS_TOKEN = 'sk.eyJ1IjoiZHNoeWFtMyIsImEiOiJjbTR5cThrOXEwejY2MmtzZGd1ZG1neTV0In0.cpFtUHBwR4AolEBLavY2rw'; // Replace with your actual token
    
    // Initialize Mapbox
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
  
    const map = new mapboxgl.Map({
      container: 'map', // The ID of the div where the map will be rendered
      style: 'mapbox://styles/mapbox/mapbox-streets-v12', // Map style
      center: [-74.006, 40.7128], // Initial center [lng, lat] (e.g., New York City)
      zoom: 15, // Initial zoom level
      pitch: 60, // Tilt the map for 3D effect
      bearing: -17.6 // Rotate the map for a better perspective
    });
  
    // Add navigation controls
    const nav = new mapboxgl.NavigationControl();
    map.addControl(nav, 'top-right');
  
    // Add terrain and 3D buildings
    map.on('load', () => {
      // Add terrain source for elevation
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.terrain-rgb',
        tileSize: 512,
        maxzoom: 14
      });
  
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
  
      // Add sky layer for realism
      map.addLayer({
        id: 'sky',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 90.0],
          'sky-atmosphere-sun-intensity': 15
        }
      });
  
      // Add 3D buildings
      map.addLayer({
        id: '3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 15,
        paint: {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.6
        }
      });
    });
  });
  