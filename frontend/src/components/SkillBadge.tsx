import { motion } from 'framer-motion';

interface SkillBadgeProps {
  skill: string;
  variant: 'present' | 'missing';
  index: number;
}

const SkillBadge = ({ skill, variant, index }: SkillBadgeProps) => (
  <motion.span
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: index * 0.05 }}
    className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
      variant === 'present'
        ? 'bg-success/10 text-success ring-1 ring-success/20'
        : 'bg-destructive/10 text-destructive ring-1 ring-destructive/20'
    }`}
  >
    {variant === 'missing' && <span className="mr-1">✕</span>}
    {variant === 'present' && <span className="mr-1">✓</span>}
    {skill}
  </motion.span>
);

export default SkillBadge;
