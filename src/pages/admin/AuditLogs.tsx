import React, { useState, useEffect } from 'react';
import { GlassCard } from '@/components/shared/GlassCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollText, Shield, UserCheck, UserX, Link as LinkIcon, Clock } from 'lucide-react';
import { mfsReadCSV, MFS } from '@/utils/mfs';
import { StatusBadge } from '@/components/shared/Badges';

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await mfsReadCSV(MFS.audit);
        if (data) {
          const mapped = data.rows.map(r => ({
            timestamp: parseInt(r[0]),
            action: r[1],
            category: r[2],
            user: r[3],
            details: r[4]
          })).sort((a,b) => b.timestamp - a.timestamp);
          setLogs(mapped);
        }
      } catch (e) {
        console.warn("No audit logs found yet");
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'APPROVE_USER': return <UserCheck className="h-4 w-4 text-success" />;
      case 'REJECT_USER': return <UserX className="h-4 w-4 text-destructive" />;
      case 'GENERATE_LINK': return <LinkIcon className="h-4 w-4 text-primary" />;
      default: return <Shield className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground animate-pulse">Scanning IPFS Logs...</div>;

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/10 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Global Audit Trail</h1>
          <p className="text-sm text-muted-foreground italic">Permanent, decentralized record of all administrative actions</p>
        </div>
        <div className="flex gap-2">
           <StatusBadge variant="info">AUDIT LOGS</StatusBadge>
        </div>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                    No activities recorded in the decentralized ledger yet.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="text-xs font-mono text-muted-foreground flex items-center gap-2">
                       <Clock className="h-3 w-3" /> {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <span className="font-semibold text-xs tracking-tight">{log.action}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] py-0">{log.category}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-primary/80">
                      {log.user === 'ADMIN' ? 'SystemAdmin' : log.user.slice(0,6) + '...' + log.user.slice(-4)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.details}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </GlassCard>
    </div>
  );
}
