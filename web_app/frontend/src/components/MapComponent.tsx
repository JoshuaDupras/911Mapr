"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default icon paths for Next.js
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
});

interface Incident {
  id: string;
  type: string;
  addr: string;
  lat: number;
  lon: number;
  timestamp?: string;
}

interface MapComponentProps {
  incidents: Incident[];
  focusedIncident: Incident | null;
  handleIncidentClick: (incident: Incident) => void;
}

export default function MapComponent({ incidents, focusedIncident, handleIncidentClick }: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const previousView = useRef<L.LatLngExpression | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!leafletMapRef.current) {
      console.log("Initializing Leaflet map...");
      leafletMapRef.current = L.map(mapRef.current).setView([43.161, -77.6109], 11);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.carto.com/">CARTO</a> contributors',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(leafletMapRef.current);
    }
  }, []);

  useEffect(() => {
    if (leafletMapRef.current) {
      // Remove existing markers
      leafletMapRef.current.eachLayer((layer) => {
        if ((layer as any).options && (layer as any).options.pane === "markerPane") {
          leafletMapRef.current?.removeLayer(layer);
        }
      });

      const customIcon = L.divIcon({
        className: "custom-marker",
        html: '<div class="w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-white"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const focusedIcon = L.divIcon({
        className: "focused-marker",
        html: '<div class="w-6 h-6 bg-yellow-500 rounded-full animate-pulse border-4 border-white"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      // Add incident markers
      incidents.forEach((incident) => {
        const isFocused = focusedIncident && focusedIncident.id === incident.id;
        L.marker([incident.lat, incident.lon], { icon: isFocused ? focusedIcon : customIcon })
          .addTo(leafletMapRef.current!)
          .on('click', () => {
            handleIncidentClick(incident);
          });
      });

      leafletMapRef.current.zoomControl.setPosition("bottomright");
    }
  }, [incidents, focusedIncident]);

  useEffect(() => {
    if (focusedIncident && leafletMapRef.current) {
      leafletMapRef.current.setView([focusedIncident.lat, focusedIncident.lon], 14);
    } else if (previousView.current && leafletMapRef.current) {
      leafletMapRef.current.setView(previousView.current, 11);
    }
  }, [focusedIncident, previousView]);

  const restorePreviousView = () => {
    if (leafletMapRef.current) {
      leafletMapRef.current.setView([43.161, -77.6109], 11); // Default view
    }
  };

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded-lg shadow-lg"
      style={{ minHeight: "400px", minWidth: "300px", background: "#e0e7ff", border: "2px solid red" }}
    />
  );
}
