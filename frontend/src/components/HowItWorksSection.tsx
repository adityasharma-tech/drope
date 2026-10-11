import { useState } from 'react';
import { Maximize2, X, Cloud, Cpu, Database, Network } from 'lucide-react';
import { newArchImage, awsLogo, hackathonLogo } from '../assets/submissionLogos';

export default function HowItWorksSection() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section
      id="methodology"
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
        {/* Eyebrow & Headline */}
        <div style={{ maxWidth: '720px', marginBottom: '64px' }}>
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
            02 / Methodology
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
            How it works
          </h2>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.6,
              color: 'var(--text-secondary)'
            }}
          >
            A three-stage analytical pipeline translating raw two-dimensional floor drawings into
            physics-informed thermal spatial maps.
          </p>
        </div>

        {/* 3-Step Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '32px',
            marginBottom: '64px'
          }}
          className="how-it-works-grid"
        >
          {/* Step 1 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderTop: '1px solid var(--border-medium)',
              paddingTop: '28px'
            }}
          >
            <div style={{ marginBottom: '24px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: '0.04em'
                }}
              >
                01 — Understand the plan
              </span>
            </div>

            {/* Architectural Diagram 1: Plan Extraction */}
            <div
              style={{
                width: '100%',
                height: '190px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: '6px',
                border: '1px solid var(--border-hairline)',
                marginBottom: '24px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}
            >
              <svg viewBox="0 0 240 140" style={{ width: '100%', height: '100%' }}>
                {/* Exterior Boundary */}
                <rect x="20" y="20" width="200" height="100" fill="none" stroke="#141413" strokeWidth="2" />
                <rect x="23" y="23" width="194" height="94" fill="none" stroke="#141413" strokeWidth="0.75" strokeDasharray="3 2" />
                
                {/* Interior Partition Walls */}
                <line x1="95" y1="20" x2="95" y2="120" stroke="#141413" strokeWidth="1.5" />
                <line x1="165" y1="20" x2="165" y2="75" stroke="#141413" strokeWidth="1.5" />
                <line x1="95" y1="75" x2="220" y2="75" stroke="#141413" strokeWidth="1.5" />

                {/* Window Openings */}
                <line x1="45" y1="20" x2="70" y2="20" stroke="#4A7C92" strokeWidth="3" />
                <line x1="115" y1="20" x2="145" y2="20" stroke="#4A7C92" strokeWidth="3" />
                <line x1="220" y1="40" x2="220" y2="60" stroke="#4A7C92" strokeWidth="3" />
                <line x1="45" y1="120" x2="70" y2="120" stroke="#4A7C92" strokeWidth="3" />

                {/* Door Openings & Swings */}
                <path d="M 95 95 A 15 15 0 0 1 110 110" fill="none" stroke="#94928C" strokeWidth="0.8" strokeDasharray="2 2" />
                <line x1="95" y1="95" x2="110" y2="95" stroke="#141413" strokeWidth="1.2" />

                {/* Room Labels & Dimension Ticks */}
                <text x="57" y="68" fill="#575651" fontSize="8" fontFamily="var(--font-mono)" textAnchor="middle">ZONE_A</text>
                <text x="130" y="50" fill="#575651" fontSize="8" fontFamily="var(--font-mono)" textAnchor="middle">ZONE_B</text>
                <text x="192" y="50" fill="#575651" fontSize="8" fontFamily="var(--font-mono)" textAnchor="middle">BATH</text>
                <text x="157" y="102" fill="#575651" fontSize="8" fontFamily="var(--font-mono)" textAnchor="middle">LIVING</text>

                {/* Coordinate Markers */}
                <circle cx="20" cy="20" r="2" fill="#D96B43" />
                <circle cx="220" cy="20" r="2" fill="#D96B43" />
                <circle cx="220" cy="120" r="2" fill="#D96B43" />
                <circle cx="20" cy="120" r="2" fill="#D96B43" />
              </svg>
            </div>

            <p
              style={{
                fontSize: '14.5px',
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
                margin: 0
              }}
            >
              Extract rooms, walls, windows, openings, dimensions, and spatial relationships from
              an architectural floor plan.
            </p>
          </div>

          {/* Step 2 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderTop: '1px solid var(--border-medium)',
              paddingTop: '28px'
            }}
          >
            <div style={{ marginBottom: '24px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: '0.04em'
                }}
              >
                02 — Read the environment
              </span>
            </div>

            {/* Architectural Diagram 2: Environmental Conditions */}
            <div
              style={{
                width: '100%',
                height: '190px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: '6px',
                border: '1px solid var(--border-hairline)',
                marginBottom: '24px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}
            >
              <svg viewBox="0 0 240 140" style={{ width: '100%', height: '100%' }}>
                {/* Solar Arc */}
                <path d="M 30 115 A 95 70 0 0 1 210 115" fill="none" stroke="#E09F3E" strokeWidth="1.2" strokeDasharray="3 3" />
                
                {/* Solar Positions */}
                <circle cx="65" cy="65" r="4" fill="#E09F3E" />
                <text x="65" y="55" fill="#E09F3E" fontSize="7" fontFamily="var(--font-mono)" textAnchor="middle">10:00</text>
                
                <circle cx="120" cy="45" r="6" fill="#D96B43" />
                <line x1="120" y1="45" x2="120" y2="115" stroke="#D96B43" strokeWidth="0.75" strokeDasharray="2 2" />
                <text x="120" y="35" fill="#D96B43" fontSize="7.5" fontWeight="600" fontFamily="var(--font-mono)" textAnchor="middle">SOLAR NOON 890 W/m²</text>

                <circle cx="175" cy="65" r="4" fill="#E09F3E" />
                <text x="175" y="55" fill="#E09F3E" fontSize="7" fontFamily="var(--font-mono)" textAnchor="middle">16:00</text>

                {/* Ground Horizon Line */}
                <line x1="20" y1="115" x2="220" y2="115" stroke="#141413" strokeWidth="1" />
                <text x="25" y="127" fill="#8A8983" fontSize="7" fontFamily="var(--font-mono)">EAST</text>
                <text x="215" y="127" fill="#8A8983" fontSize="7" fontFamily="var(--font-mono)" textAnchor="end">WEST</text>

                {/* Wind Vector Vector */}
                <g transform="translate(170, 90)">
                  <line x1="0" y1="0" x2="-25" y2="10" stroke="#4A7C92" strokeWidth="1.5" />
                  <polygon points="-25,10 -17,8 -20,3" fill="#4A7C92" />
                  <text x="-12" y="22" fill="#4A7C92" fontSize="7" fontFamily="var(--font-mono)">NW 12 km/h</text>
                </g>
              </svg>
            </div>

            <p
              style={{
                fontSize: '14.5px',
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
                margin: 0
              }}
            >
              Combine the building's geometry with local temperature, humidity, wet-bulb temperature,
              wind, and solar conditions.
            </p>
          </div>

          {/* Step 3 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderTop: '1px solid var(--border-medium)',
              paddingTop: '28px'
            }}
          >
            <div style={{ marginBottom: '24px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: '0.04em'
                }}
              >
                03 — Reveal the thermal picture
              </span>
            </div>

            {/* Architectural Diagram 3: Thermal Distribution */}
            <div
              style={{
                width: '100%',
                height: '190px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: '6px',
                border: '1px solid var(--border-hairline)',
                marginBottom: '24px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}
            >
              <svg viewBox="0 0 240 140" style={{ width: '100%', height: '100%' }}>
                {/* Thermal Gradients on Zones */}
                <rect x="25" y="25" width="70" height="90" fill="#E09F3E" fillOpacity="0.35" stroke="#E09F3E" strokeWidth="1" />
                <text x="60" y="65" fill="#141413" fontSize="8" fontWeight="600" fontFamily="var(--font-mono)" textAnchor="middle">29.8°C</text>
                <text x="60" y="77" fill="#575651" fontSize="6.5" fontFamily="var(--font-mono)" textAnchor="middle">MODERATE</text>

                <rect x="98" y="25" width="65" height="45" fill="#4A7C92" fillOpacity="0.3" stroke="#4A7C92" strokeWidth="1" />
                <text x="130" y="47" fill="#141413" fontSize="8" fontWeight="600" fontFamily="var(--font-mono)" textAnchor="middle">27.5°C</text>
                <text x="130" y="58" fill="#575651" fontSize="6.5" fontFamily="var(--font-mono)" textAnchor="middle">SHADED</text>

                <rect x="166" y="25" width="50" height="45" fill="#5B9279" fillOpacity="0.25" stroke="#5B9279" strokeWidth="1" />
                <text x="191" y="47" fill="#141413" fontSize="8" fontWeight="600" fontFamily="var(--font-mono)" textAnchor="middle">26.8°C</text>

                {/* High Afternoon Solar Gain Zone */}
                <rect x="98" y="73" width="118" height="42" fill="#D96B43" fillOpacity="0.45" stroke="#D96B43" strokeWidth="1" />
                <text x="157" y="93" fill="#141413" fontSize="8.5" fontWeight="600" fontFamily="var(--font-mono)" textAnchor="middle">34.1°C</text>
                <text x="157" y="105" fill="#8A2C14" fontSize="6.5" fontWeight="500" fontFamily="var(--font-mono)" textAnchor="middle">PEAK HEAT ACCUMULATION</text>
              </svg>
            </div>

            <p
              style={{
                fontSize: '14.5px',
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
                margin: 0
              }}
            >
              Translate building geometry and environmental inputs into a thermal visualization
              designed to help people understand how their spaces respond to heat.
            </p>
          </div>
        </div>

        {/* Expansive, Prominent Architecture & Hackathon Submission Showcase */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid var(--border-medium)',
            padding: '36px',
            boxShadow: '0 12px 35px rgba(0, 0, 0, 0.03)',
            marginBottom: '36px'
          }}
        >
          {/* Header of Architecture Container with Prominent Submission Logos */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '24px',
              borderBottom: '1px solid var(--border-hairline)',
              paddingBottom: '24px',
              marginBottom: '32px'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--thermal-hot)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase'
                  }}
                >
                  SYSTEM RUNTIME TOPOLOGY
                </span>
                <span style={{ color: 'var(--border-medium)' }}>·</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--text-muted)'
                  }}
                >
                  AWS CLOUDFORMATION & SAM
                </span>
              </div>
              <h3
                style={{
                  fontSize: '26px',
                  fontWeight: 650,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                  margin: '0 0 6px'
                }}
              >
                AWS Cloud Infrastructure & Execution Pipeline
              </h3>
              <p style={{ margin: 0, fontSize: '14.5px', color: 'var(--text-secondary)', maxWidth: '680px' }}>
                Event-driven serverless orchestration coordinating floor plan ingestion, polygon
                geometry extraction, environmental telemetry, and thermal simulation.
              </p>
            </div>

            {/* Prominently Highlighted Hackathon Submission Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                backgroundColor: 'var(--bg-subtle)',
                padding: '12px 20px',
                borderRadius: '8px',
                border: '1px solid var(--border-medium)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.03)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--thermal-hot)'
                  }}
                >
                  SUBMITTED PROJECT
                </span>
                <span style={{ fontSize: '13px', fontWeight: 650, color: 'var(--text-primary)' }}>
                  AWS × GfG Challenge
                </span>
              </div>

              <div style={{ height: '32px', width: '1px', backgroundColor: 'var(--border-medium)' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img
                  src={awsLogo}
                  alt="Amazon Web Services"
                  style={{ height: '26px', width: 'auto', objectFit: 'contain' }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>×</span>
                <img
                  src={hackathonLogo}
                  alt="GeeksforGeeks Hackathon"
                  style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
                />
              </div>

              <button
                onClick={() => setModalOpen(true)}
                title="View Fullscreen"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginLeft: '4px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--text-primary)';
                  e.currentTarget.style.color = '#FAF9F5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
              >
                <Maximize2 size={13} />
                Expand
              </button>
            </div>
          </div>

          {/* BIG EXPANSIVE ARCHITECTURE DIAGRAM (NOT IN A SMALL BOX) */}
          <div
            onClick={() => setModalOpen(true)}
            style={{
              position: 'relative',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: '#FAF9F5',
              border: '1px solid var(--border-hairline)',
              cursor: 'zoom-in',
              padding: '32px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              minHeight: '680px'
            }}
          >
            <img
              src={newArchImage}
              alt="AWS CloudFormation Stack Serverless Architecture Diagram"
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: 'none',
                objectFit: 'contain',
                display: 'block'
              }}
            />

            {/* Overlay hint */}
            <div
              style={{
                position: 'absolute',
                bottom: '18px',
                right: '18px',
                backgroundColor: 'rgba(20, 20, 19, 0.8)',
                backdropFilter: 'blur(8px)',
                color: '#FAF9F5',
                padding: '6px 14px',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                pointerEvents: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
            >
              <Maximize2 size={13} />
              Full Resolution · Click to expand
            </div>
          </div>

          {/* Architectural Component Breakdown */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '24px',
              marginTop: '32px',
              borderTop: '1px solid var(--border-hairline)',
              paddingTop: '28px'
            }}
            className="arch-components-grid"
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Network size={16} color="var(--thermal-cool)" />
                <h4 style={{ fontSize: '14px', fontWeight: 650, color: 'var(--text-primary)', margin: 0 }}>
                  API & Edge Layer
                </h4>
              </div>
              <p style={{ fontSize: '13px', lineHeight: 1.55, color: 'var(--text-secondary)', margin: 0 }}>
                Amazon S3 static frontend coupled with API Gateway endpoints for secure floor design
                upload and real-time status polling.
              </p>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Cpu size={16} color="var(--thermal-hot)" />
                <h4 style={{ fontSize: '14px', fontWeight: 650, color: 'var(--text-primary)', margin: 0 }}>
                  Lambda Compute Mesh
                </h4>
              </div>
              <p style={{ fontSize: '13px', lineHeight: 1.55, color: 'var(--text-secondary)', margin: 0 }}>
                Specialized micro-lambdas for upload parsing, polygon geometry extraction, environmental
                reads, and thermal modeling with AI fallback.
              </p>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Database size={16} color="var(--thermal-temperate)" />
                <h4 style={{ fontSize: '14px', fontWeight: 650, color: 'var(--text-primary)', margin: 0 }}>
                  Persistent Storage
                </h4>
              </div>
              <p style={{ fontSize: '13px', lineHeight: 1.55, color: 'var(--text-secondary)', margin: 0 }}>
                S3 bucket stores raw plans, ventilation vectors, and rendered thermal maps; Amazon Aurora
                persists structured project state.
              </p>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Cloud size={16} color="var(--text-muted)" />
                <h4 style={{ fontSize: '14px', fontWeight: 650, color: 'var(--text-primary)', margin: 0 }}>
                  Infrastructure as Code
                </h4>
              </div>
              <p style={{ fontSize: '13px', lineHeight: 1.55, color: 'var(--text-secondary)', margin: 0 }}>
                AWS SAM CLI & CloudFormation stacks with IAM temporary credentials and unified CloudWatch
                telemetry monitoring.
              </p>
            </div>
          </div>
        </div>

        {/* Technical Notice Banner */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: 'var(--bg-subtle)',
            borderRadius: '6px',
            border: '1px solid var(--border-hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '0.04em'
              }}
            >
              CURRENT CAPABILITY STATEMENT
            </span>
            <span style={{ color: 'var(--border-medium)' }}>|</span>
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              Geometry extraction and illustrative spatial modeling are functional. Validated CFD
              indoor airflow models are in ongoing research and development.
            </span>
          </div>

          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-muted)'
            }}
          >
            ALPHA SPECIFICATION
          </span>
        </div>
      </div>

      {/* Fullscreen Lightbox Modal for Architecture Diagram */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            backgroundColor: 'rgba(20, 20, 19, 0.9)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              maxWidth: '1360px',
              width: '100%',
              maxHeight: '94vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
              position: 'relative'
            }}
          >
            {/* Modal Bar with Logos */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-primary)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img src={awsLogo} alt="AWS" style={{ height: '22px', objectFit: 'contain' }} />
                  <span style={{ color: 'var(--text-muted)' }}>×</span>
                  <img src={hackathonLogo} alt="Hackathon" style={{ height: '22px', objectFit: 'contain' }} />
                </div>
                <div>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase'
                    }}
                  >
                    AWS CLOUDFORMATION RUNTIME ARCHITECTURE
                  </span>
                  <h4 style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: 650, color: 'var(--text-primary)' }}>
                    Serverless Infrastructure Pipeline
                  </h4>
                </div>
              </div>

              <button
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Image Area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px',
                backgroundColor: '#FAF9F5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <img
                src={newArchImage}
                alt="Enlarged AWS Architecture"
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  objectFit: 'contain'
                }}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .how-it-works-grid {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
          }
          .arch-components-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 600px) {
          .arch-components-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
