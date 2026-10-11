import { Thermometer, Droplets, Wind, Sun } from 'lucide-react';

export default function EnvironmentalIntelligenceSection() {
  const variables = [
    {
      index: '01',
      title: 'Outdoor Dry-Bulb Temperature',
      value: '42.0°C',
      subtext: 'Summer Solstice Extreme',
      icon: <Thermometer size={18} strokeWidth={1.5} />,
      accentColor: 'var(--thermal-hot)',
      description:
        'Drives conductive heat flux across exterior masonry walls and roof slabs. Determines thermal lag and the duration of heat retention into night hours.'
    },
    {
      index: '02',
      title: 'Relative Humidity & Wet-Bulb',
      value: '68% · 26°C WB',
      subtext: 'Heat Stress Threshold',
      icon: <Droplets size={18} strokeWidth={1.5} />,
      accentColor: 'var(--thermal-cool)',
      description:
        'Governs human evaporative cooling limits. When wet-bulb exceeds 26°C, passive air movement becomes insufficient, requiring sensible mechanical cooling.'
    },
    {
      index: '03',
      title: 'Prevailing Wind Direction & Speed',
      value: '12 km/h NW',
      subtext: 'Microclimate Flow Vector',
      icon: <Wind size={18} strokeWidth={1.5} />,
      accentColor: 'var(--thermal-temperate)',
      description:
        'Creates positive pressure on windward facades and negative suction on leeward openings, activating cross-ventilation corridors across aligned rooms.'
    },
    {
      index: '04',
      title: 'Direct Solar Radiation',
      value: '890 W/m²',
      subtext: 'Incident Solar Noon Flux',
      icon: <Sun size={18} strokeWidth={1.5} />,
      accentColor: 'var(--thermal-warm)',
      description:
        'Penetrates unshaded glazing based on solar azimuth and altitude. West-facing apertures accumulate direct afternoon infrared radiation with severe heat penalty.'
    }
  ];

  return (
    <section
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
        <div style={{ maxWidth: '780px', marginBottom: '64px' }}>
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
            04 / Environmental Intelligence
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
            A building lives in conversation with its atmosphere.
          </h2>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.6,
              color: 'var(--text-secondary)'
            }}
          >
            Thermal behavior is never static. It is governed by continuous energy exchange between
            interior architectural boundaries and four primary environmental drivers.
          </p>
        </div>

        {/* 4 Variables Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '24px'
          }}
          className="environmental-grid"
        >
          {variables.map((item) => (
            <div
              key={item.index}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-hairline)',
                borderRadius: '8px',
                padding: '28px 24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.18s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-medium)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-hairline)';
              }}
            >
              <div>
                {/* Card Top: Index and Icon */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '20px'
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.04em'
                    }}
                  >
                    VAR {item.index}
                  </span>
                  <div style={{ color: item.accentColor }}>{item.icon}</div>
                </div>

                {/* Primary Data Metric */}
                <div style={{ marginBottom: '16px' }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '24px',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.02em',
                      lineHeight: 1.2
                    }}
                  >
                    {item.value}
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--text-muted)'
                    }}
                  >
                    {item.subtext}
                  </span>
                </div>

                <h3
                  style={{
                    fontSize: '15px',
                    fontWeight: 650,
                    color: 'var(--text-primary)',
                    marginBottom: '10px',
                    lineHeight: 1.3
                  }}
                >
                  {item.title}
                </h3>
              </div>

              <p
                style={{
                  fontSize: '13px',
                  lineHeight: 1.6,
                  color: 'var(--text-secondary)',
                  marginTop: '16px',
                  borderTop: '1px solid var(--border-hairline)',
                  paddingTop: '16px',
                  marginBottom: 0
                }}
              >
                {item.description}
              </p>
            </div>
          ))}
        </div>

        {/* Synthesis Note */}
        <div
          style={{
            marginTop: '36px',
            textAlign: 'center',
            fontSize: '13px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)'
          }}
        >
          DATA HARVESTED VIA OPEN-METEO HOURLY SOLAR ARRAYS & REGIONAL WEATHER REANALYSIS GRIDS
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .environmental-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 640px) {
          .environmental-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
