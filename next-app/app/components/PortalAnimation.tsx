'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

type StarParticle = {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
};

type SpiralParticle = {
  id: number;
  angle: number;
  radius: number;
  delay: number;
};

type OrbitingParticle = {
  id: number;
  angle: number;
  radius: number;
  delay: number;
  duration: number;
};

type ParticleSets = {
  stars: StarParticle[];
  spiralParticles: SpiralParticle[];
  orbitingParticles: OrbitingParticle[];
};

const EMPTY_PARTICLES: ParticleSets = {
  stars: [] as StarParticle[],
  spiralParticles: [] as SpiralParticle[],
  orbitingParticles: [] as OrbitingParticle[],
};

/**
 * PortalAnimation component that creates a portal-opening effect on page load
 * - Push (outwards): Root page OR paste that was just pushed - Faster (1.2s)
 * - Pull (inwards): Paste page that was retrieved/viewed - Standard (2.5s)
 * - Root page portal only shows once per session
 * - Tracks just-pushed pastes via sessionStorage to show correct animation direction
 */
export default function PortalAnimation() {
  const searchParams = useSearchParams();
  const pasteId = searchParams?.get('id');
  const [showPortal, setShowPortal] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isPush, setIsPush] = useState(false);
  const particleDataRef = useRef<ParticleSets | null>(null);

  useEffect(() => {
    let fadeOutTimer: NodeJS.Timeout | null = null;
    let removeTimer: NodeJS.Timeout | null = null;
    let clearStorageTimer: NodeJS.Timeout | null = null;

    // Function to check and trigger portal animation
    const checkAndTriggerPortal = () => {
      // Clear any existing timers
      if (fadeOutTimer) clearTimeout(fadeOutTimer);
      if (removeTimer) clearTimeout(removeTimer);
      if (clearStorageTimer) clearTimeout(clearStorageTimer);
      
      // Get current pasteId from URL (in case it changed via pushState)
      const currentUrl = new URL(window.location.href);
      const currentPasteId = currentUrl.searchParams.get('id');
      
      // Check if this paste was just pushed (created) in this session
      const justPushedPasteId = sessionStorage.getItem('just-pushed-paste-id');
      const isPushedPaste = currentPasteId && justPushedPasteId === currentPasteId;
      
      // Determine if this is a push (outwards) or pull (inwards)
      // Push: root page OR paste that was just pushed
      // Pull: paste page that was not just pushed
      const pushState = Boolean(!currentPasteId || isPushedPaste);
      setIsPush(pushState);
      
      // Clear the just-pushed marker after a delay to ensure it's used
      if (isPushedPaste) {
        // Clear after animation starts (small delay to ensure state is set)
        clearStorageTimer = setTimeout(() => {
          sessionStorage.removeItem('just-pushed-paste-id');
        }, 100);
      }
      
      // Determine animation duration
      const animationDuration = pushState ? 1200 : 2500; // 1.2s for push, 2.5s for pull
      const fadeOutStart = pushState ? 900 : 2000; // Start fade-out earlier for faster animation

      // For root page, check if portal was already shown in this session
      if (!currentPasteId) {
        const portalShown = sessionStorage.getItem('portal-shown');
        if (portalShown) {
          return;
        }
        sessionStorage.setItem('portal-shown', 'true');
      }

      // Show portal animation
      setShowPortal(true);
      setIsFadingOut(false);

      // Start fade-out, then remove after fade completes
      fadeOutTimer = setTimeout(() => {
        setIsFadingOut(true);
      }, fadeOutStart);

      const fadeOutDuration = animationDuration - fadeOutStart;
      removeTimer = setTimeout(() => {
        setShowPortal(false);
      }, animationDuration);
    };

    // Check immediately
    checkAndTriggerPortal();

    // Listen for custom event that PasteViewer can dispatch when pushing
    const handlePastePushed = () => {
      // Small delay to let URL update
      setTimeout(() => {
        checkAndTriggerPortal();
      }, 10);
    };

    window.addEventListener('paste-pushed', handlePastePushed);

    return () => {
      if (fadeOutTimer) clearTimeout(fadeOutTimer);
      if (removeTimer) clearTimeout(removeTimer);
      if (clearStorageTimer) clearTimeout(clearStorageTimer);
      window.removeEventListener('paste-pushed', handlePastePushed);
    };
  }, [pasteId]);

  // Don't render if portal shouldn't show
  if (!showPortal) {
    return null;
  }

  // Determine animation duration and direction based on isPush state
  const animationDuration = isPush ? 1200 : 2500; // 1.2s for push, 2.5s for pull
  const animationDurationMs = `${animationDuration}ms`;
  const delay1 = isPush ? '0.1s' : '0.2s';
  const delay2 = isPush ? '0.2s' : '0.4s';
  const delay3 = isPush ? '0.3s' : '0.6s';
  
  // Use portal-open (outwards) for push, portal-close (inwards) for pull
  const animationName = isPush ? 'portal-open' : 'portal-close';
  const initialTransform = isPush ? 'scale(0)' : 'scale(2)';

  const fadeOutDuration = isFadingOut ? (isPush ? 300 : 500) : 0;

  const { stars, spiralParticles, orbitingParticles } = useMemo<ParticleSets>(() => {
    if (!showPortal) {
      particleDataRef.current = null;
      return EMPTY_PARTICLES;
    }

    if (!particleDataRef.current) {
      particleDataRef.current = {
        stars: Array.from({ length: 150 }, (_, i) => ({
          id: i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * 2 + 0.5,
          delay: Math.random() * 2,
          duration: Math.random() * 3 + 2,
        })),
        spiralParticles: Array.from({ length: 12 }, (_, i) => ({
          id: i,
          angle: (i * 30) % 360,
          radius: 150 + (i % 3) * 100,
          delay: i * 0.1,
        })),
        orbitingParticles: Array.from({ length: 8 }, (_, i) => ({
          id: i,
          angle: (i * 45) % 360,
          radius: 200 + (i % 2) * 150,
          delay: i * 0.2,
          duration: 8 + (i % 3) * 2,
        })),
      };
    }

    return particleDataRef.current;
  }, [showPortal]);

  return (
    <div
      className="fixed inset-0 z-[9999] pointer-events-none"
      style={{
        animation: isFadingOut ? `portal-fade-out ${fadeOutDuration}ms cubic-bezier(0.1, 0, 0.2, 1) forwards` : undefined,
      }}
    >
      {/* Galaxy nebula background */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            radial-gradient(ellipse at 50% 50%, 
              rgba(138, 43, 226, 0.4) 0%,
              rgba(75, 0, 130, 0.3) 25%,
              rgba(0, 191, 255, 0.2) 50%,
              rgba(255, 20, 147, 0.15) 75%,
              transparent 100%
            ),
            radial-gradient(ellipse at 20% 30%, 
              rgba(0, 245, 255, 0.3) 0%,
              transparent 50%
            ),
            radial-gradient(ellipse at 80% 70%, 
              rgba(255, 0, 255, 0.3) 0%,
              transparent 50%
            )
          `,
          backgroundSize: '200% 200%',
          animation: `nebula-shift 20s ease-in-out infinite`,
        }}
      />
      
      {/* Portal overlay background */}
      <div className="absolute inset-0 bg-[var(--color-background)] opacity-90" />
      
      {/* Star field */}
      <div className="absolute inset-0">
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              boxShadow: `0 0 ${star.size * 2}px rgba(255, 255, 255, 0.8)`,
              animation: `star-twinkle ${star.duration}s ease-in-out infinite ${star.delay}s`,
            }}
          />
        ))}
      </div>
      
      {/* Spiral galaxy arms */}
      <div className="absolute inset-0 flex items-center justify-center">
        {spiralParticles.map((particle) => (
          <div
            key={`spiral-${particle.id}`}
            className="absolute"
            style={{
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.9), rgba(0, 245, 255, 0.6))',
              boxShadow: '0 0 8px rgba(0, 245, 255, 0.8), 0 0 16px rgba(255, 0, 255, 0.6)',
              transform: `rotate(${particle.angle}deg) translateX(${particle.radius}px)`,
              transformOrigin: '0 0',
              animation: `spiral-rotate ${4 + particle.id * 0.3}s linear infinite ${particle.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Portal container - centered */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Orbiting particles around portal */}
        {orbitingParticles.map((particle) => (
          <div
            key={`orbit-${particle.id}`}
            className="absolute"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: particle.id % 2 === 0 
                ? 'radial-gradient(circle, rgba(0, 245, 255, 1), rgba(0, 245, 255, 0.3))'
                : 'radial-gradient(circle, rgba(255, 0, 255, 1), rgba(255, 0, 255, 0.3))',
              boxShadow: particle.id % 2 === 0
                ? '0 0 10px rgba(0, 245, 255, 1), 0 0 20px rgba(0, 245, 255, 0.5)'
                : '0 0 10px rgba(255, 0, 255, 1), 0 0 20px rgba(255, 0, 255, 0.5)',
              animation: `orbit-rotate ${particle.duration}s linear infinite ${particle.delay}s`,
              transform: `rotate(${particle.angle}deg) translateX(${particle.radius}px) rotate(-${particle.angle}deg)`,
            } as React.CSSProperties}
          />
        ))}
        {/* Outer ring */}
        <div
          className="absolute rounded-full border-2"
          style={{
            width: '120vw',
            height: '120vw',
            maxWidth: '2000px',
            maxHeight: '2000px',
            borderColor: 'var(--color-positive-highlight)',
            boxShadow: `
              0 0 40px var(--color-positive-highlight),
              0 0 80px var(--color-positive-highlight),
              inset 0 0 40px var(--color-positive-highlight)
            `,
            animation: `${animationName} ${animationDurationMs} cubic-bezier(0.1, 0, 0.2, 1), portal-glow 1.5s ease-in-out infinite`,
            transform: initialTransform,
            animationFillMode: 'forwards',
          }}
        />
        
        {/* Middle ring */}
        <div
          className="absolute rounded-full border"
          style={{
            width: '90vw',
            height: '90vw',
            maxWidth: '1500px',
            maxHeight: '1500px',
            borderColor: 'var(--color-negative-highlight)',
            borderWidth: '3px',
            boxShadow: `
              0 0 30px var(--color-negative-highlight),
              0 0 60px var(--color-negative-highlight),
              inset 0 0 30px var(--color-negative-highlight)
            `,
            animation: `${animationName} ${animationDurationMs} cubic-bezier(0.1, 0, 0.2, 1) ${delay1}, portal-glow 1.5s ease-in-out infinite ${delay1}`,
            transform: initialTransform,
            animationFillMode: 'forwards',
          }}
        />
        
        {/* Inner ring */}
        <div
          className="absolute rounded-full border"
          style={{
            width: '60vw',
            height: '60vw',
            maxWidth: '1000px',
            maxHeight: '1000px',
            borderColor: 'var(--color-positive-highlight)',
            borderWidth: '2px',
            boxShadow: `
              0 0 20px var(--color-positive-highlight),
              0 0 40px var(--color-positive-highlight),
              inset 0 0 20px var(--color-positive-highlight)
            `,
            animation: `${animationName} ${animationDurationMs} cubic-bezier(0.1, 0, 0.2, 1) ${delay2}, portal-glow 1.5s ease-in-out infinite ${delay2}`,
            transform: initialTransform,
            animationFillMode: 'forwards',
          }}
        />
        
        {/* Core portal with galaxy center */}
        <div
          className="absolute rounded-full"
          style={{
            width: '30vw',
            height: '30vw',
            maxWidth: '500px',
            maxHeight: '500px',
            background: `
              radial-gradient(
                circle at 30% 30%,
                rgba(255, 255, 255, 0.4) 0%,
                rgba(138, 43, 226, 0.3) 15%,
                rgba(0, 245, 255, 0.3) 30%,
                rgba(255, 0, 255, 0.2) 50%,
                rgba(75, 0, 130, 0.15) 70%,
                transparent 100%
              )
            `,
            boxShadow: `
              0 0 60px var(--color-positive-highlight),
              0 0 120px var(--color-negative-highlight),
              0 0 180px rgba(138, 43, 226, 0.4),
              inset 0 0 60px var(--color-positive-highlight),
              inset 0 0 120px rgba(255, 0, 255, 0.3)
            `,
            animation: `${animationName} ${animationDurationMs} cubic-bezier(0.1, 0, 0.2, 1) ${delay3}, portal-glow 1.5s ease-in-out infinite ${delay3}`,
            transform: initialTransform,
            animationFillMode: 'forwards',
          }}
        />
        
        {/* Swirling galaxy particles inside portal */}
        <div className="absolute inset-0 flex items-center justify-center">
          {Array.from({ length: 20 }, (_, i) => {
            const angle = (i * 18) % 360;
            const distance = 100 + (i % 5) * 30;
            return (
              <div
                key={`particle-${i}`}
                className="absolute"
                style={{
                  width: '3px',
                  height: '3px',
                  borderRadius: '50%',
                  background: i % 3 === 0 
                    ? 'rgba(255, 255, 255, 0.9)'
                    : i % 3 === 1
                    ? 'rgba(0, 245, 255, 0.8)'
                    : 'rgba(255, 0, 255, 0.8)',
                  boxShadow: '0 0 6px currentColor',
                  animation: `particle-float ${3 + (i % 3)}s ease-in-out infinite ${i * 0.15}s`,
                  transform: `rotate(${angle}deg) translateX(${distance}px)`,
                  transformOrigin: '0 0',
                }}
              />
            );
          })}
        </div>
      </div>
      
      {/* Fade out overlay */}
      <div
        className="absolute inset-0 bg-[var(--color-background)]"
        style={{
          opacity: 0,
          animation: `portal-reveal ${animationDurationMs} cubic-bezier(0.1, 0, 0.2, 1) reverse`,
        }}
      />
    </div>
  );
}

