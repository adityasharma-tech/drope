import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import {
  UploadCloud,
  Thermometer,
  Wind,
  Droplets,
  Compass,
  MapPin,
  Flame,
  RefreshCw,
  Layers,
  ArrowRight
} from 'lucide-react';

interface ClimateData {
  temperature: number;
  relativeHumidity: number;
  apparentTemperature: number;
  heatIndex: number;
  wetBulbTemperature: number;
  windSpeed: number;
  windDirectionDegrees: number;
  windDirectionCardinal: string;
}

interface RoomZone {
  name: string;
  primaryOrientation: string;
  recommendedCoolingType: string;
  estimatedHeatLoad: 'Low' | 'Medium' | 'High' | 'Severe';
}

interface AnalysisData {
  buildingType: string;
  totalAreaEstimateSqFt: number;
  orientation: string;
  extractedCoordinates: {
    name: string;
    latitude: number;
    longitude: number;
  };
  climateData: ClimateData;
  zones: RoomZone[];
  synthesisSummary: string;
  generatedMaps: {
    thermalMap: string;
    ventilationMap: string;
    coolingLayout: string;
    proposedPlan: string;
  };
}

interface ApiResponse {
  success: boolean;
  originalImage: string;
  analysis: AnalysisData;
}

const BACKEND_URL = 'http://localhost:5000';

