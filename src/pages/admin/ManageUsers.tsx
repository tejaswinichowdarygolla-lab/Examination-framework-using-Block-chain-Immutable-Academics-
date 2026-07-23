import React, { useState, useEffect } from 'react';
import { useWallet } from '@/context/WalletContext';
import { useWeb3 } from '@/hooks/useWeb3';
import { useContract } from '@/hooks/useContract';
import {
  generateRegistrationLink,
  getAllLinks,
  getPendingSubmissions,
  approveUser,
  deleteLink as revokeLink,
  type RegistrationLink,
} from '@/utils/registrationLinks';
import { useToast } from '@/components/ui/use-toast';
import { Shield, Users, UserPlus, Link as LinkIcon, AlertCircle, Copy, CheckCircle2 } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/Badges';
import { Button } from '@/components/ui/button';

export default function ManageUsers() {
  const { address } = useWallet();
  const { web3 } = useWeb3();
  const { getRoleManager } = useContract(web3);
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  const [links, setLinks] = useState<RegistrationLink[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [institution, setInstitution] = useState('');
  const [department, setDepartment] = useState('');
  const [targetRole, setTargetRole] = useState<'Teacher' | 'Student'>('Teacher');
  const [scopeAddress, setScopeAddress] = useState(address || '');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [fetchedLinks, pending] = await Promise.all([
        getAllLinks(scopeAddress || undefined),
        getPendingSubmissions(scopeAddress || undefined)
      ]);
      setLinks(fetchedLinks);
      setPendingUsers(pending);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: 'Failed to load data from IPFS', variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerateLink = async () => {
    if (!address) return;
    if (!institution || !department) {
      toast({ title: "Submission Error", description: 'Please enter both Institution and Department.', variant: "destructive" });
      return;
    }
    try {
      const { url } = await generateRegistrationLink(targetRole, address, institution, department);
      toast({ title: "Success", description: `Generated ${targetRole} invite link!` });
      navigator.clipboard.writeText(url);
      toast({ title: "Copied", description: 'Link copied to clipboard' });
      fetchData();
    } catch (err: any) {
      console.error("[LinkGen] Error:", err);
      toast({ title: "Generation Failed", description: err.message || 'Check IPFS/Permissions (403)', variant: "destructive" });
    }
  };

  const handleApprove = async (user: any) => {
    if (!address || !web3) {
      toast({ title: "Error", description: 'Wallet or Web3 not ready', variant: "destructive" });
      return;
    }

    toast({ title: "Processing", description: `Approving ${user.name} on blockchain...` });
    try {
      const roleManager = await getRoleManager();
      if (!roleManager) throw new Error('RoleManager contract not found');

      // SEC-TC-063: Idempotency Check
      const roleStr = user.role.toUpperCase();
      const currentRole = await roleManager.methods.getRole(user.walletAddress).call();
      if (currentRole === roleStr) {
        toast({ title: "Already Approved", description: `${user.name} is already authorized as ${roleStr}.` });
        await approveUser(user.id);
        fetchData();
        return;
      }

      const txMethod = user.role === 'teacher' 
        ? roleManager.methods.grantTeacher(user.walletAddress)
        : roleManager.methods.grantStudent(user.walletAddress);

      await txMethod.send({ from: address });

      // 2. IPFS Update
      await approveUser(user.id);
      
      toast({ title: "Success", description: `${user.name} approved as ${user.role}!` });
      addNotification("User Approved", `Authorized ${user.name} for institutional access.`);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err.message || 'Failed to approve user', variant: "destructive" });
    }
  };

  const handleBulkApprove = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !address) return;
    try {
      setIsBulkProcessing(true);
      const { readFileAsText, parseCSVText } = await import('@/utils/examUtils');
      const text = await readFileAsText(file);
      const rows = parseCSVText(text);
      
      let approvedCount = 0;
      const seenWallets = new Set<string>(); // SEC-TC-045: De-duplicate batch entries
      
      for (const row of rows) {
        const wallet = row[0]?.toLowerCase();
        const email = row[1]?.toLowerCase(); // SEC-TC-065
        
        if (!wallet || seenWallets.has(wallet)) continue;
        
        seenWallets.add(wallet);
        const pending = pendingUsers.find(p => 
          p.walletAddress.toLowerCase() === wallet && 
          (!email || p.email?.toLowerCase() === email) // SEC-TC-065: email match
        );
        if (pending) {
          await handleApprove(pending);
          approvedCount++;
        }
      }
      toast({ title: "Bulk Result", description: `Processed ${rows.length} rows, approved ${approvedCount} users.` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Bulk Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleReject = async (user: any) => {
    // For now we don't have rejectUser in CSV system, just remove
    toast({ title: "Note", description: 'Reject function moved to Dashboard', variant: "destructive" });
  };

  const handleRevoke = async (linkId: string) => {
    try {
      await revokeLink(linkId);
      toast({ title: "Revoked", description: 'Link revoked.' });
      fetchData();
    } catch {
      toast({ title: "Error", description: 'Failed to revoke link', variant: "destructive" });
    }
  };

  if (isLoading) return <div className="p-8 text-white">Loading Admin Data...</div>;

  return (
    <div className="p-8 space-y-8 text-white max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/10 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Institutional Access Control</h1>
          <p className="text-sm text-muted-foreground italic">Manage identities and authentication gateways</p>
        </div>
        <div className="flex gap-2 items-center bg-white/5 p-2 rounded-xl border border-white/10">
           <StatusBadge variant="info">Scoping: {scopeAddress === address ? 'Self' : 'Teacher'}</StatusBadge>
           <input 
             value={scopeAddress}
             onChange={e => setScopeAddress(e.target.value)}
             placeholder="Teacher Wallet Address"
             className="bg-black/40 border-none text-[10px] w-48 focus:ring-1 focus:ring-primary rounded px-2 py-1 ml-2 font-mono"
           />
           <button onClick={fetchData} className="p-1 hover:text-primary transition-colors"><Shield size={14} /></button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-8">
        <div className="space-y-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <span className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                Pending Approvals
              </h2>
              <div className="relative overflow-hidden inline-flex">
                 <input type="file" accept=".csv" onChange={handleBulkApprove} className="absolute inset-0 opacity-0 cursor-pointer" />
                 <Button size="sm" variant="outline" className="text-[10px] h-7 border-emerald-500/30 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10" disabled={isBulkProcessing}>
                   {isBulkProcessing ? 'Processing CSV...' : 'Bulk CSV Approve'}
                 </Button>
              </div>
            </div>
            {pendingUsers.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 bg-white/5">
                <p className="text-gray-400">No pending registrations found in IPFS.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {pendingUsers.map(user => (
                  <div key={user.walletAddress} className="p-5 bg-[#1a1c2e] border border-white/10 rounded-2xl flex items-center justify-between group hover:border-emerald-500/50 transition-all shadow-xl">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-lg">{user.name}</p>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                          user.role === 'Teacher' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                        }`}>
                          {user.role?.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{user.university} • {user.department}</p>
                      <div className="flex items-center gap-1.5 pt-1">
                        <code className="text-[10px] text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/30">
                          {user.walletAddress}
                        </code>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleApprove(user)} 
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => handleReject(user)} 
                        className="px-5 py-2 bg-white/5 hover:bg-red-900/20 text-red-400 border border-white/10 rounded-xl font-medium transition-all"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Registration Links */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="w-1.5 h-6 bg-purple-500 rounded-full" />
              Invite Dashboard
            </h2>
            {links.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 bg-white/5">
                <p className="text-gray-400">No active invite links.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {links.map(l => (
                  <div key={l.linkId} className="p-4 bg-[#1a1c2e] border border-white/10 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${l.role === 'Teacher' ? 'bg-purple-900/30' : 'bg-emerald-900/30'}`}>
                         <div className={`w-3 h-3 rounded-full ${l.role === 'Teacher' ? 'bg-purple-400' : 'bg-emerald-400'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-bold capitalize">{l.role} Invite</p>
                        <p className="text-xs text-muted-foreground">
                          Status: <span className={l.status === 'active' ? 'text-success' : 'text-warning'}>{l.status}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold">
                      {l.status === 'active' && (
                        <button onClick={() => handleRevoke(l.linkId)} className="text-red-400 hover:text-red-300 uppercase tracking-tight">Revoke</button>
                      )}
                      <button
                        onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/register/${l.linkId}`);
                            toast({ title: 'Invite Link Copied', description: 'Address copied to clipboard' });
                        }}
                        className="px-4 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded-lg hover:bg-primary/30 transition-all flex items-center gap-2"
                      >
                         COPY URL
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Action Panel */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-white/10 bg-[#121421] sticky top-24 shadow-2xl space-y-6">
            <h3 className="text-lg font-bold">Quick Actions</h3>
            
            <div className="space-y-6">
              <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">College / University</label>
                  <input 
                    type="text" 
                    value={institution}
                    onChange={e => setInstitution(e.target.value)}
                    placeholder="e.g. Stanford University"
                    className="w-full bg-[#0a0b14] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Department</label>
                  <input 
                    type="text" 
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    placeholder="e.g. Computer Science"
                    className="w-full bg-[#0a0b14] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Target Role</label>
                  <select 
                    value={targetRole}
                    onChange={e => setTargetRole(e.target.value as any)}
                    className="w-full bg-[#0a0b14] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none transition-all"
                  >
                    <option value="Teacher">Teacher</option>
                    <option value="Student">Student</option>
                  </select>
                </div>

                <button
                  onClick={handleGenerateLink}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-sm shadow-xl shadow-blue-900/30 transition-all active:scale-95 flex items-center justify-center gap-2 mt-2"
                >
                  <UserPlus size={16} />
                  + Generate Link
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
               <div className="flex items-center gap-2 text-xs text-gray-500">
                 <Shield size={14} className="text-cyan-500" />
                 <span>On-chain authorization required for all approvals.</span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

