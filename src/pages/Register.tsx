import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getAllLinks,
  registerTeacher,
  registerStudent,
  type RegistrationLink,
} from '@/utils/registrationLinks';
import { useWallet } from '@/context/WalletContext';
import { mfsExists, MFS } from '@/utils/mfs';

type PageState =
  | 'loading'
  | 'invalid-link'
  | 'connect-wallet'
  | 'fill-form'
  | 'submitting'
  | 'success'
  | 'error';

export default function Register() {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const { connectWallet, address, isConnected } = useWallet();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [link, setLink] = useState<RegistrationLink | null>(null);
  const [invalidReason, setInvalidReason] = useState('');

  const [name, setName] = useState('');
  const [walletInput, setWalletInput] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [resolvedTeacherName, setResolvedTeacherName] = useState<string | null>(null);
  const [registeredWallet, setRegisteredWallet] = useState<string>('');

  // SEC-TC-010: Sanitization helper (strips HTML and blocks CSV injection formulas)
  const sanitize = (str: string) => {
    let clean = str.replace(/[<>]/g, '').trim();
    // Block spreadsheet formula injection
    if (clean.startsWith('=') || clean.startsWith('+') || clean.startsWith('-') || clean.startsWith('@')) {
      clean = "'" + clean; // Escape with apostrophe
    }
    return clean;
  };

  useEffect(() => {
    if (!linkId) {
      setInvalidReason('No registration link provided.');
      setPageState('invalid-link');
      return;
    }

    const validate = async () => {
      const allLinks = await getAllLinks();
      const found = allLinks.find(l => l.linkId === linkId);
      
      if (!found) {
        setInvalidReason('Invalid or expired registration link.');
        setPageState('invalid-link');
        return;
      }

      if (found.status === 'stopped') {
        setInvalidReason('This registration link has been temporarily disabled by the administrator.');
        setPageState('invalid-link');
        return;
      }
      
      setLink(found);

      // Resolve teacher name for students
      if (found.role === 'Student') {
        const { getTeacherNameByWallet } = await import('@/utils/examUtils');
        const tName = await getTeacherNameByWallet(found.createdBy);
        if (tName) setResolvedTeacherName(tName);
      }
      
      if (isConnected && address) {
        setPageState('fill-form');
        setWalletInput(address);
      } else {
        setPageState('connect-wallet');
      }
    };

    validate().catch(() => {
      setInvalidReason('Could not validate link.');
      setPageState('invalid-link');
    });
  }, [linkId, isConnected, address]);

  const handleConnectWallet = async () => {
    await connectWallet();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkId || !address || !link) return;

    const cleanName = sanitize(name);
    const cleanWallet = sanitize(walletInput);

    if (!cleanName) {
      setSubmitError('Name is required.');
      return;
    }
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(cleanWallet)) {
      setSubmitError('Invalid Ethereum wallet address format. (0x followed by 40 hex chars)');
      return;
    }

    setPageState('submitting');
    setSubmitError('');

    try {
      // SEC-TC-048: Anti-Double-Registration pre-check
      const { isStudentApproved, isTeacherApproved } = await import('@/utils/examUtils');
      const alreadyStudent = await isStudentApproved(cleanWallet);
      const alreadyTeacher = await isTeacherApproved(cleanWallet);
      
      if (alreadyStudent || alreadyTeacher) {
        throw new Error('This wallet address is already registered in the ChainEdu system.');
      }
      
      if (link.role === 'Teacher') {
        await registerTeacher({
          name: cleanName,
          role: 'Teacher', 
          university: link.university,
          department: link.department,
          walletAddress: cleanWallet.toLowerCase(),
          linkId: link.linkId
        });
      } else {
        const { getTeacherNameByWallet } = await import('@/utils/examUtils');
        const teacherName = await getTeacherNameByWallet(link.createdBy) || link.university;
        
        await registerStudent({
          name: cleanName,
          walletAddress: cleanWallet.toLowerCase(),
          teacherName: teacherName,
          linkId: link.linkId,
          teacherId: link.createdBy.toLowerCase(),
          university: link.university,
          department: link.department
        });
      }

      setRegisteredWallet(cleanWallet);
      setPageState('success');
    } catch (err: any) {
      setSubmitError(err.message || 'Registration failed. Please try again.');
      setPageState('fill-form');
    }
  };

  const roleLabels: Record<string, string> = {
    'Teacher': 'Teacher',
    'Student': 'Student'
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#F7F8FA', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Page header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>ChainEdu</span>
          </div>
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>Registration Portal</p>
        </div>

        {/* Main card */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #E4E7EC', borderRadius: 8,
          padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>

          {/* LOADING */}
          {pageState === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 0', textAlign: 'center' }}>
              <div style={{ width: 24, height: 24, border: '2px solid #2563EB', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>Validating registration link...</p>
            </div>
          )}

          {/* INVALID LINK */}
          {pageState === 'invalid-link' && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>Complete Registration</h2>
              <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 20px' }}>Registration link verification failed.</p>

              <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p style={{ fontSize: 13, color: '#7F1D1D', margin: 0 }}>{invalidReason}</p>
              </div>

              <button onClick={() => navigate('/')} style={{
                width: '100%', padding: '8px 16px', background: '#FFFFFF', border: '1px solid #E4E7EC',
                borderRadius: 6, fontSize: 14, fontWeight: 500, color: '#374151', cursor: 'pointer',
              }}>
                Return Home
              </button>
            </div>
          )}

          {/* CONNECT WALLET */}
          {pageState === 'connect-wallet' && link && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>Complete Registration</h2>
              <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 20px' }}>
                You are registering as{' '}
                <span style={{
                  padding: '1px 6px', borderRadius: 4, fontSize: 12, fontWeight: 500,
                  background: link.role === 'Teacher' ? '#DBEAFE' : '#DCFCE7',
                  color: link.role === 'Teacher' ? '#1D4ED8' : '#15803D',
                }}>{link.role}</span>
              </p>

              <div style={{ padding: '12px 16px', background: '#F7F8FA', border: '1px solid #E4E7EC', borderRadius: 6, marginBottom: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: '0 0 4px' }}>{link.university}</p>
                <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>{link.department}</p>
              </div>

              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                Connect your MetaMask wallet to verify your identity and complete registration.
              </p>

              <button onClick={handleConnectWallet} style={{
                width: '100%', padding: '8px 16px', background: '#2563EB', color: '#FFFFFF',
                border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                transition: 'background 150ms ease',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1D4ED8')}
                onMouseLeave={e => (e.currentTarget.style.background = '#2563EB')}
              >
                Connect Wallet
              </button>
            </div>
          )}

          {/* FILL FORM */}
          {pageState === 'fill-form' && link && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>Complete Registration</h2>
              <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 20px' }}>
                You are registering as{' '}
                <span style={{
                  padding: '1px 6px', borderRadius: 4, fontSize: 12, fontWeight: 500,
                  background: link.role === 'Teacher' ? '#DBEAFE' : '#DCFCE7',
                  color: link.role === 'Teacher' ? '#1D4ED8' : '#15803D',
                }}>{link.role}</span>
              </p>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Full Name</label>
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Enter your legal name" required autoComplete="off"
                    style={{ width: '100%', padding: '8px 12px', background: '#FFFFFF', border: '1px solid #E4E7EC', borderRadius: 6, fontSize: 14, color: '#111827', outline: 'none', transition: 'border-color 150ms ease', boxSizing: 'border-box' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.10)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E4E7EC'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Wallet Address</label>
                  <input
                    type="text" value={walletInput} onChange={e => setWalletInput(e.target.value)}
                    placeholder="0x..." required
                    style={{ width: '100%', padding: '8px 12px', background: '#F7F8FA', border: '1px solid #E4E7EC', borderRadius: 6, fontSize: 13, color: '#374151', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4, marginBottom: 0 }}>Enter the address you will use for credentials</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Role</label>
                    <div style={{ padding: '8px 12px', background: '#F7F8FA', border: '1px solid #E4E7EC', borderRadius: 6 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 500,
                        background: link.role === 'Teacher' ? '#DBEAFE' : '#DCFCE7',
                        color: link.role === 'Teacher' ? '#1D4ED8' : '#15803D',
                        padding: '1px 6px', borderRadius: 4,
                      }}>{link.role}</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Institution</label>
                    <div style={{ padding: '8px 12px', background: '#F7F8FA', border: '1px solid #E4E7EC', borderRadius: 6, fontSize: 13, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {link.university}
                    </div>
                  </div>
                </div>

                {submitError && (
                  <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, marginBottom: 16 }}>
                    <p style={{ fontSize: 12, color: '#7F1D1D', margin: 0 }}>{submitError}</p>
                  </div>
                )}

                <button type="submit" style={{
                  width: '100%', padding: '8px 16px', background: '#2563EB', color: '#FFFFFF',
                  border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                }}>
                  Submit Application
                </button>
              </form>
            </div>
          )}

          {/* SUBMITTING */}
          {pageState === 'submitting' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 0', textAlign: 'center' }}>
              <div style={{ width: 24, height: 24, border: '2px solid #2563EB', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: '#111827', margin: '0 0 4px' }}>Submitting registration...</p>
                <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Writing to IPFS</p>
              </div>
            </div>
          )}

          {/* SUCCESS */}
          {pageState === 'success' && (
            <div style={{ textAlign: 'center' }}>
              {/* Checkmark icon */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>

              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>Registration submitted</h2>
              <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 24px' }}>
                {resolvedTeacherName ? `Awaiting teacher approval (${resolvedTeacherName})` : 'Awaiting admin approval'}
              </p>

              <div style={{ background: '#F7F8FA', border: '1px solid #E4E7EC', borderRadius: 6, padding: 16, textAlign: 'left' }}>
                {[
                  ['Institution', link?.university],
                  ['Department', link?.department],
                  resolvedTeacherName ? ['Instructor', resolvedTeacherName] : null,
                  ['Role', link?.role],
                  ['Wallet', registeredWallet || address],
                ].filter(Boolean).map(([label, value]: any) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid #E4E7EC' }}>
                    <span style={{ fontSize: 12, color: '#6B7280' }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#111827', fontFamily: label === 'Wallet' ? 'monospace' : undefined }}>{value}</span>
                  </div>
                ))}
                <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>You will gain access once your wallet address is approved.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

