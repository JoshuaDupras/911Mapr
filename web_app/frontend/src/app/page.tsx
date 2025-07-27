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
  const [focusedIncident, setFocusedIncident] = useState<Incident | null>(null);
  const [previousView, setPreviousView] = useState<[number, number] | null>(null);
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
    async function fetchInitialIncidents() {
      try {
        const res = await fetch(`/incidents/init`);
        if (!res.ok) throw new Error("Failed to fetch initial incidents");
        const data = await res.json();

        console.log("Fetched initial incidents:", data);

        if (Array.isArray(data)) {
          setIncidents(data.map((msg) => msg.data));
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

    function connectToLiveStream() {
      const eventSource = new EventSource(`/incidents/live`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Received live incident:", data);

          if (data.heartbeat) {
            console.log("Heartbeat received:", data.heartbeat);
          } else {
            setIncidents((prevIncidents) => [...prevIncidents, data]);
          }
        } catch (err) {
          console.error("Error processing live incident:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.error("Error with live stream connection:", err);
        eventSource.close();
      };
    }

    fetchInitialIncidents();
    connectToLiveStream();
  }, []);

  const handleIncidentClick = (incident: Incident) => {
    if (!focusedIncident) {
      setPreviousView([43.161, -77.6109]); // Store the default view
    }
    setFocusedIncident(incident);
  };

  const exitFocusView = () => {
    setFocusedIncident(null);
    setPreviousView(null);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <Map incidents={incidents} focusedIncident={focusedIncident} handleIncidentClick={handleIncidentClick} />
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

          {/* Live Event Feed */}
          {sidebarOpen && (
            <div className="fixed top-20 left-6 z-[1000] w-96 max-h-[80vh] overflow-y-auto bg-transparent rounded-xl shadow-2xl p-0 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-2 px-6 pt-6">Live Events</h2>
              {loading ? (
                <div className="text-gray-300 px-6 pb-6">Loading...</div>
              ) : error ? (
                <div className="text-red-500 font-semibold px-6 pb-6">{error}</div>
              ) : incidents.length === 0 ? (
                <div className="text-gray-300 px-6 pb-6">No events found.</div>
              ) : (
                <ul className="divide-y divide-gray-700">
                  {incidents.map((incident, idx) => (
                    <li
                      key={incident.id + '-' + idx}
                      className="group px-6 py-4 bg-gray-800 hover:bg-gray-700 transition-all duration-300 flex flex-col gap-1 relative cursor-pointer"
                      onClick={() => handleIncidentClick(incident)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-lg">{incident.type || "Event"}</span>
                        <span className="text-sm text-gray-400">{new Date(incident.timestamp || Date.now()).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-sm text-gray-400 font-mono">{incident.addr || "No address"}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {focusedIncident && (
            <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[1000] w-[80vw] max-h-[80vh] overflow-y-auto bg-gray-900 rounded-xl shadow-2xl p-6 border border-gray-700">
              <button
                className="absolute top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-full"
                onClick={exitFocusView}
              >
                Close
              </button>
              <h2 className="text-2xl font-bold text-white mb-4">{focusedIncident.type}</h2>
              <p className="text-gray-300">{focusedIncident.addr}</p>
              <p className="text-gray-400">ID: {focusedIncident.id}</p>
              <p className="text-gray-500">Lat: {focusedIncident.lat}, Lon: {focusedIncident.lon}</p>
              <p className="text-gray-600">Timestamp: {new Date(focusedIncident.timestamp || Date.now()).toLocaleString()}</p>
            </div>
          )}
        </>,
        document.body
      )}
    </div>
  );
}
