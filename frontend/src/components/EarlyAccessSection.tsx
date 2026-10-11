import { useState, type FormEvent } from 'react';
import { ArrowRight, Check, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function EarlyAccessSection() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Architect / Designer');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setError('Please provide a valid email address.');
      return;
    }

    try {
      const stored = localStorage.getItem('drope_early_access');
      const list = stored ? JSON.parse(stored) : [];
      list.push({
        email: email.trim(),
        role,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('drope_early_access', JSON.stringify(list));
      setSubmitted(true);
    } catch {
      setError('Unable to store registration locally. Please try again.');
    }
  };

  return (
    <section
      id="early-access"
      style={{
        padding: '110px 0',
        borderBottom: '1px solid var(--border-hairline)',
        backgroundColor: 'var(--bg-subtle)'
      }}
    >
      <div
        style={{
          maxWidth: '820px',
          margin: '0 auto',
          padding: '0 24px',
          textAlign: 'center'
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--thermal-hot)',
            display: 'inline-block',
            marginBottom: '16px'
          }}
        >
          06 / Access
        </span>

        <h2
          style={{
            fontSize: 'clamp(36px, 5vw, 54px)',
            lineHeight: 1.1,
            fontWeight: 650,
            letterSpacing: '-0.035em',
            color: 'var(--text-primary)',
            marginBottom: '20px'
          }}
        >
          Design for the climate you live in.
        </h2>

        <p
          style={{
            fontSize: 'clamp(16px, 1.3vw, 19px)',
            lineHeight: 1.55,
            color: 'var(--text-secondary)',
            marginBottom: '40px',
            maxWidth: '620px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}
        >
          We are building a more intuitive way to understand how homes respond to their environment.
        </p>

        {submitted ? (
          <div
            style={{
              padding: '24px 32px',
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid var(--border-hairline)',
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              maxWidth: '480px',
              margin: '0 auto',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#EAF3ED',
                color: '#45735E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Check size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                Early access reserved
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0 }}>
                We have registered <strong>{email}</strong> ({role}). You will receive updates as the
                geometric pipeline and weather reanalysis tools expand.
              </p>
            </div>
            <Link
              to="/dashboard"
              style={{
                marginTop: '12px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Launch Interactive Analysis Studio
              <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{
              maxWidth: '520px',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '10px',
                backgroundColor: '#FFFFFF',
                padding: '6px',
                borderRadius: '8px',
                border: error ? '1px solid #DC2626' : '1px solid var(--border-medium)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)'
              }}
              className="early-access-input-group"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                aria-label="Email address for early access"
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  border: 'none',
                  outline: 'none',
                  fontSize: '14.5px',
                  fontFamily: 'inherit',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)'
                }}
              />

              <button
                type="submit"
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--text-primary)',
                  color: '#FAF9F5',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'opacity 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Get early access
              </button>
            </div>

            {/* Role Selector */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '12px',
                color: 'var(--text-muted)'
              }}
            >
              <span>I am an:</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  borderRadius: '4px',
                  border: '1px solid var(--border-hairline)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="Architect / Designer">Architect / Designer</option>
                <option value="Homeowner / Builder">Homeowner / Builder</option>
                <option value="Climate / HVAC Engineer">Climate / HVAC Engineer</option>
                <option value="Researcher / Academic">Researcher / Academic</option>
              </select>
            </div>

            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  color: '#DC2626'
                }}
              >
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            <div
              style={{
                marginTop: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Want to test your floor plan immediately?
              </span>
              <Link
                to="/dashboard"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Launch Studio Console →
              </Link>
            </div>
          </form>
        )}
      </div>

      <style>{`
        @media (max-width: 600px) {
          .early-access-input-group {
            flex-direction: column !important;
          }
        }
      `}</style>
    </section>
  );
}
