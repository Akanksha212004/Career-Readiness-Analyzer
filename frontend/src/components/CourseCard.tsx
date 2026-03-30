import { motion } from 'framer-motion';
import { BookOpen, ExternalLink, Clock } from 'lucide-react';
import { CourseData } from '@/store/useCareerStore';

interface CourseCardProps {
  course: CourseData;
  index: number;
}

const CourseCard = ({ course, index }: CourseCardProps) => (
  <motion.a
    href={course.link}
    target="_blank"
    rel="noopener noreferrer"
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
    className="group flex flex-col rounded-2xl bg-card p-5 card-shadow ring-1 ring-border transition-all hover:elevated-shadow hover:ring-primary/30"
  >
    <div className="flex items-start justify-between">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <BookOpen className="h-5 w-5 text-primary" />
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
    <h4 className="mt-3 font-heading text-sm font-semibold text-foreground">{course.title}</h4>
    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="rounded-md bg-muted px-2 py-0.5">{course.platform}</span>
      <span className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {course.duration}
      </span>
    </div>
  </motion.a>
);

export default CourseCard;
