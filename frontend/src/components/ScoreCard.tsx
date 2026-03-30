import { motion } from 'framer-motion';

interface ScoreCardProps {
  label: string;
  score: number;
  icon: React.ReactNode;
  delay?: number;
}

const getScoreColor = (score: number) => {
  if (score >= 70) return { text: 'text-success', bg: 'bg-success/10', ring: 'ring-success/20' };
  if (score >= 50) return { text: 'text-accent', bg: 'bg-accent/10', ring: 'ring-accent/20' };
  return { text: 'text-destructive', bg: 'bg-destructive/10', ring: 'ring-destructive/20' };
};

const ScoreCard = ({ label, score, icon, delay = 0 }: ScoreCardProps) => {
  const colors = getScoreColor(score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="rounded-2xl bg-card p-6 card-shadow ring-1 ring-border"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className="mt-1 flex items-baseline gap-1">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delay + 0.3 }}
              className={`font-heading text-3xl font-bold ${colors.text}`}
            >
              {score}
            </motion.span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colors.bg} ring-1 ${colors.ring}`}>
          {icon}
        </div>
      </div>
      {/* Score bar */}
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ delay: delay + 0.2, duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${
            score >= 70 ? 'bg-success' : score >= 50 ? 'bg-accent' : 'bg-destructive'
          }`}
        />
      </div>
    </motion.div>
  );
};

export default ScoreCard;
