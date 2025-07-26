"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Leaflet CSS import (required for map styling)
import "leaflet/dist/leaflet.css";

// Dynamic import for Leaflet (avoids SSR issues)
import dynamic from "next/dynamic";

const Map = dynamic(
  () => import("../components/MapComponent"),
  { ssr: false }
);

export default function Home() {
  type Incident = {
    id: string;
    type: string;
    addr: string;
    lat: number;
    lon: number;
    timestamp?: string;
  };
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Use a portal for overlays to avoid map re-renders affecting UI
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Ensure sidebar state persists across refreshes
  useEffect(() => {
    const savedSidebarState = localStorage.getItem("sidebarOpen");
    if (savedSidebarState !== null) {
      setSidebarOpen(savedSidebarState === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebarOpen", sidebarOpen.toString());
  }, [sidebarOpen]);

  useEffect(() => {
    async function fetchIncidents() {
      try {
        const res = await fetch("/incidents/init");
        if (!res.ok) throw new Error("Failed to fetch incidents");
        const data = await res.json();
        // Old frontend: data.map(msg => msg.data)
        if (Array.isArray(data)) {
          setIncidents(data.map((msg: any) => msg.data));
        } else {
          setIncidents([]);
        }
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Unknown error");
        }
      } finally {
        setLoading(false);
      }
    }
    fetchIncidents();
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <Map incidents={incidents} />
      {isClient && createPortal(
        <>
          {/* Top Menu Overlay */}
          <div className="fixed top-0 left-0 w-full z-[1000] text-white flex items-center justify-between px-6 py-3">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="911Mapr Logo" className="h-8 w-8" />
              <span className="text-lg font-bold">911Mapr</span>
            </div>
            {/* Menu */}
            <nav className="flex gap-4">
              <a href="#" className="text-gray-300 hover:text-white transition">About</a>
              <a href="#" className="text-gray-300 hover:text-white transition">Incidents</a>
              <a href="#" className="text-gray-300 hover:text-white transition">Settings</a>
            </nav>
            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent text-gray-300 px-4 py-2 border border-gray-500 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Clock Overlay */}
          <div className="fixed bottom-4 right-4 z-[1000] text-gray-300 px-6 py-2 rounded-full">
            {new Date().toLocaleTimeString()} UTC
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
