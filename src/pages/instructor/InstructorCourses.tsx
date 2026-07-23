import { GlassCard } from '@/components/shared/GlassCard';
import { StatusBadge } from '@/components/shared/Badges';
import { Button } from '@/components/ui/button';
import { mockCourses } from '@/utils/mockData';
import { BookOpen, Users, FileText, PlusCircle } from 'lucide-react';

export default function InstructorCourses() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Courses</h1>
        <Button className="bg-primary btn-glow"><PlusCircle className="h-4 w-4 mr-2" /> Create Course</Button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {mockCourses.map(course => (
          <GlassCard key={course.id} hover className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="p-2 rounded-lg bg-primary/10"><BookOpen className="h-5 w-5 text-primary" /></div>
              <span className="font-mono text-xs text-muted-foreground">{course.code}</span>
            </div>
            <h3 className="font-semibold">{course.name}</h3>
            <p className="text-sm text-muted-foreground">{course.description}</p>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {course.studentCount}</span>
              <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {course.examCount} exams</span>
            </div>
            <StatusBadge variant="success">Deployed</StatusBadge>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
