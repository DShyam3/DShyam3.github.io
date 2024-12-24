import { supabase } from './supabaseClient.js';

export class MapManager {
  constructor(mapboxToken) {
    this.mapboxToken = mapboxToken;
    this.map = null;
    this.currentStyle = 'streets';
    this.currentProjection = 'globe';
    this.styles = {
      streets: 'mapbox://styles/mapbox/streets-v12',
      satellite: 'mapbox://styles/mapbox/satellite-streets-v12'
    };
    // Store the current data
    this.currentAirports = {
      type: 'FeatureCollection',
      features: []
    };
    this.currentFlightPaths = {
      type: 'FeatureCollection',
      features: []
    };
  }

  async initialize() {
    mapboxgl.accessToken = this.mapboxToken;

    this.map = new mapboxgl.Map({
      container: 'map',
      style: this.styles[this.currentStyle],
      projection: this.currentProjection,
      zoom: 1,
      center: [0, 20],
      maxZoom: 16,
      minZoom: 1
    });

    await this.map.once('load');
    await this.initializeLayers();
    this.setupControls();
  }

  setupControls() {
    const projectionToggle = document.getElementById('projection-toggle');
    const styleToggle = document.getElementById('style-toggle');

    // Projection toggle
    projectionToggle.addEventListener('click', () => {
      const currentProjection = projectionToggle.dataset.current;
      const newProjection = currentProjection === 'globe' ? 'mercator' : 'globe';
      
      // Update map projection
      this.map.setProjection(newProjection);
      
      // Update button icon and data
      projectionToggle.dataset.current = newProjection;
      projectionToggle.title = newProjection === 'globe' ? 'Switch to Flat View' : 'Switch to Globe View';
      
      // Update scroll limits for mercator projection
      if (newProjection === 'mercator') {
        this.map.setMaxBounds([[-180, -85], [180, 85]]);
      } else {
        this.map.setMaxBounds(null);
      }
    });

    // Style toggle
    styleToggle.addEventListener('click', () => {
      const currentStyle = styleToggle.dataset.current;
      const newStyle = currentStyle === 'streets' ? 'satellite' : 'streets';
      
      // Store current data before style change
      this.storeCurrentData();
      
      // Update map style
      this.map.setStyle(this.styles[newStyle]);
      
      // Update button icon and data
      styleToggle.dataset.current = newStyle;
      styleToggle.title = newStyle === 'streets' ? 'Switch to Satellite View' : 'Switch to Streets View';

      // Re-add sources and layers after style change
      this.map.once('style.load', () => {
        this.initializeLayers();
        this.restoreData();
      });
    });
  }

  storeCurrentData() {
    const airportsSource = this.map.getSource('airports');
    const flightPathsSource = this.map.getSource('flightPaths');
    
    if (airportsSource) {
      this.currentAirports = airportsSource._data;
    }
    if (flightPathsSource) {
      this.currentFlightPaths = flightPathsSource._data;
    }
  }

  restoreData() {
    const airportsSource = this.map.getSource('airports');
    const flightPathsSource = this.map.getSource('flightPaths');
    
    if (airportsSource && this.currentAirports.features.length > 0) {
      airportsSource.setData(this.currentAirports);
    }
    if (flightPathsSource && this.currentFlightPaths.features.length > 0) {
      flightPathsSource.setData(this.currentFlightPaths);
    }
  }

  async initializeLayers() {
    // Add sources
    this.map.addSource('flightPaths', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });

