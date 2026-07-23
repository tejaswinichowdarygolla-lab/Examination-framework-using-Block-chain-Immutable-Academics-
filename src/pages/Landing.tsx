import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/context/WalletContext';
import { GraduationCap, Shield, Globe, Lock, Copy, ArrowRight, AlertTriangle } from 'lucide-react';
import type { Role } from '@/context/WalletContext';

const truncate = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

export default function Landing() {
  const { isConnected, address, role, connectWallet, isConnecting, error } = useWallet();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isConnected && role && role !== 'NONE') {
      const path = role === 'TEACHER' ? 'instructor' : role.toLowerCase();
      navigate(`/${path}/dashboard`, { replace: true });
    }
  }, [isConnected, role, navigate]);

  const copyAddr = () => {
    if (address) { navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const hasMetaMask = typeof (window as any).ethereum !== 'undefined';

  return (
    <div style={{
      minHeight: '100vh', background: '#F7F8FA', display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Main centered content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>

        {/* Center card */}
        <div style={{
          width: '100%', maxWidth: 400,
          background: '#FFFFFF', border: '1px solid #E4E7EC', borderRadius: 8,
          padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          {/* Platform name */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
              <GraduationCap style={{ width: 20, height: 20, color: '#2563EB' }} />
              <span style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>ChainEdu</span>
            </div>
            <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>Secure examination platform</p>
          </div>

          {/* Divider */}
          <hr style={{ border: 'none', borderTop: '1px solid #E4E7EC', margin: '0 0 24px' }} />

          {/* Auth state */}
          {!isConnected ? (
            <>
              {!hasMetaMask ? (
                <div style={{
                  background: '#FFFBEB', border: '1px solid #FDE68A',
                  borderRadius: 6, padding: '12px 16px', marginBottom: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <AlertTriangle style={{ width: 16, height: 16, color: '#D97706', flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <p style={{ fontSize: 13, color: '#92400E', margin: '0 0 4px', fontWeight: 500 }}>MetaMask not detected</p>
                      <p style={{ fontSize: 12, color: '#92400E', margin: 0 }}>
                        Install MetaMask to continue.{' '}
                        <a href="https://metamask.io" target="_blank" rel="noopener noreferrer"
                          style={{ color: '#D97706', textDecoration: 'underline' }}>
                          Download MetaMask
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  id="connect-wallet-btn"
                  onClick={connectWallet}
                  disabled={isConnecting}
                  style={{
                    width: '100%', padding: '8px 16px', background: '#2563EB', color: '#FFFFFF',
                    border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500,
                    cursor: isConnecting ? 'not-allowed' : 'pointer',
                    opacity: isConnecting ? 0.45 : 1, transition: 'background 150ms ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    marginBottom: 16,
                  }}
                  onMouseEnter={e => { if (!isConnecting) (e.currentTarget as HTMLButtonElement).style.background = '#1D4ED8'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2563EB'; }}
                >
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              )}

              {error && (
                <div style={{ padding: '8px 12px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 6, marginBottom: 16 }}>
                  <p style={{ fontSize: 12, color: '#7F1D1D', margin: 0 }}>{error}</p>
                </div>
              )}

              <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', margin: 0 }}>
                Requires MetaMask browser extension
              </p>
            </>
          ) : role === null ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: 24, height: 24, border: '2px solid #2563EB', borderTopColor: 'transparent',
                borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px',
              }} />
              <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>Detecting your role...</p>
            </div>
          ) : role === 'NONE' ? (
            <div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', background: '#F7F8FA', border: '1px solid #E4E7EC',
                borderRadius: 6, marginBottom: 12,
              }}>
                <span style={{ fontSize: 12, color: '#6B7280' }}>Wallet</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace', fontSize: 12, color: '#374151' }}>
                  {truncate(address || '')}
                  <button onClick={copyAddr} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 0 }}>
                    {copied ? <span style={{ fontSize: 11, color: '#16A34A' }}>✓</span> : <Copy style={{ width: 12, height: 12 }} />}
                  </button>
                </span>
              </div>
              <div style={{ padding: 16, background: '#F7F8FA', border: '1px solid #E4E7EC', borderRadius: 6, textAlign: 'center' }}>
                <p style={{ fontSize: 14, color: '#374151', margin: '0 0 4px', fontWeight: 500 }}>Not registered</p>
                <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>An invite link is required to register.</p>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, padding: '8px 12px', background: '#F7F8FA', border: '1px solid #E4E7EC', borderRadius: 6 }}>
                <span style={{ fontSize: 12, color: '#6B7280' }}>Connected as</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#2563EB' }}>{role}</span>
              </div>
              <button
                onClick={() => navigate(`/${role === 'TEACHER' ? 'instructor' : role.toLowerCase()}/dashboard`)}
                style={{
                  width: '100%', padding: '8px 16px', background: '#2563EB', color: '#FFFFFF',
                  border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 150ms ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1D4ED8')}
                onMouseLeave={e => (e.currentTarget.style.background = '#2563EB')}
              >
                Enter Platform <ArrowRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          )}
        </div>

        {/* Feature row below card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0, marginTop: 24,
          maxWidth: 400, width: '100%',
        }}>
          {[
            { icon: Shield, label: 'Decentralized' },
            { icon: Lock,   label: 'Encrypted' },
            { icon: Globe,  label: 'Immutable' },
          ].map(({ icon: Icon, label }, i) => (
            <div key={label} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 8px', borderRight: i < 2 ? '1px solid #E4E7EC' : 'none' }}>
              <Icon style={{ width: 14, height: 14, color: '#6B7280' }} />
              <span style={{ fontSize: 12, color: '#6B7280' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '16px 24px', borderTop: '1px solid #E4E7EC' }}>
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>ChainEdu © 2025</p>
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
