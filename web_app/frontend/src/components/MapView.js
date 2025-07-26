
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@ansur/leaflet-pulse-icon/dist/L.Icon.Pulse.js';
import 'leaflet-ajax';
import 'leaflet.locatecontrol';
import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
import { Box, Typography, List, ListItem, ListItemText, Divider, IconButton, Drawer, Fade } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';


const fetchHours = 3;
const maxNumMarkers = 250;



function MapView({ showIncidentListPanel }) {
  const mapRef = useRef(null);
  const [incidents, setIncidents] = useState([]);
  const [incidentPanelOpen, setIncidentPanelOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [showLoading, setShowLoading] = useState(true);
  const allIncidentsMap = useRef(new Map());

  useEffect(() => {
    if (!mapRef.current) {
      const map = L.map('map', {
        preferCanvas: true,
        minZoom: 10,
        maxZoom: 18,
      });
      map.setView([43.1427, -77.6161], 10);
      map.zoomControl.setPosition('bottomright');
      L.tileLayer('/get_tile/{z}/{x}/{y}', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        tileSize: 512,
        zoomOffset: -1,
      }).addTo(map);
      mapRef.current = map;

      // Add county border
      const countyBorderStyle = {
        color: 'rgba(255,0,30,0.36)',
        weight: 3,
        opacity: 0.6,
        fill: false,
        dashArray: '10',
      };
      new window.L.GeoJSON.AJAX('/static/monroe_county.json', { style: countyBorderStyle }).addTo(map);

      map.setMaxBounds(new L.LatLngBounds(new L.LatLng(42.65, -78.5), new L.LatLng(43.70, -76.80)));
      L.control.locate({ position: 'bottomright', strings: { title: 'Show me where I am' } }).addTo(map);
    }
  }, []);

  // Animated loading message logic
  const loadingMessages = [
    "Loading incidents...",
    "It's a little slow today...",
    "Hmm, this should be working by now...",
    "Well, this is awkward. Maybe try refreshing?"
  ];

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    setLoadingStep(0);
    setShowLoading(true);
    let step = 0;
    let errorTimeout = null;
    const MESSAGE_DURATION = 10000; // 10 seconds per message
    const interval = setInterval(() => {
      step++;
      setLoadingStep((prev) => {
        if (prev < loadingMessages.length - 1) {
          return prev + 1;
        } else {
          return prev;
        }
      });
      if (step >= loadingMessages.length - 1) {
        clearInterval(interval);
        // Only show error after the last message has been visible for 3s
        errorTimeout = setTimeout(() => {
          setShowLoading(false);
          setLoadError(true);
          setLoading(false);
        }, 3000);
      }
    }, MESSAGE_DURATION);

    fetch(`/incidents/init`)
      .then(res => res.json())
      .then(data => {
        setIncidents(data.map(msg => msg.data));
        setLoading(false);
        setShowLoading(false);
        clearInterval(interval);
        if (errorTimeout) clearTimeout(errorTimeout);
      })
      .catch(() => {
        // Always let the loading messages finish before showing error
        const remaining = (loadingMessages.length - 1 - step);
        if (remaining > 0) {
          // Keep advancing loadingStep even if fetch fails
          const advance = setInterval(() => {
            setLoadingStep(prev => {
              if (prev < loadingMessages.length - 1) {
                return prev + 1;
              } else {
                clearInterval(advance);
                return prev;
              }
            });
          }, MESSAGE_DURATION);
          errorTimeout = setTimeout(() => {
            setShowLoading(false);
            setLoadError(true);
            setLoading(false);
            clearInterval(advance);
          }, remaining * MESSAGE_DURATION + 3000);
        } else {
          setShowLoading(false);
          setLoadError(true);
          setLoading(false);
        }
        clearInterval(interval);
      });

    return () => {
      clearInterval(interval);
      if (errorTimeout) clearTimeout(errorTimeout);
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    // Remove old markers
    allIncidentsMap.current.forEach(inc => {
      if (inc.marker) mapRef.current.removeLayer(inc.marker);
    });
    allIncidentsMap.current.clear();
    // Add new markers
    incidents.forEach(inc => {
      const marker = L.marker([inc.lat, inc.lon], {
        icon: L.icon.pulse({ iconSize: [10, 10], color: 'blue' }),
        title: inc.id,
      });
      marker.bindPopup(`<h4 style='text-align:center;'><span style='color:#000'><strong>${inc.type}</strong></span></h4><h5 style='text-align:center;'><span style='color:#323232;'>${inc.addr}</span></h5><h5 style='text-align:center;'>ID: ${inc.id}</h5>`);
      marker.addTo(mapRef.current);
      allIncidentsMap.current.set(inc.id, { ...inc, marker });
    });
  }, [incidents]);

  // Modern incident list panel
  const IncidentListPanel = (
    <Drawer
      anchor="right"
      open={incidentPanelOpen && showIncidentListPanel}
      onClose={() => setIncidentPanelOpen(false)}
      PaperProps={{ sx: { width: 350, maxWidth: '90vw', p: 2 } }}
      variant="persistent"
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>Live Incidents</Typography>
        <IconButton onClick={() => setIncidentPanelOpen(false)}><CloseIcon /></IconButton>
      </Box>
      <Divider />
      <List sx={{ maxHeight: '80vh', overflow: 'auto' }}>
        {incidents.length === 0 && <ListItem><ListItemText primary="No incidents found." /></ListItem>}
        {incidents.map((inc) => (
          <ListItem key={inc.id} alignItems="flex-start" sx={{ mb: 1, borderRadius: 2, bgcolor: 'background.paper', boxShadow: 1 }}>
            <ListItemText
              primary={<>
                <Typography variant="subtitle1" fontWeight={600}>{inc.type}</Typography>
                <Typography variant="body2" color="text.secondary">{inc.addr}</Typography>
              </>}
              secondary={<>
                <Typography variant="caption" color="text.secondary">ID: {inc.id}</Typography>
              </>}
            />
          </ListItem>
        ))}
      </List>
    </Drawer>
  );

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <div id="map" style={{ height: '100vh', width: '100vw', zIndex: 1 }}></div>
      {showLoading && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', bgcolor: 'rgba(255,255,255,0.85)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ mb: 4 }}>
            <Box sx={{
              width: 80,
              height: 80,
              border: '8px solid #1976d2',
              borderTop: '8px solid #fff',
              borderRadius: '50%',
              animation: 'spin 1.2s linear infinite',
              margin: '0 auto',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' }
              }
            }} />
          </Box>
          <Fade in={true} timeout={600}>
            <Typography variant="h6" align="center" sx={{ minHeight: 32 }}>
              {loadingMessages[loadingStep]}
            </Typography>
          </Fade>
        </Box>
      )}
      {loadError && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', bgcolor: 'rgba(255,255,255,0.95)', zIndex: 2100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="h5" color="error" sx={{ mb: 2 }}>Unable to load incidents</Typography>
          <Typography variant="body1" color="text.secondary">The backend may be offline or misconfigured.</Typography>
        </Box>
      )}
      {showIncidentListPanel && IncidentListPanel}
    </Box>
  );
}

export default MapView;
