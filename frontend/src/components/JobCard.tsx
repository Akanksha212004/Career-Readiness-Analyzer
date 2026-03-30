import { motion } from 'framer-motion';
import { Briefcase, MapPin, ExternalLink } from 'lucide-react';
import { JobData } from '@/store/useCareerStore';

interface JobCardProps {
  job: JobData;
  index: number;
}

const JobCard = ({ job, index }: JobCardProps) => (
  <motion.a
    href={job.applyLink}
    target="_blank"
    rel="noopener noreferrer"
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
    className="group flex items-center gap-4 rounded-2xl bg-card p-5 card-shadow ring-1 ring-border transition-all hover:elevated-shadow hover:ring-primary/30"
  >
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10">
      <Briefcase className="h-6 w-6 text-accent" />
    </div>
    <div className="flex-1 min-w-0">
      <h4 className="font-heading text-sm font-semibold text-foreground">{job.role}</h4>
      <p className="text-sm text-muted-foreground">{job.company}</p>
      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" />
        {job.location}
      </div>
    </div>
    <div className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors group-hover:bg-primary/90">
      Apply <ExternalLink className="h-3 w-3" />
    </div>
  </motion.a>
);

export default JobCard;