    this.map.addSource('airports', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50
    });

    // Add layers
    this.map.addLayer({
      id: 'flightPaths',
      type: 'line',
      source: 'flightPaths',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#ff6b00',
        'line-width': 2,
        'line-opacity': 0.6
      }
    });

    // Add a layer for the clusters
    this.map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'airports',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#ff6b00',  // Default color
          10,         // Break point
          '#ff8533',  // Color for clusters > 10
          30,         // Break point
          '#ff944d'   // Color for clusters > 30
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          20,    // Default size
          10,    // Break point
          25,    // Size for clusters > 10
          30,    // Break point
          30     // Size for clusters > 30
        ],
        'circle-opacity': 0.9,
        'circle-stroke-width': 2,
        'circle-stroke-color': 'rgba(255, 255, 255, 0.3)',
        'circle-stroke-opacity': 0.5
      }
    });

    // Add a layer for the cluster counts
    this.map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'airports',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 14
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(0, 0, 0, 0.2)',
        'text-halo-width': 2
      }
    });

    // Add a layer for individual points
    this.map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'airports',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': '#ff6b00',
        'circle-radius': 8,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9,
        'circle-stroke-opacity': 0.5
      }
    });

    this.setupMapInteractions();
  }

  setupMapInteractions() {
    // Cluster click
    this.map.on('click', 'clusters', (e) => {
      const features = this.map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      const clusterId = features[0].properties.cluster_id;
      this.map.getSource('airports').getClusterExpansionZoom(
        clusterId,
        (err, zoom) => {
          if (err) return;
          this.map.easeTo({
            center: features[0].geometry.coordinates,
            zoom: zoom,
            duration: 500
          });
        }
      );
    });

    // Cursor handling
    this.map.on('mouseenter', 'clusters', () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', 'clusters', () => {
      this.map.getCanvas().style.cursor = '';
    });

    // Point click
    this.map.on('click', 'unclustered-point', (e) => {
      const coordinates = e.features[0].geometry.coordinates.slice();
      const { iata, name, country } = e.features[0].properties;

      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        className: 'airport-popup'
      })
        .setLngLat(coordinates)
        .setHTML(`
          <div class="popup-content">
            <div class="popup-airport-name">${name}</div>
            <div class="popup-airport-code">${iata}</div>
            <div class="popup-country">🌍 ${country}</div>
          </div>
        `)
        .addTo(this.map);
    });

    this.map.on('mouseenter', 'unclustered-point', () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', 'unclustered-point', () => {
      this.map.getCanvas().style.cursor = '';
    });
  }

  add3DBuildings() {
    // Add 3D building layer
    const layers = this.map.getStyle().layers;
    const labelLayerId = layers.find(
      (layer) => layer.type === 'symbol' && layer.layout['text-field']
    ).id;
    
    this.map.addLayer(
      {
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'height']
          ],
          'fill-extrusion-base': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'min_height']
          ],
          'fill-extrusion-opacity': 0.6
        }
      },
      labelLayerId
    );
  }

  async updateAirports(filteredTrips = null) {
    try {
      let trips;
      
      if (filteredTrips) {
        trips = filteredTrips;
      } else {
        // Get the user's ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get all trips for the user
        const { data, error: tripsError } = await supabase
          .from('trips')
          .select(`
            trip_legs (
              from_airport,
              to_airport
            )
          `)
          .eq('user_id', user.id);

        if (tripsError) {
          console.error('Error fetching trips:', tripsError);
          return;
        }
        trips = data;
      }

      // Extract unique airport codes and flight paths from trips
      const visitedAirports = new Set();
      const flightPaths = [];
      
      trips.forEach(trip => {
        trip.trip_legs?.forEach(leg => {
          if (leg.from_airport) visitedAirports.add(leg.from_airport);
          if (leg.to_airport) visitedAirports.add(leg.to_airport);
          
          if (leg.from_airport && leg.to_airport) {
            flightPaths.push({
              from: leg.from_airport,
              to: leg.to_airport
            });
          }
        });
      });

      // Only fetch visited airports
      const { data: airports, error } = await supabase
        .from('airports')
        .select('iata, airport_name, country, latitude, longitude')
        .in('iata', Array.from(visitedAirports));

      if (error) {
        console.error('Error fetching airports:', error);
        return;
      }

      // Create airport features
      const features = airports.map(airport => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [airport.longitude, airport.latitude]
        },
        properties: {
          iata: airport.iata,
          name: airport.airport_name,
          country: airport.country
        }
      }));

      // Create flight path features
      const pathFeatures = flightPaths.map(path => {
        const fromAirport = airports.find(a => a.iata === path.from);
        const toAirport = airports.find(a => a.iata === path.to);
        
        if (!fromAirport || !toAirport) return null;

        return {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [fromAirport.longitude, fromAirport.latitude],
              [toAirport.longitude, toAirport.latitude]
            ]
          }
        };
      }).filter(Boolean);

      // Update the stored data
      this.currentAirports = {
        type: 'FeatureCollection',
        features: features
      };
      this.currentFlightPaths = {
        type: 'FeatureCollection',
        features: pathFeatures
      };

      // Update sources if they exist
      const airportsSource = this.map.getSource('airports');
      const flightPathsSource = this.map.getSource('flightPaths');

      if (airportsSource) {
        airportsSource.setData(this.currentAirports);
      }
      if (flightPathsSource) {
        flightPathsSource.setData(this.currentFlightPaths);
      }
    } catch (err) {
      console.error('Error updating airports:', err);
    }
  }

  // Method to fly to a specific airport
  flyToAirport(longitude, latitude) {
    this.map.flyTo({
      center: [longitude, latitude],
      zoom: 8,
      essential: true
    });
  }
} 
