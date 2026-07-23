import { GlassCard } from '@/components/shared/GlassCard';
import { CIDDisplay } from '@/components/shared/HashDisplays';
import { HardDrive } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const mockFiles = [
  { name: 'exam-midterm-cs401.enc', cid: 'QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX', size: '2.4 KB', type: 'Encrypted Exam' },
  { name: 'exam-quiz-cs502.enc', cid: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG', size: '1.8 KB', type: 'Encrypted Exam' },
  { name: 'syllabus-cs401.pdf', cid: 'QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB', size: '156 KB', type: 'Document' },
];

export default function IPFSManager() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <HardDrive className="h-6 w-6 text-secondary" />
        <h1 className="text-2xl font-bold">IPFS File Manager</h1>
      </div>

      <GlassCard className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Pinata Storage Used</span>
          <span>234 MB / 500 MB</span>
        </div>
        <Progress value={46.8} className="h-2" />
      </GlassCard>

      <div className="space-y-3">
        {mockFiles.map((file, i) => (
          <GlassCard key={i} className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{file.name}</p>
              <p className="text-xs text-muted-foreground">{file.type} · {file.size}</p>
            </div>
            <CIDDisplay cid={file.cid} />
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
