import { useRef, useState, useEffect } from 'react';
import { Volume2, VolumeX, ArrowDown, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { awsLogo, hackathonLogo } from '../assets/submissionLogos';

interface HeroSectionProps {
  videoSrc?: string;
  posterSrc?: string;
}

export default function HeroSection({
  videoSrc = '/hero-video.mp4',
  posterSrc = '/hero-poster.png'
}: HeroSectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Check if video is playing
    const handlePlaying = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => {
      setIsMuted(video.muted);
    };

    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);

    // Initial silent autoplay attempt
    video.muted = true;
    video.play().catch(() => {
      // Autoplay with mute may be blocked in rare environments
      setIsPlaying(false);
    });

    return () => {
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, []);

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;

    setHasInteracted(true);
    if (video.muted) {
      video.muted = false;
      setIsMuted(false);
      // Ensure playback continues when unmuted
      if (video.paused) {
        video.play().catch(() => {
          // Fallback if browser blocks unmuted playback
          video.muted = true;
          setIsMuted(true);
        });
      }
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  };

  const scrollToSection = (id: string) => {
    const elem = document.querySelector(id);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      style={{
        paddingTop: '64px',
        paddingBottom: '80px',
        borderBottom: '1px solid var(--border-hairline)',
        backgroundColor: 'var(--bg-primary)',
        position: 'relative'
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 24px'
        }}
      >
        {/* Eyebrow & Submission Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '24px'
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-subtle)',
              padding: '5px 12px',
              borderRadius: '4px',
              border: '1px solid var(--border-hairline)'
            }}
          >
            CLIMATE INTELLIGENCE FOR THE BUILT ENVIRONMENT
          </span>

          {/* Hackathon Submission Highlight Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#FFFFFF',
              padding: '4px 14px 4px 12px',
              borderRadius: '24px',
              border: '1px solid var(--border-medium)',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)'
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10.5px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}
            >
              SUBMISSION
            </span>
            <img
              src={awsLogo}
              alt="AWS Logo"
              style={{ height: '17px', width: 'auto', objectFit: 'contain', display: 'block' }}
            />
            <span style={{ color: 'var(--border-medium)', fontSize: '12px' }}>×</span>
            <img
              src={hackathonLogo}
              alt="Hackathon Logo"
              style={{ height: '18px', width: 'auto', objectFit: 'contain', display: 'block' }}
            />
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em'
              }}
            >
              HACKATHON
            </span>
          </div>
        </div>

        {/* Hero Headline & Intro Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 0.75fr)',
            gap: '40px',
            alignItems: 'end',
            marginBottom: '48px'
          }}
          className="hero-header-grid"
        >
          <div>
            <h1
              style={{
                fontSize: 'clamp(38px, 6.2vw, 68px)',
                lineHeight: 1.05,
                fontWeight: 650,
                letterSpacing: '-0.035em',
                color: 'var(--text-primary)',
                margin: 0
              }}
            >
              Your home.
              <br />
              <span style={{ color: 'var(--text-secondary)' }}>Understood by design.</span>
            </h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <p
              style={{
                fontSize: 'clamp(16px, 1.35vw, 19px)',
                lineHeight: 1.55,
                color: 'var(--text-secondary)',
                margin: 0,
                maxWidth: '520px'
              }}
            >
              Turn an architectural floor plan into a deeper understanding of heat, airflow,
              and the environmental forces shaping your home.
            </p>

            {/* CTAs */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '14px'
              }}
            >
              <button
                onClick={() => scrollToSection('#methodology')}
                style={{
                  padding: '12px 22px',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: 500,
                  border: '1px solid var(--border-medium)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.18s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-subtle)';
                  e.currentTarget.style.borderColor = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--border-medium)';
                }}
              >
                Explore the approach
                <ArrowDown size={14} />
              </button>

              <Link
                to="/dashboard"
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'var(--text-primary)',
                  color: '#FAF9F5',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: '1px solid var(--text-primary)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 16px rgba(20, 20, 19, 0.18)',
                  position: 'relative',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 22px rgba(20, 20, 19, 0.25)';
                  e.currentTarget.style.backgroundColor = '#000000';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(20, 20, 19, 0.18)';
                  e.currentTarget.style.backgroundColor = 'var(--text-primary)';
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#10B981',
                    display: 'inline-block'
                  }}
                />
                Analysis Studio
                <ArrowUpRight size={15} strokeWidth={2.2} />
              </Link>
            </div>
          </div>
        </div>

        {/* Hero Video — Central Visual Element */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            backgroundColor: '#111110',
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1px solid var(--border-hairline)',
            boxShadow: '0 20px 45px -15px rgba(20, 20, 19, 0.08)'
          }}
        >
          <video
            ref={videoRef}
            src={videoSrc}
            poster={posterSrc}
            autoPlay
            muted
            loop
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block'
            }}
          />

          {/* Precision Top-Left Technical Overlay */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              pointerEvents: 'none'
            }}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: isPlaying ? '#10B981' : 'var(--thermal-warm)',
                animation: 'pulseSubtle 2.5s infinite ease-in-out'
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.08em',
                color: 'rgba(255, 255, 255, 0.85)',
                textTransform: 'uppercase',
                backgroundColor: 'rgba(15, 15, 15, 0.55)',
                padding: '3px 8px',
                borderRadius: '4px',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)'
              }}
            >
              LIVE CAPTURE · 3-BEDROOM THERMAL EVOLUTION
            </span>
          </div>

          {/* Sound Toggle Control in Bottom-Right */}
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              right: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            {!hasInteracted && isMuted && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.75)',
                  backgroundColor: 'rgba(18, 18, 18, 0.65)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backdropFilter: 'blur(6px)',
                  letterSpacing: '0.04em',
                  pointerEvents: 'none',
                  display: 'none'
                }}
                className="sound-hint"
              >
                Sound available
              </span>
            )}

            <button
              onClick={toggleSound}
              aria-label={isMuted ? 'Turn sound on' : 'Mute video'}
              title={isMuted ? 'Turn sound on' : 'Mute video'}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'rgba(18, 18, 18, 0.75)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FAF9F5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(28, 28, 28, 0.9)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.35)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(18, 18, 18, 0.75)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {isMuted ? (
                <VolumeX size={17} strokeWidth={1.75} />
              ) : (
                <Volume2 size={17} strokeWidth={1.75} />
              )}
            </button>
          </div>
        </div>

        {/* Video Subtitle & Specification Footer */}
        <div
          style={{
            marginTop: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '0 4px'
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11.5px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}
          >
            <span>FLOOR PLAN ID: CT-2861</span>
            <span>·</span>
            <span>SIMULATION FRAME: 14:00 HIGH HEAT DRAFT</span>
            <span>·</span>
            <span>DRY BULB: 42.0°C</span>
          </div>

          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11.5px',
              color: 'var(--text-muted)'
            }}
          >
            PHYSICS-INFORMED ISOTHERMAL MAPPING
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .hero-header-grid {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
        }
        @media (min-width: 640px) {
          .sound-hint {
            display: inline-block !important;
          }
        }
      `}</style>
    </section>
  );
}
