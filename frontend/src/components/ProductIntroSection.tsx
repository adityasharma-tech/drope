import { useState } from 'react';

export default function ProductIntroSection() {
  const [activeView, setActiveView] = useState<'thermal' | 'original'>('thermal');

  return (
    <section
      id="product"
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
        {/* Section Index Eyebrow */}
        <div style={{ marginBottom: '16px' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--thermal-hot)'
            }}
          >
            01 / Product Foundation
          </span>
        </div>

        {/* Two-Column Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1.15fr)',
            gap: '64px',
            alignItems: 'start'
          }}
          className="product-intro-grid"
        >
          {/* Left Column: Explanatory Copy */}
          <div>
            <h2
              style={{
                fontSize: 'clamp(32px, 4.2vw, 48px)',
                lineHeight: 1.12,
                fontWeight: 650,
                letterSpacing: '-0.03em',
                color: 'var(--text-primary)',
                marginBottom: '20px'
              }}
            >
              A floor plan is more than geometry.
            </h2>

            <p
              style={{
                fontSize: '18px',
                lineHeight: 1.55,
                color: 'var(--text-secondary)',
                marginBottom: '28px'
              }}
            >
              It is the starting point for understanding how a building interacts with its
              environment.
            </p>

            <p
              style={{
                fontSize: '15px',
                lineHeight: 1.65,
                color: 'var(--text-secondary)',
                marginBottom: '36px'
              }}
            >
              Traditional blueprints capture dimensions and partition lines, but leave thermal
              behavior invisible. By parsing wall thickness, glazing orientations, cross-ventilation
              corridors, and room volumes, DROPE models how outdoor solar radiation and regional
              wind pressures penetrate into each living space.
            </p>

            {/* Architectural Data Points */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                borderTop: '1px solid var(--border-hairline)',
                paddingTop: '28px'
              }}
            >
              <div style={{ display: 'flex', gap: '16px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    minWidth: '24px'
                  }}
                >
                  01
                </span>
                <div>
                  <h3
                    style={{
                      fontSize: '14.5px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '4px'
                    }}
                  >
                    Spatial Boundary Detection
                  </h3>
                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0 }}>
                    Identifies structural masonry, interior partitions, door thresholds, and window
                    openings directly from 2D architectural drawings.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    minWidth: '24px'
                  }}
                >
                  02
                </span>
                <div>
                  <h3
                    style={{
                      fontSize: '14.5px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '4px'
                    }}
                  >
                    Orientation & Solar Exposure
                  </h3>
                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0 }}>
                    Indexes rooms by cardinal azimuth to calculate incident afternoon solar loads
                    and west-facing glazing penalties.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    minWidth: '24px'
                  }}
                >
                  03
                </span>
                <div>
                  <h3
                    style={{
                      fontSize: '14.5px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '4px'
                    }}
                  >
                    Thermal Differential Mapping
                  </h3>
                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0 }}>
                    Synthesizes heat accumulation zones to provide actionable passive cooling and
                    glazing recommendations before construction begins.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Architectural Visualization */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '8px',
              padding: '24px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.03)'
            }}
          >
            {/* View Switcher Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
                borderBottom: '1px solid var(--border-hairline)',
                paddingBottom: '16px',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted)'
                  }}
                >
                  SPECIMEN: 3-BEDROOM RESIDENTIAL PLAN (1,850 SQ FT)
                </span>
              </div>

              {/* Toggle Buttons */}
              <div
                style={{
                  display: 'inline-flex',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: '6px',
                  padding: '3px',
                  border: '1px solid var(--border-hairline)'
                }}
              >
                <button
                  onClick={() => setActiveView('thermal')}
                  style={{
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: activeView === 'thermal' ? '#FFFFFF' : 'transparent',
                    color: activeView === 'thermal' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: activeView === 'thermal' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Thermal Heat Map
                </button>
                <button
                  onClick={() => setActiveView('original')}
                  style={{
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: activeView === 'original' ? '#FFFFFF' : 'transparent',
                    color: activeView === 'original' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: activeView === 'original' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Architectural Blueprint
                </button>
              </div>
            </div>

            {/* Plan Display Area */}
            <div
              style={{
                position: 'relative',
                borderRadius: '6px',
                overflow: 'hidden',
                backgroundColor: '#FAF9F5',
                border: '1px solid var(--border-hairline)',
                minHeight: '380px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <img
                src={activeView === 'thermal' ? '/assets/floorplan_thermal.png' : '/assets/floorplan_original.png'}
                alt={activeView === 'thermal' ? 'Thermal heatmap floor plan' : 'Original architectural blueprint'}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '460px',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />

              {/* Annotation Badge */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  backgroundColor: 'rgba(250, 249, 245, 0.92)',
                  backdropFilter: 'blur(8px)',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-hairline)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10.5px',
                  color: 'var(--text-secondary)'
                }}
              >
                {activeView === 'thermal'
                  ? 'COLOR SPECTRUM: 26°C COOL BLUE TO 36°C PEAK AMBER'
                  : 'RAW GEOMETRY: PARTITION WALLS & OPENINGS EXTRACTED'}
              </div>
            </div>

            {/* Metric Footer */}
            <div
              style={{
                marginTop: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                borderTop: '1px solid var(--border-hairline)',
                paddingTop: '16px'
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                  ORIENTATION
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  NE Entrance / SW Glazed
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                  EXTRACTED ZONES
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  6 Discrete Living Zones
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                  SIMULATION STATUS
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--thermal-hot)' }}>
                  Illustrative Physical Model
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .product-intro-grid {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
          }
        }
      `}</style>
    </section>
  );
}
