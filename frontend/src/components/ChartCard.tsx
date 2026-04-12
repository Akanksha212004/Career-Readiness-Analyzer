import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Cell,
} from 'recharts';
import { ScoreBreakdown } from '@/store/useCareerStore';

interface ChartCardProps {
  breakdown: ScoreBreakdown;
}

const ChartCard = ({ breakdown }: ChartCardProps) => {
  const data = [
    { name: 'Skills',     score: breakdown.skills,     fill: 'hsl(162, 63%, 35%)' },
    { name: 'Projects',   score: breakdown.projects,   fill: 'hsl(38, 92%, 55%)'  },
    { name: 'Experience', score: breakdown.experience, fill: 'hsl(200, 60%, 45%)' },
    { name: 'Education',  score: breakdown.education,  fill: 'hsl(280, 50%, 55%)' },
  ];

  const radarData = data.map((d) => ({ subject: d.name, score: d.score, fullMark: 100 }));

  // ✅ key forces full re-mount when scores change
  const chartKey = `${breakdown.skills}-${breakdown.projects}-${breakdown.experience}-${breakdown.education}`;

  return (
    <motion.div
      key={chartKey}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="grid gap-6 md:grid-cols-2"
    >
      <div className="rounded-2xl bg-card p-6 card-shadow ring-1 ring-border">
        <h3 className="mb-4 font-heading text-lg font-semibold text-foreground">Score Breakdown</h3>
        <ResponsiveContainer width="100%" height={240}>
          {/* ✅ key on BarChart forces recharts to re-render */}
          <BarChart key={chartKey} data={data} barSize={36}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(160, 15%, 88%)" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(200, 10%, 45%)' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'hsl(200, 10%, 45%)' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(160, 15%, 88%)',
                borderRadius: '12px',
                fontSize: '13px',
              }}
            />
            <Bar dataKey="score" radius={[8, 8, 0, 0]}>
              {/* ✅ Cell gives each bar its own color */}
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl bg-card p-6 card-shadow ring-1 ring-border">
        <h3 className="mb-4 font-heading text-lg font-semibold text-foreground">Skill Radar</h3>
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart key={chartKey} data={radarData}>
            <PolarGrid stroke="hsl(160, 15%, 88%)" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: 'hsl(200, 10%, 45%)' }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
            <Radar dataKey="score" stroke="hsl(162, 63%, 35%)" fill="hsl(162, 63%, 35%)" fillOpacity={0.2} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default ChartCard;