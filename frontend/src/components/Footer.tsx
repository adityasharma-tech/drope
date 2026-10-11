import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export default function Footer() {
  const scrollTo = (id: string) => {
    const el = document.querySelector(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderTop: '1px solid var(--border-hairline)',
        padding: '64px 0 48px',
        color: 'var(--text-secondary)'
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 24px'
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 0.6fr)',
            gap: '48px',
            marginBottom: '48px'
          }}
          className="footer-grid"
        >
          {/* Left: Brand & Product Statement */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                  textTransform: 'uppercase'
                }}
              >
                DROPE
              </span>
              <span
                style={{
                  display: 'inline-block',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--thermal-hot)'
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-muted)'
                }}
              >
                CLIMATE INTELLIGENCE
              </span>
            </div>

            <p
              style={{
                fontSize: '14px',
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
                maxWidth: '460px',
                margin: 0
              }}
            >
              Climate intelligence and physics-informed thermal spatial analysis for residential
              architecture. Built on geometry, informed by physics.
            </p>
          </div>

          {/* Right: Navigation Column */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '24px'
            }}
          >
            <div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: '14px',
                  letterSpacing: '0.06em'
                }}
              >
                Navigation
              </span>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li>
                  <a
                    href="#product"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollTo('#product');
                    }}
                    style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}
                  >
                    Product
                  </a>
                </li>
                <li>
                  <a
                    href="#methodology"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollTo('#methodology');
                    }}
                    style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}
                  >
                    Methodology
                  </a>
                </li>
                <li>
                  <a
                    href="#thermal-map"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollTo('#thermal-map');
                    }}
                    style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}
                  >
                    Thermal Map
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: '14px',
                  letterSpacing: '0.06em'
                }}
              >
                Platform
              </span>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li>
                  <Link
                    to="/dashboard"
                    style={{
                      fontSize: '13.5px',
                      color: 'var(--text-secondary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    Analysis Studio
                    <ArrowUpRight size={13} />
                  </Link>
                </li>
                <li>
                  <a
                    href="#early-access"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollTo('#early-access');
                    }}
                    style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}
                  >
                    Early Access
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Attribution */}
        <div
          style={{
            borderTop: '1px solid var(--border-hairline)',
            paddingTop: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--text-muted)' }}>
            © 2026 DROPE. Built on geometry, informed by physics.
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--text-muted)' }}>
            PRECISION SPATIAL CLIMATE INTELLIGENCE
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
          }
        }
      `}</style>
    </footer>
  );
}
