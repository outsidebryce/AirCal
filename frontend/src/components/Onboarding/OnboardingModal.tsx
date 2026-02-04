import { useState, useEffect } from 'react';
import './OnboardingModal.css';

const ONBOARDING_KEY = 'atlas-onboarding-complete';
const SESSION_KEY = 'atlas-onboarding-session';

interface OnboardingModalProps {
  onComplete?: () => void;
}

type Step = 'welcome' | 'caldav' | 'ai-key' | 'calcom-key' | 'feature-availability' | 'feature-timeline' | 'feature-geo';

const STEPS: Step[] = ['welcome', 'caldav', 'ai-key', 'calcom-key', 'feature-availability', 'feature-timeline', 'feature-geo'];

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [caldavUrl, setCaldavUrl] = useState('');
  const [caldavUsername, setCaldavUsername] = useState('');
  const [caldavPassword, setCaldavPassword] = useState('');
  const [aiKey, setAiKey] = useState('');
  const [calcomKey, setCalcomKey] = useState('');

  useEffect(() => {
    // Check if onboarding was completed before
    const completed = localStorage.getItem(ONBOARDING_KEY);
    // Check if this session already dismissed onboarding
    const sessionDismissed = sessionStorage.getItem(SESSION_KEY);

    if (!completed && !sessionDismissed) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    // Mark as dismissed for this session (navigation won't re-trigger)
    sessionStorage.setItem(SESSION_KEY, 'true');
    onComplete?.();
  };

  const handleComplete = () => {
    // Mark as permanently completed
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsOpen(false);
    onComplete?.();
  };

  const handleNext = () => {
    const idx = STEPS.indexOf(currentStep);
    if (idx < STEPS.length - 1) {
      setCurrentStep(STEPS[idx + 1]);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    const idx = STEPS.indexOf(currentStep);
    if (idx > 0) {
      setCurrentStep(STEPS[idx - 1]);
    }
  };

  const handleSkip = () => {
    handleNext();
  };

  const stepIndex = STEPS.indexOf(currentStep);
  const isLastStep = stepIndex === STEPS.length - 1;
  const isFirstStep = stepIndex === 0;

  if (!isOpen) return null;

  return (
    <div className="onboarding-overlay" onClick={handleClose}>
      <div className="onboarding-modal" onClick={(e) => e.stopPropagation()}>
        <button className="onboarding-close" onClick={handleClose} title="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Progress indicator */}
        <div className="onboarding-progress">
          {STEPS.map((step, idx) => (
            <div
              key={step}
              className={`progress-dot ${idx === stepIndex ? 'active' : ''} ${idx < stepIndex ? 'completed' : ''}`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="onboarding-content">
          {currentStep === 'welcome' && (
            <div className="step-content">
              <div className="step-icon welcome-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <h2>Welcome to Atlas</h2>
              <p>
                Your intelligent, self-hosted calendar with location awareness,
                availability scheduling, and AI-powered insights.
              </p>
              <p className="step-hint">
                Let's get you set up in a few quick steps. You can skip any step and configure later.
              </p>
            </div>
          )}

          {currentStep === 'caldav' && (
            <div className="step-content">
              <div className="step-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <h2>Connect Your Calendar</h2>
              <p>Connect to your CalDAV server to sync your events. Works with Fastmail, iCloud, and more.</p>
              <div className="form-fields">
                <div className="form-field">
                  <label>CalDAV URL</label>
                  <input
                    type="url"
                    placeholder="https://caldav.fastmail.com/dav/"
                    value={caldavUrl}
                    onChange={(e) => setCaldavUrl(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Username</label>
                  <input
                    type="text"
                    placeholder="your@email.com"
                    value={caldavUsername}
                    onChange={(e) => setCaldavUsername(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Password / App Password</label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={caldavPassword}
                    onChange={(e) => setCaldavPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 'ai-key' && (
            <div className="step-content">
              <div className="step-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <h2>AI Integration</h2>
              <p>Add your AI API key to enable intelligent calendar insights and natural language event creation.</p>
              <div className="form-fields">
                <div className="form-field">
                  <label>AI API Key (OpenAI / Anthropic)</label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    value={aiKey}
                    onChange={(e) => setAiKey(e.target.value)}
                  />
                </div>
              </div>
              <p className="step-hint">
                Your API key is stored locally and never sent to our servers.
              </p>
            </div>
          )}

          {currentStep === 'calcom-key' && (
            <div className="step-content">
              <div className="step-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  <path d="M9 14l2 2 4-4" />
                </svg>
              </div>
              <h2>Cal.com Integration</h2>
              <p>Connect your Cal.com account to manage booking links and availability scheduling.</p>
              <div className="form-fields">
                <div className="form-field">
                  <label>Cal.com API Key</label>
                  <input
                    type="password"
                    placeholder="cal_live_..."
                    value={calcomKey}
                    onChange={(e) => setCalcomKey(e.target.value)}
                  />
                </div>
              </div>
              <p className="step-hint">
                Find your API key at cal.com → Settings → Developer → API Keys
              </p>
            </div>
          )}

          {currentStep === 'feature-availability' && (
            <div className="step-content feature-showcase">
              <div className="feature-preview availability-preview">
                <div className="preview-calendar">
                  <div className="preview-slot available">9:00 AM</div>
                  <div className="preview-slot busy">10:00 AM</div>
                  <div className="preview-slot available">11:00 AM</div>
                  <div className="preview-slot available">2:00 PM</div>
                  <div className="preview-slot busy">3:00 PM</div>
                </div>
              </div>
              <h2>Availability Scheduler</h2>
              <p>
                Share your availability with a single link. Visitors can see your free slots
                and book time directly on your calendar.
              </p>
              <ul className="feature-list">
                <li>Smart availability detection</li>
                <li>Custom booking durations</li>
                <li>Buffer time between meetings</li>
                <li>Cal.com integration for bookings</li>
              </ul>
            </div>
          )}

          {currentStep === 'feature-timeline' && (
            <div className="step-content feature-showcase">
              <div className="feature-preview timeline-preview">
                <div className="preview-location">
                  <div className="location-badge">📍 New York City</div>
                  <div className="preview-events">
                    <div className="preview-event">Coffee with Alex</div>
                    <div className="preview-event">Team Standup</div>
                    <div className="preview-event">Product Review</div>
                  </div>
                </div>
              </div>
              <h2>Timeline Location Calendar</h2>
              <p>
                View your calendar organized by location. Events automatically inherit
                locations from previous events, creating seamless location spans.
              </p>
              <ul className="feature-list">
                <li>Location-based event grouping</li>
                <li>Automatic location inheritance</li>
                <li>Beautiful cover images per location</li>
                <li>Time tracking per location</li>
              </ul>
            </div>
          )}

          {currentStep === 'feature-geo' && (
            <div className="step-content feature-showcase">
              <div className="feature-preview geo-preview">
                <div className="preview-map">
                  <div className="map-marker" style={{ top: '30%', left: '40%' }}>
                    <span className="marker-count">5</span>
                  </div>
                  <div className="map-marker" style={{ top: '60%', left: '70%' }}>
                    <span className="marker-count">3</span>
                  </div>
                  <div className="map-marker" style={{ top: '45%', left: '25%' }}>
                    <span className="marker-count">8</span>
                  </div>
                </div>
              </div>
              <h2>Geo-Spatial Calendar & Intelligence</h2>
              <p>
                Visualize your events on a map. See where you spend your time and
                get AI-powered insights about your calendar patterns.
              </p>
              <ul className="feature-list">
                <li>Interactive map view of events</li>
                <li>Event clustering by location</li>
                <li>Time aggregation per place</li>
                <li>AI-powered calendar analysis</li>
              </ul>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="onboarding-nav">
          <button
            className="nav-btn secondary"
            onClick={handleBack}
            disabled={isFirstStep}
          >
            Back
          </button>
          <div className="nav-center">
            {!isFirstStep && currentStep !== 'welcome' && (
              <button className="skip-btn" onClick={handleSkip}>
                Skip this step
              </button>
            )}
          </div>
          <button
            className="nav-btn primary"
            onClick={handleNext}
          >
            {isLastStep ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
