import Link from 'next/link';
import './landing.css';
import './cosmic-bg.css';
import CosmicBackground from './CosmicBackground';

export default function Home() {
  return (
    <div className="landing">
      <CosmicBackground />

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link href="/" className="landing-logo">
            <span className="nexus-wordmark">Nexus</span>
          </Link>
          <div className="landing-nav-links">
            <Link href="/docs" className="landing-nav-link">Documentation</Link>
          </div>
          <div className="landing-nav-actions">
            <Link href="/login" className="btn btn-secondary btn-sm">Sign in</Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="landing-container hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Built for OJT programmes and supervisors
          </div>
          <h1 className="nexus-wordmark hero-wordmark">Nexus</h1>
          <p className="hero-sub">
            One workspace for on-the-job training. Attendance, tasks, and
            progress for trainees, supervisors, and admins &mdash; connected
            in real time, verified by location.
          </p>
          <div className="hero-ctas">
            <Link href="/login" className="btn btn-primary" style={{ padding: '.75rem 1.75rem', fontSize: '1rem' }}>
              Sign in
            </Link>
            <Link href="/docs" className="btn btn-secondary" style={{ padding: '.75rem 1.75rem', fontSize: '1rem' }}>
              View documentation
            </Link>
          </div>
          <div className="hero-stats">
            <div className="hero-stat"><span className="hero-stat-num">3</span><span className="hero-stat-label">Role levels</span></div>
            <div className="hero-stat"><span className="hero-stat-num">GPS</span><span className="hero-stat-label">Clock&#8209;in</span></div>
            <div className="hero-stat"><span className="hero-stat-num">Kanban</span><span className="hero-stat-label">Task board</span></div>
            <div className="hero-stat"><span className="hero-stat-num">&#8734;</span><span className="hero-stat-label">Data history</span></div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="landing-section">
        <div className="landing-container">
          <div className="section-label-pill">Features</div>
          <h2 className="section-heading">Everything you need to manage OJT</h2>
          <p className="section-sub">From daily clock-ins to final reports, Nexus covers the full training workflow.</p>
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                  <circle cx="12" cy="11" r="3" />
                </svg>
              </div>
              <h3>GPS Attendance</h3>
              <p>Location-verified clock-in and clock-out lets every trainee log time from their actual work site.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" />
                </svg>
              </div>
              <h3>Time Tracking</h3>
              <p>Hours rendered versus required hours, tracked automatically and visible at a glance.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path strokeLinecap="round" d="M8 4v16M16 4v16" />
                </svg>
              </div>
              <h3>Kanban Board</h3>
              <p>Organise training tasks into columns. Drag, drop, and track deliverables in one view.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m3 6V7m3 10v-3m-9 6h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3>Reports</h3>
              <p>Generate detailed attendance and progress reports. Export data to share with schools and coordinators.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3>Role&#8209;based Access</h3>
              <p>Admins configure the system, supervisors oversee trainees, OJT students log hours &mdash; each with the right permissions.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <circle cx="6" cy="6" r="2.2" /><circle cx="18" cy="6" r="2.2" /><circle cx="12" cy="18" r="2.2" />
                  <path strokeLinecap="round" d="M7.8 7.3L11 16.5M16.2 7.3L13 16.5M8.2 6h7.6" />
                </svg>
              </div>
              <h3>Connected Workflow</h3>
              <p>Trainee, supervisor, and admin actions sync in real time &mdash; nothing gets lost between roles.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Role Overview ────────────────────────────────────────────────── */}
      <section className="landing-section">
        <div className="landing-container">
          <div className="section-label-pill">Role overview</div>
          <h2 className="section-heading">Built around how training actually escalates</h2>
          <p className="section-sub">Each role sees exactly what it needs &mdash; and every action flows up the chain automatically.</p>
          <div className="roles-row">
            <div className="roles-connector" />
            <div className="role-card">
              <div className="role-marker">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m3 6V7m3 10v-3M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="role-tag">Trainee</span>
              <h4>OJT</h4>
              <p>Clocks in and out with GPS verification, works tasks on the kanban board, and tracks hours toward completion.</p>
            </div>
            <div className="role-card">
              <div className="role-marker">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12C3.8 7.9 7.6 5 12 5s8.2 2.9 9.5 7c-1.3 4.1-5.1 7-9.5 7s-8.2-2.9-9.5-7z" />
                </svg>
              </div>
              <span className="role-tag">Oversight</span>
              <h4>Supervisor</h4>
              <p>Reviews logs, approves attendance, and monitors every assigned trainee&apos;s progress from one dashboard.</p>
            </div>
            <div className="role-card">
              <div className="role-marker">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-3z" />
                </svg>
              </div>
              <span className="role-tag">System</span>
              <h4>Administrator</h4>
              <p>Provisions accounts, configures the programme, and generates the reports that leave the building.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────────── */}
      <section className="landing-cta-banner">
        <div className="landing-container">
          <h2 className="cta-heading">Ready to streamline your OJT programme?</h2>
          <p className="cta-sub">Sign in to get started &mdash; your admin will have set up your account.</p>
          <div style={{ display: 'flex', gap: '.875rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" className="btn btn-primary" style={{ padding: '.75rem 2rem', fontSize: '1rem' }}>Sign in now</Link>
            <Link href="/docs" className="btn btn-secondary" style={{ padding: '.75rem 2rem', fontSize: '1rem' }}>View docs</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="footer-top">
            <div className="footer-brand">
              <div className="footer-brand-logo">
                <span className="nexus-wordmark">Nexus</span>
              </div>
              <p className="footer-tagline">Track training hours. Drive progress.<br />Built for OJT programmes.</p>
            </div>
            <div className="footer-nav-group">
              <p className="footer-nav-label">Product</p>
              <Link href="/login" className="footer-nav-link">Sign in</Link>
              <Link href="/docs" className="footer-nav-link">Documentation</Link>
            </div>
            <div className="footer-nav-group">
              <p className="footer-nav-label">Legal</p>
              <Link href="/terms" className="footer-nav-link">Terms of Service</Link>
              <Link href="/privacy" className="footer-nav-link">Privacy Policy</Link>
              <Link href="/contact" className="footer-nav-link">Contact Us</Link>
            </div>
          </div>
          <div className="footer-bottom">
            <p className="footer-copy">&copy; 2026 Nexus. All rights reserved.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}