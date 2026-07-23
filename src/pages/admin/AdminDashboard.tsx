import React, { useState, useEffect } from 'react';
import { GlassCard } from '@/components/shared/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Copy, Check, X, Trash2, ArrowRight, Users, Link as LinkIcon, GraduationCap, Building2, Play, Pause } from 'lucide-react';
import { ENV } from '@/config/env';
import { 
  generateRegistrationLink, 
  getAllLinks, 
  deleteLink, 
  getPendingSubmissions, 
  approveUser, 
  toggleLinkStatus,
  type RegistrationLink 
} from '@/utils/registrationLinks';
import { mfsAppendCSVRow, MFS } from '@/utils/mfs';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/Badges';
import { useWallet } from '@/context/WalletContext';

export default function AdminDashboard() {
  const [links, setLinks] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSubmissions, setSelectedSubmissions] = useState<string[]>([]);
  const [university, setUniversity] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState<'Teacher' | 'Student'>('Teacher');
  const [generatedLink, setGeneratedLink] = useState<{ id: string; url: string } | null>(null);
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  const { address } = useWallet();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [allLinks, pending] = await Promise.all([
      getAllLinks(),
      getPendingSubmissions()
    ]);
    setLinks(allLinks);
    setSubmissions(pending);
  };

  const handleGenerate = async () => {
    if (!university || !department) {
      toast({ title: "Error", description: "Please fill University and Department", variant: "destructive" });
      return;
    }
    try {
      if (!address) throw new Error("Wallet not connected");
      const result = await generateRegistrationLink(role, address, university, department);
      setGeneratedLink({ id: result.linkId, url: result.url });
      await loadData();
      toast({ title: "Link Generated", description: "New unique registration link created." });
      addNotification("Institutional Link Created", `New registration invite for ${role} is now live and anchored to IPFS.`, 'ADMIN', 'SUCCESS');
    } catch (err: any) {
      console.error(err);
      toast({ title: "Generation Failed", description: err.message || "IPFS error", variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Link copied to clipboard." });
  };

  const handleDeleteLink = async (id: string) => {
    try {
      await deleteLink(id);
      await loadData();
      toast({ title: "Link Deleted", description: "Link and associated data revoked." });
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleToggleLinkStatus = async (linkId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'stopped' : 'active';
      await toggleLinkStatus(linkId, (newStatus as any));
      toast({ title: "Updated", description: `Link status changed to ${newStatus}` });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to update link status", variant: "destructive" });
    }
  };

  const handleApprove = async (submissionId: string) => {
    try {
      await approveUser(submissionId);
      toast({ title: "Success", description: "User approved successfully" });
      addNotification("User Access Granted", `A new submission has been approved for institutional access. Registry updated.`, 'ADMIN', 'SUCCESS');
      await loadData();
      setSelectedSubmissions(prev => prev.filter(id => id !== submissionId));
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Approval failed", variant: "destructive" });
    }
  };

  const handleReject = async (submissionId: string) => {
    try {
      // For now we just mark as rejected in the CSV or remove it
      // Actually we'll mark as rejected to keep records
      await approveUser(submissionId, 'rejected'); 
      toast({ title: "Rejected", description: "Application rejected" });
      loadData();
      setSelectedSubmissions(prev => prev.filter(id => id !== submissionId));
    } catch (e: any) {
      toast({ title: "Error", description: "Rejection failed", variant: "destructive" });
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedSubmissions.length === 0) return;
    
    let successCount = 0;
    for (const id of selectedSubmissions) {
      try {
        if (action === 'approve') await approveUser(id);
        else await approveUser(id, 'rejected');
        successCount++;
      } catch (e) {
        console.error(`Bulk action failed for ${id}`, e);
      }
    }
    
    toast({ 
      title: "Bulk Action Complete", 
      description: `Successfully ${action === 'approve' ? 'approved' : 'rejected'} ${successCount} out of ${selectedSubmissions.length} applications.` 
    });
    
    loadData();
    setSelectedSubmissions([]);
  };

  const toggleSelect = (id: string) => {
    setSelectedSubmissions(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedSubmissions.length === submissions.length) setSelectedSubmissions([]);
    else setSelectedSubmissions(submissions.map(s => s.id));
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>

      {/* Page Header */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: '0 0 4px', lineHeight: 1.3 }}>System Dashboard</h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>Institutional controls and user management</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 500, background: '#DBEAFE', color: '#1E3A8A', padding: '2px 8px', borderRadius: 4 }}>Admin</span>
          <span style={{ fontSize: 12, fontWeight: 500, background: '#F3F4F6', color: '#374151', padding: '2px 8px', borderRadius: 4 }}>Local Network</span>
        </div>
      </div>

      {/* Generate Link Section */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E4E7EC', borderRadius: 8, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>Generate Registration Link</h2>
            <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>Create unique invite links for teachers and students</p>
          </div>
          <button
            onClick={handleGenerate}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: 6,
              fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'background 150ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1D4ED8')}
            onMouseLeave={e => (e.currentTarget.style.background = '#2563EB')}
          >
            <Plus style={{ width: 14, height: 14 }} /> Generate Link
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: generatedLink ? 16 : 0 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>College / University</label>
            <Input id="university" placeholder="e.g. Stanford University" value={university} onChange={e => setUniversity(e.target.value)} style={{ borderColor: '#E4E7EC' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Department</label>
            <Input id="department" placeholder="e.g. Computer Science" value={department} onChange={e => setDepartment(e.target.value)} style={{ borderColor: '#E4E7EC' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Target Role</label>
            <Select value={role} onValueChange={(v: any) => setRole(v)}>
              <SelectTrigger style={{ borderColor: '#E4E7EC' }}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Teacher">Teacher</SelectItem>
                <SelectItem value="Student">Student</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {generatedLink && (
          <div style={{ padding: '12px 16px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: '#14532D', marginBottom: 8 }}>Link generated successfully</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, background: '#FFFFFF', border: '1px solid #E4E7EC', borderRadius: 6, padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {generatedLink.url}
              </div>
              <button
                onClick={() => copyToClipboard(generatedLink.url)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#FFFFFF', border: '1px solid #E4E7EC', borderRadius: 6, fontSize: 13, fontWeight: 500, color: '#374151', cursor: 'pointer' }}
              >
                <Copy style={{ width: 13, height: 13 }} /> Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invite Links Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E4E7EC', borderRadius: 8, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E4E7EC', display: 'flex', alignItems: 'center', gap: 8 }}>
          <LinkIcon style={{ width: 16, height: 16, color: '#6B7280' }} />
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>Active Invite Links</h2>
          <span style={{ marginLeft: 4, fontSize: 12, fontWeight: 500, background: '#F3F4F6', color: '#374151', padding: '1px 6px', borderRadius: 4 }}>{links.length}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow style={{ background: '#F7F8FA' }}>
              <TableHead>Link ID</TableHead>
              <TableHead>University</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} style={{ textAlign: 'center', padding: '48px 16px', color: '#9CA3AF', fontSize: 14 }}>
                  No links generated yet.
                </TableCell>
              </TableRow>
            ) : links.map(l => (
              <TableRow key={l.linkId}>
                <TableCell style={{ fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF' }}>{l.linkId.slice(0,8)}...</TableCell>
                <TableCell style={{ fontWeight: 500 }}>{l.university}</TableCell>
                <TableCell style={{ color: '#6B7280' }}>{l.department}</TableCell>
                <TableCell>
                  <span style={{
                    fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
                    background: l.role === 'Teacher' ? '#DBEAFE' : '#DCFCE7',
                    color: l.role === 'Teacher' ? '#1D4ED8' : '#15803D',
                  }}>{l.role}</span>
                </TableCell>
                <TableCell style={{ fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF' }}>{l.createdBy.slice(0,6)}...{l.createdBy.slice(-4)}</TableCell>
                <TableCell style={{ fontSize: 13, color: '#6B7280' }}>{new Date(l.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <span style={{
                    fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
                    background: l.status === 'active' ? '#DCFCE7' : '#FEF3C7',
                    color: l.status === 'active' ? '#14532D' : '#92400E',
                  }}>{l.status}</span>
                </TableCell>
                <TableCell style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                    <button title="Copy link" onClick={() => copyToClipboard(`${window.location.origin}/register/${l.linkId}`)}
                      style={{ padding: '4px 8px', background: 'none', border: '1px solid #E4E7EC', borderRadius: 4, cursor: 'pointer', color: '#6B7280', fontSize: 12 }}>
                      <Copy style={{ width: 12, height: 12 }} />
                    </button>
                    <button title={l.status === 'active' ? 'Stop' : 'Start'} onClick={() => handleToggleLinkStatus(l.linkId, l.status)}
                      style={{ padding: '4px 8px', background: 'none', border: '1px solid #E4E7EC', borderRadius: 4, cursor: 'pointer', color: l.status === 'active' ? '#D97706' : '#16A34A', fontSize: 12 }}>
                      {l.status === 'active' ? <Pause style={{ width: 12, height: 12 }} /> : <Play style={{ width: 12, height: 12 }} />}
                    </button>
                    <button title="Open link" onClick={() => window.open(`/register/${l.linkId}`, '_blank')}
                      style={{ padding: '4px 8px', background: 'none', border: '1px solid #E4E7EC', borderRadius: 4, cursor: 'pointer', color: '#2563EB', fontSize: 12 }}>
                      <ArrowRight style={{ width: 12, height: 12 }} />
                    </button>
                    <button title="Delete" onClick={() => handleDeleteLink(l.linkId)}
                      style={{ padding: '4px 8px', background: 'none', border: '1px solid #FECACA', borderRadius: 4, cursor: 'pointer', color: '#DC2626', fontSize: 12 }}>
                      <Trash2 style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pending Approvals */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E4E7EC', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E4E7EC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users style={{ width: 16, height: 16, color: '#6B7280' }} />
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>Pending Approvals</h2>
            {submissions.length > 0 && (
              <span style={{ fontSize: 12, fontWeight: 500, background: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: 4 }}>{submissions.length}</span>
            )}
          </div>
          {selectedSubmissions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#6B7280' }}>{selectedSubmissions.length} selected</span>
              <button onClick={() => handleBulkAction('approve')} style={{ padding: '6px 12px', background: '#FFFFFF', border: '1px solid #BBF7D0', borderRadius: 6, fontSize: 13, fontWeight: 500, color: '#16A34A', cursor: 'pointer' }}>
                <Check style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />Approve All
              </button>
              <button onClick={() => handleBulkAction('reject')} style={{ padding: '6px 12px', background: '#FFFFFF', border: '1px solid #FECACA', borderRadius: 6, fontSize: 13, fontWeight: 500, color: '#DC2626', cursor: 'pointer' }}>
                <X style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />Reject All
              </button>
            </div>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow style={{ background: '#F7F8FA' }}>
              <TableHead style={{ width: 40 }}>
                <input type="checkbox"
                  checked={submissions.length > 0 && selectedSubmissions.length === submissions.length}
                  onChange={toggleSelectAll}
                  style={{ accentColor: '#2563EB' }}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Wallet Address</TableHead>
              <TableHead>Institution</TableHead>
              <TableHead>Link ID</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} style={{ textAlign: 'center', padding: '48px 16px', color: '#9CA3AF', fontSize: 14 }}>
                  No pending approvals. All clear.
                </TableCell>
              </TableRow>
            ) : submissions.map(s => (
              <TableRow key={s.id} style={{ background: selectedSubmissions.includes(s.id) ? '#EFF6FF' : '#FFFFFF' }}>
                <TableCell>
                  <input type="checkbox" checked={selectedSubmissions.includes(s.id)} onChange={() => toggleSelect(s.id)} style={{ accentColor: '#2563EB' }} />
                </TableCell>
                <TableCell style={{ fontWeight: 500 }}>{s.name}</TableCell>
                <TableCell style={{ fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>
                  {s.walletAddress.slice(0,8)}...{s.walletAddress.slice(-6)}
                </TableCell>
                <TableCell>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, margin: '0 0 2px' }}>{s.university}</p>
                    <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>{s.department}</p>
                  </div>
                </TableCell>
                <TableCell style={{ fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF' }}>...{s.linkId.slice(-8)}</TableCell>
                <TableCell style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => handleApprove(s.id)}
                      style={{ padding: '5px 12px', background: '#FFFFFF', border: '1px solid #BBF7D0', borderRadius: 6, fontSize: 13, fontWeight: 500, color: '#16A34A', cursor: 'pointer' }}>
                      Approve
                    </button>
                    <button onClick={() => handleReject(s.id)}
                      style={{ padding: '5px 12px', background: '#FFFFFF', border: '1px solid #FECACA', borderRadius: 6, fontSize: 13, fontWeight: 500, color: '#DC2626', cursor: 'pointer' }}>
                      Reject
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}


