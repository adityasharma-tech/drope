import { ShieldCheck, Compass, GitBranch } from 'lucide-react';

export default function PhilosophySection() {
  const principles = [
    {
      title: 'Explicit Assumptions Over Black Boxes',
      description:
        'We do not generate synthetic hallucinated thermal images. Thermal loads are computed using explicit orientation indices, surface geometry, and microclimatic boundary conditions.',
      icon: <ShieldCheck size={20} strokeWidth={1.5} color="var(--thermal-hot)" />
    },
    {
      title: 'Architectural Grounding',
      description:
        'A floor plan is not a generic bitmap. We respect structural load-bearing walls, aperture dimensions, and spatial zoning as the governing boundaries of thermodynamics.',
      icon: <Compass size={20} strokeWidth={1.5} color="var(--thermal-temperate)" />
    },
    {
      title: 'Insight, Not False Guarantees',
      description:
        'Visualizations reveal vulnerability corridors and heating dynamics. We do not claim guaranteed kilowatt savings without in-situ sensor calibration and physical envelope validation.',
      icon: <GitBranch size={20} strokeWidth={1.5} color="var(--thermal-cool)" />
    }
  ];

  return (
    <section
      style={{
        padding: '110px 0',
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
        {/* Section Index */}
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
            05 / Philosophy
          </span>
        </div>

        {/* Hero Philosophy Typography */}
        <div style={{ maxWidth: '840px', marginBottom: '64px' }}>
          <h2
            style={{
              fontSize: 'clamp(36px, 5vw, 56px)',
              lineHeight: 1.08,
              fontWeight: 650,
              letterSpacing: '-0.035em',
              color: 'var(--text-primary)',
              marginBottom: '24px'
            }}
          >
            Built on geometry.
            <br />
            <span style={{ color: 'var(--text-secondary)' }}>Informed by physics.</span>
          </h2>

          <p
            style={{
              fontSize: 'clamp(17px, 1.4vw, 20px)',
              lineHeight: 1.6,
              color: 'var(--text-secondary)'
            }}
          >
            We combine structured architectural geometry with environmental data and explicit
            modeling assumptions to make building heat behavior easier to understand.
          </p>
        </div>

        {/* 3 Pillars Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '36px'
          }}
          className="philosophy-grid"
        >
          {principles.map((item, index) => (
            <div
              key={index}
              style={{
                borderTop: '1px solid var(--border-medium)',
                paddingTop: '28px'
              }}
            >
              <div style={{ marginBottom: '16px' }}>{item.icon}</div>
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: 650,
                  color: 'var(--text-primary)',
                  marginBottom: '12px',
                  letterSpacing: '-0.01em'
                }}
              >
                {item.title}
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  lineHeight: 1.65,
                  color: 'var(--text-secondary)',
                  margin: 0
                }}
              >
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .philosophy-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }
      `}</style>
    </section>
  );
}
