import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowUpRight } from 'lucide-react';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (anchorId: string) => {
    setMobileMenuOpen(false);
    if (location.pathname !== '/') {
      window.location.href = `/${anchorId}`;
      return;
    }
    const elem = document.querySelector(anchorId);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: scrolled ? 'rgba(250, 249, 245, 0.94)' : 'rgba(250, 249, 245, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${scrolled ? 'rgba(20, 20, 19, 0.1)' : 'rgba(20, 20, 19, 0.06)'}`,
        transition: 'background-color 0.25s ease, border-color 0.25s ease',
        width: '100%'
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 24px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        {/* Brand / Logo */}
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--text-primary)',
            textDecoration: 'none'
          }}
        >
          <span
            style={{
              fontSize: '15px',
              fontWeight: 700,
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
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              display: 'none'
            }}
            className="header-badge"
          >
            Built Environment
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '32px'
          }}
          className="desktop-nav"
        >
          <a
            href="#product"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('#product');
            }}
            style={{
              fontSize: '13.5px',
              color: 'var(--text-secondary)',
              fontWeight: 450,
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            Product
          </a>
          <a
            href="#methodology"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('#methodology');
            }}
            style={{
              fontSize: '13.5px',
              color: 'var(--text-secondary)',
              fontWeight: 450,
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            Methodology
          </a>
          <a
            href="#thermal-map"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('#thermal-map');
            }}
            style={{
              fontSize: '13.5px',
              color: 'var(--text-secondary)',
              fontWeight: 450,
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            Thermal Map
          </a>
          <Link
            to="/dashboard"
            style={{
              fontSize: '13.5px',
              color: 'var(--text-secondary)',
              fontWeight: 450,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            Analysis Console
            <ArrowUpRight size={13} strokeWidth={1.75} />
          </Link>
        </nav>

        {/* CTA Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <a
            href="#early-access"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('#early-access');
            }}
            style={{
              padding: '7px 14px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              backgroundColor: 'transparent',
              border: '1px solid rgba(20, 20, 19, 0.2)',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              display: 'inline-flex',
              alignItems: 'center',
              textDecoration: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--text-primary)';
              e.currentTarget.style.color = '#FAF9F5';
              e.currentTarget.style.borderColor = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.borderColor = 'rgba(20, 20, 19, 0.2)';
            }}
          >
            Get early access
          </a>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              padding: '6px',
              cursor: 'pointer',
              color: 'var(--text-primary)'
            }}
            className="mobile-toggle"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          style={{
            borderTop: '1px solid var(--border-hairline)',
            backgroundColor: 'var(--bg-primary)',
            padding: '18px 24px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <a
            href="#product"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('#product');
            }}
            style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 500 }}
          >
            Product
          </a>
          <a
            href="#methodology"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('#methodology');
            }}
            style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 500 }}
          >
            Methodology
          </a>
          <a
            href="#thermal-map"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('#thermal-map');
            }}
            style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 500 }}
          >
            Thermal Map
          </a>
          <Link
            to="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              fontSize: '15px',
              color: 'var(--text-primary)',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            Analysis Console
            <ArrowUpRight size={16} />
          </Link>
        </div>
      )}

      <style>{`
        @media (min-width: 768px) {
          .desktop-nav {
            display: flex !important;
          }
          .header-badge {
            display: inline-block !important;
          }
          .mobile-toggle {
            display: none !important;
          }
        }
        @media (max-width: 767px) {
          .mobile-toggle {
            display: block !important;
          }
        }
      `}</style>
    </header>
  );
}
