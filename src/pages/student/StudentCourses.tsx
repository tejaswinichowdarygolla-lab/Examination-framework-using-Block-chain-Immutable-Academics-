import { GlassCard } from '@/components/shared/GlassCard';
import { StatusBadge } from '@/components/shared/Badges';
import { Button } from '@/components/ui/button';
import { mockCourses } from '@/utils/mockData';
import { BookOpen } from 'lucide-react';

export default function StudentCourses() {
  const courses = mockCourses.slice(0, 3);
  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">My Courses</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map(course => (
          <GlassCard key={course.id} hover className="space-y-3">
            <div className="p-2 rounded-lg bg-primary/10 w-fit">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold">{course.name}</h3>
            <p className="text-xs text-muted-foreground">{course.code} · {course.instructorName}</p>
            <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>
            <div className="flex items-center justify-between">
              <StatusBadge variant="success">Enrolled</StatusBadge>
              <span className="text-xs text-muted-foreground">{course.examCount} exams</span>
            </div>
            <Button size="sm" variant="outline" className="w-full border-primary/30 text-primary">Enter Course</Button>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