export default function Dashboard() {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'thermal' | 'ventilation' | 'cooling' | 'proposed'>('thermal');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid floor design image file (PNG, JPG, SVG, WebP)');
      return;
    }
    setError(null);
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleClear = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/upload`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = (await res.json()) as ApiResponse;
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to upload and analyze image');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '36px 20px', width: '100%' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 8px', color: '#000000' }}>
          Floor Design Climate & Energy Analysis
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '15px' }}>
          Upload an architectural floor plan to extract coordinates, compute wet-bulb and wind dynamics, and generate 4 simulation maps.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {!result && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragActive ? '#000000' : '#d1d5db'}`,
            backgroundColor: dragActive ? '#f9fafb' : '#ffffff',
            borderRadius: '12px',
            padding: '48px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            marginBottom: '32px'
          }}
        >
          {previewUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <img
                src={previewUrl}
                alt="Floor Plan Preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '380px',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  border: '1px solid #e5e7eb'
                }}
              />
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 24px',
                    backgroundColor: '#000000',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '15px',
                    fontWeight: 600,
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      Analyzing Floor Plan & Simulating Maps...
                    </>
                  ) : (
                    <>
                      Run Environmental Simulation <ArrowRight size={18} />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={loading}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <UploadCloud size={32} color="#111827" />
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 600 }}>
                Drag and drop your floor plan image here
              </h3>
              <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#6b7280' }}>
                Floor designs only • Supports JPG, PNG, SVG, WebP
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '10px 22px',
                  backgroundColor: '#000000',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Select Floor Design Image
              </button>
            </>
          )}
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Simulation Complete
              </span>
              <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '4px 0 0', color: '#111827' }}>
                {result.analysis.buildingType} ({result.analysis.totalAreaEstimateSqFt} sq.ft)
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClear}
              style={{
                padding: '8px 16px',
                backgroundColor: '#000000',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500
              }}
            >
              Analyze Another Plan
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px'
          }}>
            <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '13px', marginBottom: '6px' }}>
                <MapPin size={16} /> Location Coordinates
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                {result.analysis.extractedCoordinates.name}
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>
                {result.analysis.extractedCoordinates.latitude.toFixed(4)}° N, {result.analysis.extractedCoordinates.longitude.toFixed(4)}° E
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '13px', marginBottom: '6px' }}>
                <Thermometer size={16} /> Temperature & Heat
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                {result.analysis.climateData.temperature}°C (Feels like {result.analysis.climateData.apparentTemperature}°C)
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Flame size={14} color="#ef4444" /> Heat Index: {result.analysis.climateData.heatIndex}°C
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '13px', marginBottom: '6px' }}>
                <Droplets size={16} /> Humidity & Wet Bulb
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                RH: {result.analysis.climateData.relativeHumidity}%
              </div>
              <div style={{ fontSize: '13px', color: '#2563eb', fontWeight: 500 }}>
                Wet Bulb: {result.analysis.climateData.wetBulbTemperature}°C
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '13px', marginBottom: '6px' }}>
                <Wind size={16} /> Wind Flow Direction
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                {result.analysis.climateData.windSpeed} km/h
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Compass size={14} /> {result.analysis.climateData.windDirectionCardinal} ({result.analysis.climateData.windDirectionDegrees}°)
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '10px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <h3 style={{ fontSize: '17px', fontWeight: 600, margin: '0 0 10px', color: '#111827' }}>
              AI Architectural & Thermal Synthesis
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '14px', lineHeight: 1.6, color: '#374151' }}>
              {result.analysis.synthesisSummary}
            </p>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {result.analysis.zones.map((zone, i) => (
                <div key={i} style={{
                  padding: '10px 14px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  fontSize: '13px'
                }}>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{zone.name}</div>
                  <div style={{ color: '#6b7280' }}>Orientation: {zone.primaryOrientation} • Heat: {zone.estimatedHeatLoad}</div>
                  <div style={{ color: '#0369a1', fontWeight: 500, marginTop: '2px' }}>{zone.recommendedCoolingType}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Layers size={20} />
              <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: '#111827' }}>
                Generated Simulation Maps
              </h3>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
              {(['thermal', 'ventilation', 'cooling', 'proposed'] as const).map((tab) => {
                const labels = {
                  thermal: '1. Thermal Map',
                  ventilation: '2. Ventilation Map',
                  cooling: '3. Cooling Layout',
                  proposed: '4. Proposed Plan'
                };
                const active = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: active ? '#000000' : 'transparent',
                      color: active ? '#ffffff' : '#374151',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            <div style={{
              backgroundColor: '#000000',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '420px',
              overflow: 'hidden'
            }}>
              {activeTab === 'thermal' && (
                <img
                  src={`${BACKEND_URL}${result.analysis.generatedMaps.thermalMap}`}
                  alt="Thermal Heat Map"
                  style={{ maxWidth: '100%', maxHeight: '600px', objectFit: 'contain', borderRadius: '4px' }}
                />
              )}
              {activeTab === 'ventilation' && (
                <img
                  src={`${BACKEND_URL}${result.analysis.generatedMaps.ventilationMap}`}
                  alt="Ventilation Windflow Map"
                  style={{ maxWidth: '100%', maxHeight: '600px', objectFit: 'contain', borderRadius: '4px' }}
                />
              )}
              {activeTab === 'cooling' && (
                <img
                  src={`${BACKEND_URL}${result.analysis.generatedMaps.coolingLayout}`}
                  alt="Cooling & HVAC Layout"
                  style={{ maxWidth: '100%', maxHeight: '600px', objectFit: 'contain', borderRadius: '4px' }}
                />
              )}
              {activeTab === 'proposed' && (
                <img
                  src={`${BACKEND_URL}${result.analysis.generatedMaps.proposedPlan}`}
                  alt="Proposed Architectural Optimization Plan"
                  style={{ maxWidth: '100%', maxHeight: '600px', objectFit: 'contain', borderRadius: '4px' }}
                />
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              marginTop: '16px'
            }}>
              {[
                { key: 'thermal', title: 'Thermal Map', url: result.analysis.generatedMaps.thermalMap },
                { key: 'ventilation', title: 'Ventilation Map', url: result.analysis.generatedMaps.ventilationMap },
                { key: 'cooling', title: 'Cooling Layout', url: result.analysis.generatedMaps.coolingLayout },
                { key: 'proposed', title: 'Proposed Plan', url: result.analysis.generatedMaps.proposedPlan }
              ].map((item) => (
                <div
                  key={item.key}
                  onClick={() => setActiveTab(item.key as any)}
                  style={{
                    cursor: 'pointer',
                    border: activeTab === item.key ? '2px solid #000000' : '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px',
                    backgroundColor: '#ffffff',
                    textAlign: 'center'
                  }}
                >
                  <img
                    src={`${BACKEND_URL}${item.url}`}
                    alt={item.title}
                    style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px', marginBottom: '6px' }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>
                    {item.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
