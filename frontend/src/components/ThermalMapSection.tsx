import { useState } from 'react';
import { Info } from 'lucide-react';

interface ZoneDetail {
  id: string;
  name: string;
  tempC: number;
  orientation: string;
  heatLoad: 'Low' | 'Medium' | 'High' | 'Severe';
  coolingType: string;
  airflow: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fillColor: string;
  strokeColor: string;
}

const sampleZones: ZoneDetail[] = [
  {
    id: 'z1',
    name: 'Bedroom #2',
    tempC: 32.2,
    orientation: 'North-West (Unshaded Glazing)',
    heatLoad: 'High',
    coolingType: '1.5T Inverter Split AC',
    airflow: '460 CFM (52" BLDC Ceiling Fan)',
    x: 40,
    y: 35,
    w: 160,
    h: 190,
    fillColor: '#D96B43',
    strokeColor: '#C1492C'
  },
  {
    id: 'z2',
    name: 'Bedroom #3',
    tempC: 29.8,
    orientation: 'North (Buffer Zone)',
    heatLoad: 'Medium',
    coolingType: '1.0T Split AC',
    airflow: '380 CFM (48" Aerodynamic Fan)',
    x: 200,
    y: 35,
    w: 120,
    h: 190,
    fillColor: '#E09F3E',
    strokeColor: '#C98B32'
  },
  {
    id: 'z3',
    name: 'Master Bedroom Suite',
    tempC: 34.1,
    orientation: 'East-South (Direct Morning & Solar Noon)',
    heatLoad: 'Severe',
    coolingType: '2.0T Dual-Inverter Split',
    airflow: '520 CFM (56" Smart BLDC Fan)',
    x: 320,
    y: 35,
    w: 200,
    h: 190,
    fillColor: '#C1492C',
    strokeColor: '#9C341C'
  },
  {
    id: 'z4',
    name: 'Family Lounge & Living',
    tempC: 31.4,
    orientation: 'West (Deep Afternoon Glazing)',
    heatLoad: 'High',
    coolingType: '2.5T Cassette AC',
    airflow: '780 CFM (Dual Synchronized Fans)',
    x: 40,
    y: 225,
    w: 175,
    h: 230,
    fillColor: '#E09F3E',
    strokeColor: '#C98B32'
  },
  {
    id: 'z5',
    name: 'Dining & Kitchen Zone',
    tempC: 28.5,
    orientation: 'East (Internal Thermal Core)',
    heatLoad: 'Medium',
    coolingType: 'Dedicated Kitchen Exhaust + 1.5T AC',
    airflow: '450 CFM (Outdoor Ducted Ventilation)',
    x: 215,
    y: 225,
    w: 185,
    h: 230,
    fillColor: '#5B9279',
    strokeColor: '#45735E'
  },
  {
    id: 'z6',
    name: 'En-Suite & Powder Baths',
    tempC: 27.2,
    orientation: 'Core Protected Utility',
    heatLoad: 'Low',
    coolingType: 'Natural Stack Gravity Vent',
    airflow: '120 CFM (High Wall Louver)',
    x: 400,
    y: 225,
    w: 120,
    h: 230,
    fillColor: '#4A7C92',
    strokeColor: '#396173'
  }
];

