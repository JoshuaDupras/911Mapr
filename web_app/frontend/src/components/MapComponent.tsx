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
}

export default function MapComponent({ incidents }: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);

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

      const customIcon = L.divIcon({
        className: "custom-marker",
        html: '<div class="w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-white"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      // Remove existing markers
      leafletMapRef.current.eachLayer((layer) => {
        if ((layer as any).options && (layer as any).options.pane === "markerPane") {
          leafletMapRef.current?.removeLayer(layer);
        }
      });
      // Add incident markers
      incidents.forEach((incident) => {
        L.marker([incident.lat, incident.lon], { icon: customIcon })
          .addTo(leafletMapRef.current!)
          .bindPopup(
            `<strong>${incident.type}</strong><br/>${incident.addr}<br/><small>ID: ${incident.id}${incident.timestamp ? `<br/>${new Date(incident.timestamp).toLocaleString()}` : ""}</small>`
          );
      });

      leafletMapRef.current.zoomControl.setPosition("bottomright");
    }
  }, [incidents]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded-lg shadow-lg"
      style={{ minHeight: "400px", minWidth: "300px", background: "#e0e7ff", border: "2px solid red" }}
    />
  );
}