export default function ThermalMapSection() {
  const [activeLayer, setActiveLayer] = useState<'thermal' | 'ventilation' | 'cad' | 'backend'>('thermal');
  const [selectedZone, setSelectedZone] = useState<ZoneDetail>(sampleZones[2]); // Master suite default
  const [hoveredZone, setHoveredZone] = useState<ZoneDetail | null>(null);

  const displayZone = hoveredZone || selectedZone;

  return (
    <section
      id="thermal-map"
      style={{
        padding: '100px 0',
        borderBottom: '1px solid var(--border-hairline)',
        backgroundColor: 'var(--bg-primary)'
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 24px'
        }}
      >
        {/* Section Header */}
        <div style={{ maxWidth: '780px', marginBottom: '48px' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--thermal-hot)',
              display: 'block',
              marginBottom: '16px'
            }}
          >
            03 / Product Deep Dive
          </span>
          <h2
            style={{
              fontSize: 'clamp(32px, 4vw, 44px)',
              lineHeight: 1.15,
              fontWeight: 650,
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
              marginBottom: '18px'
            }}
          >
            A closer look at the thermal map
          </h2>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.6,
              color: 'var(--text-secondary)'
            }}
          >
            Scientific architectural drawings rendered with razor-sharp vector lines, discrete room
            thermal load gradients, and environmental boundary conditions.
          </p>
        </div>

        {/* Layer Controls Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '24px',
            backgroundColor: 'var(--bg-card)',
            padding: '12px 18px',
            borderRadius: '8px',
            border: '1px solid var(--border-hairline)'
          }}
        >
          {/* Layer Selection Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginRight: '6px'
              }}
            >
              ACTIVE LAYER:
            </span>
            <button
              onClick={() => setActiveLayer('thermal')}
              style={{
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: 500,
                borderRadius: '5px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeLayer === 'thermal' ? 'var(--text-primary)' : 'var(--bg-subtle)',
                color: activeLayer === 'thermal' ? '#FAF9F5' : 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              Thermal Map
            </button>
            <button
              onClick={() => setActiveLayer('ventilation')}
              style={{
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: 500,
                borderRadius: '5px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeLayer === 'ventilation' ? 'var(--text-primary)' : 'var(--bg-subtle)',
                color: activeLayer === 'ventilation' ? '#FAF9F5' : 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              Ventilation Vectors
            </button>
            <button
              onClick={() => setActiveLayer('cad')}
              style={{
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: 500,
                borderRadius: '5px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeLayer === 'cad' ? 'var(--text-primary)' : 'var(--bg-subtle)',
                color: activeLayer === 'cad' ? '#FAF9F5' : 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              Architectural CAD
            </button>
            <button
              onClick={() => setActiveLayer('backend')}
              style={{
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: 500,
                borderRadius: '5px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeLayer === 'backend' ? 'var(--text-primary)' : 'var(--bg-subtle)',
                color: activeLayer === 'backend' ? '#FAF9F5' : 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              Pipeline Output
            </button>
          </div>

          {/* Timestamp Indicator */}
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11.5px',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--thermal-hot)'
                }}
              />
              SOLAR NOON · 14:00 AZIMUTH
            </span>
            <span>|</span>
            <span>OUTDOOR DRY BULB: 42.0°C</span>
          </div>
        </div>

        {/* Visualizer & Inspector Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 0.65fr)',
            gap: '24px',
            alignItems: 'stretch'
          }}
          className="thermal-map-container"
        >
          {/* Main SVG Display Box */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '8px',
              padding: '24px',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {activeLayer === 'backend' ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '440px',
                  backgroundColor: '#FAF9F5',
                  borderRadius: '6px',
                  border: '1px solid var(--border-hairline)',
                  padding: '16px'
                }}
              >
                <img
                  src="/assets/floorplan_thermal.png"
                  alt="Raw generated thermal floor plan"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '440px',
                    objectFit: 'contain',
                    display: 'block'
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  backgroundColor: '#FAF9F5',
                  borderRadius: '6px',
                  border: '1px solid var(--border-hairline)',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '440px'
                }}
              >
                <svg
                  viewBox="0 0 560 480"
                  style={{ width: '100%', height: '100%', maxHeight: '460px' }}
                >
                  <defs>
                    {/* Architectural Grid Pattern */}
                    <pattern id="archGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="0" x2="20" y2="0" stroke="rgba(20, 20, 19, 0.03)" strokeWidth="1" />
                      <line x1="0" y1="0" x2="0" y2="20" stroke="rgba(20, 20, 19, 0.03)" strokeWidth="1" />
                    </pattern>
                  </defs>

                  <rect x="0" y="0" width="560" height="480" fill="url(#archGrid)" />

                  {/* Outer Footprint Walls */}
                  <rect
                    x="35"
                    y="30"
                    width="490"
                    height="430"
                    fill="none"
                    stroke="#141413"
                    strokeWidth="4"
                  />
                  <rect
                    x="39"
                    y="34"
                    width="482"
                    height="422"
                    fill="none"
                    stroke="#141413"
                    strokeWidth="1"
                    strokeDasharray="4 2"
                  />

                  {/* Render Room Zones */}
                  {sampleZones.map((zone) => {
                    const isSelected = selectedZone.id === zone.id;
                    const isHovered = hoveredZone?.id === zone.id;
                    const opacity =
                      activeLayer === 'cad'
                        ? 0.04
                        : isSelected || isHovered
                        ? 0.55
                        : 0.35;

                    return (
                      <g
                        key={zone.id}
                        onClick={() => setSelectedZone(zone)}
                        onMouseEnter={() => setHoveredZone(zone)}
                        onMouseLeave={() => setHoveredZone(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Zone Fill Polygon */}
                        <rect
                          x={zone.x}
                          y={zone.y}
                          width={zone.w}
                          height={zone.h}
                          fill={activeLayer === 'cad' ? '#141413' : zone.fillColor}
                          fillOpacity={opacity}
                          stroke={isSelected ? '#141413' : zone.strokeColor}
                          strokeWidth={isSelected ? '2.5' : '1.2'}
                          style={{ transition: 'all 0.18s ease' }}
                        />

                        {/* Zone Label & Temperature */}
                        <text
                          x={zone.x + zone.w / 2}
                          y={zone.y + zone.h / 2 - 10}
                          fill="#141413"
                          fontSize="11"
                          fontWeight="600"
                          fontFamily="var(--font-sans)"
                          textAnchor="middle"
                        >
                          {zone.name}
                        </text>

                        {activeLayer !== 'cad' && (
                          <text
                            x={zone.x + zone.w / 2}
                            y={zone.y + zone.h / 2 + 10}
                            fill="#141413"
                            fontSize="13"
                            fontWeight="700"
                            fontFamily="var(--font-mono)"
                            textAnchor="middle"
                          >
                            {zone.tempC}°C
                          </text>
                        )}

                        <text
                          x={zone.x + zone.w / 2}
                          y={zone.y + zone.h / 2 + 26}
                          fill="#575651"
                          fontSize="9"
                          fontFamily="var(--font-mono)"
                          textAnchor="middle"
                        >
                          {activeLayer === 'cad' ? `${zone.w * 3} × ${zone.h * 3} mm` : zone.heatLoad.toUpperCase()}
                        </text>

                        {/* Selected Indicator Ping */}
                        {isSelected && (
                          <circle
                            cx={zone.x + 14}
                            cy={zone.y + 14}
                            r="4"
                            fill="#141413"
                          />
                        )}
                      </g>
                    );
                  })}

                  {/* Architectural Fenestrations / Windows */}
                  <line x1="80" y1="30" x2="150" y2="30" stroke="#4A7C92" strokeWidth="5" />
                  <line x1="230" y1="30" x2="280" y2="30" stroke="#4A7C92" strokeWidth="5" />
                  <line x1="380" y1="30" x2="460" y2="30" stroke="#4A7C92" strokeWidth="5" />
                  <line x1="525" y1="80" x2="525" y2="160" stroke="#4A7C92" strokeWidth="5" />
                  <line x1="35" y1="280" x2="35" y2="360" stroke="#4A7C92" strokeWidth="5" />
                  <line x1="120" y1="460" x2="190" y2="460" stroke="#4A7C92" strokeWidth="5" />

                  {/* Ventilation Flow Overlays if Active */}
                  {activeLayer === 'ventilation' && (
                    <g opacity="0.85">
                      {/* Flow Vector 1 */}
                      <path
                        d="M 115 30 Q 120 180 230 250"
                        fill="none"
                        stroke="#4A7C92"
                        strokeWidth="2.5"
                        strokeDasharray="6 4"
                      />
                      {/* Flow Vector 2 */}
                      <path
                        d="M 525 120 Q 380 180 300 280"
                        fill="none"
                        stroke="#4A7C92"
                        strokeWidth="2.5"
                        strokeDasharray="6 4"
                      />
                      {/* Flow Vector 3 (Cross Breeze) */}
                      <path
                        d="M 35 320 C 180 320, 240 380, 480 380"
                        fill="none"
                        stroke="#5B9279"
                        strokeWidth="2.5"
                        strokeDasharray="6 4"
                      />
                      <text x="240" y="310" fill="#4A7C92" fontSize="9" fontFamily="var(--font-mono)">
                        CROSS-VENTILATION CORRIDOR (12 KM/H)
                      </text>
                    </g>
                  )}

                  {/* North Cardinal Indicator */}
                  <g transform="translate(485, 420)">
                    <circle cx="16" cy="16" r="14" fill="#FAF9F5" stroke="#141413" strokeWidth="1" />
                    <line x1="16" y1="6" x2="16" y2="26" stroke="#141413" strokeWidth="1.5" />
                    <polygon points="16,6 12,14 20,14" fill="#141413" />
                    <text x="16" y="4" fill="#141413" fontSize="8" fontWeight="700" fontFamily="var(--font-mono)" textAnchor="middle">
                      N
                    </text>
                  </g>
                </svg>
              </div>
            )}

            {/* Scientific Thermal Legend */}
            <div
              style={{
                marginTop: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--text-muted)'
                  }}
                >
                  THERMAL SCALE:
                </span>
                <span style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  24°C
                </span>
                <div
                  style={{
                    width: '140px',
                    height: '8px',
                    borderRadius: '4px',
                    background:
                      'linear-gradient(to right, #4A7C92, #5B9279, #E09F3E, #D96B43, #C1492C)'
                  }}
                />
                <span style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  36°C+
                </span>
              </div>

              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-muted)'
                }}
              >
                CLICK ANY ZONE TO INSPECT
              </div>
            </div>
          </div>

          {/* Right Column: Zone Inspector Sidebar */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '8px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div
                style={{
                  borderBottom: '1px solid var(--border-hairline)',
                  paddingBottom: '16px',
                  marginBottom: '20px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.06em'
                    }}
                  >
                    ZONE TELEMETRY
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor:
                        displayZone.heatLoad === 'Severe'
                          ? '#FDE8E8'
                          : displayZone.heatLoad === 'High'
                          ? '#FEF0E6'
                          : '#EAF3ED',
                      color:
                        displayZone.heatLoad === 'Severe'
                          ? '#C1492C'
                          : displayZone.heatLoad === 'High'
                          ? '#D96B43'
                          : '#45735E',
                      fontWeight: 600
                    }}
                  >
                    {displayZone.heatLoad.toUpperCase()} LOAD
                  </span>
                </div>
                <h3
                  style={{
                    fontSize: '20px',
                    fontWeight: 650,
                    color: 'var(--text-primary)',
                    marginTop: '8px',
                    letterSpacing: '-0.02em'
                  }}
                >
                  {displayZone.name}
                </h3>
              </div>

              {/* Stat Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>
                    Calculated Equilibrium Temperature
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '28px',
                      fontWeight: 700,
                      color: displayZone.strokeColor
                    }}
                  >
                    {displayZone.tempC}°C
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>
                    Orientation & Glazing Exposure
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {displayZone.orientation}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>
                    Recommended Cooling Specification
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {displayZone.coolingType}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>
                    Ventilation & Aerodynamic Target
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {displayZone.airflow}
                  </span>
                </div>
              </div>
            </div>

            {/* Scientific Integrity Callout */}
            <div
              style={{
                marginTop: '28px',
                padding: '14px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: '6px',
                border: '1px solid var(--border-hairline)',
                fontSize: '12px',
                lineHeight: 1.5,
                color: 'var(--text-secondary)'
              }}
            >
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                <Info size={13} color="var(--text-muted)" />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  Modeling Notice
                </span>
              </div>
              Values are illustrative spatial estimations derived from 2D wall polygons and regional
              microclimate indices. Temperature outputs are not calibrated CFD readings.
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .thermal-map-container {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
