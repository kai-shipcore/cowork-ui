import { Badge } from '@coverland-engineering/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@coverland-engineering/ui/card';
import { SummaryCard } from '@coverland-engineering/ui/summary-card';
import { Navigate, useParams } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { StatusBadge } from '@/shared/components/status-badge';
import '../dashboard.css';

interface TeamDashboard {
  name: string;
  description: string;
  objective: string;
  skills: string[];
  metrics: { label: string; value: string; description: string }[];
  focusTitle: string;
  focusItems: {
    title: string;
    detail: string;
    owner: string;
    status: string;
    tone: 'success' | 'warning' | 'danger' | 'cyan' | 'purple' | 'neutral';
  }[];
  members: {
    name: string;
    role: string;
    initials: string;
    color: string;
    status: string;
    activity: string;
  }[];
}

const TEAM_DASHBOARDS: Record<string, TeamDashboard> = {
  'demand-planning': {
    name: 'Demand Planning',
    description:
      'Balance demand, inventory, and purchasing so every sales channel has the right products at the right time.',
    objective: 'Forecast accuracy and healthy weeks of cover',
    skills: ['Forecasting', 'Inventory', 'Purchasing', 'Seasonality'],
    metrics: [
      {
        label: 'Forecast Accuracy',
        value: '87.4%',
        description: '+2.8% vs last month',
      },
      {
        label: 'Stockout Risk',
        value: '18',
        description: '6 high-priority SKUs',
      },
      {
        label: 'Open Purchase Orders',
        value: '26',
        description: '8 arriving this week',
      },
      {
        label: 'Weeks of Cover',
        value: '6.8',
        description: 'Target range 6–8 weeks',
      },
    ],
    focusTitle: 'Planning Priorities',
    focusItems: [
      {
        title: 'Car Cover Q4 demand plan',
        detail: 'Amazon US · 42 SKUs',
        owner: 'Mina Park',
        status: 'Review',
        tone: 'warning',
      },
      {
        title: 'Prime Day inventory allocation',
        detail: 'All channels · 18 SKUs',
        owner: 'Daniel Kim',
        status: 'At Risk',
        tone: 'danger',
      },
      {
        title: 'October purchase plan',
        detail: '3 suppliers · 9 POs',
        owner: 'Grace Lee',
        status: 'On Track',
        tone: 'success',
      },
      {
        title: 'Slow-moving stock review',
        detail: 'Warehouse · 27 SKUs',
        owner: 'Evan Cho',
        status: 'Analysis',
        tone: 'cyan',
      },
    ],
    members: [
      {
        name: 'Mina Park',
        role: 'Demand Planning Lead',
        initials: 'MP',
        color: 'bg-fuchsia-600',
        status: 'In Office',
        activity: 'Forecast review · 20 min ago',
      },
      {
        name: 'Daniel Kim',
        role: 'Inventory Planner',
        initials: 'DK',
        color: 'bg-violet-600',
        status: 'Remote',
        activity: 'Allocation updated · 1 hr ago',
      },
      {
        name: 'Grace Lee',
        role: 'Purchase Planner',
        initials: 'GL',
        color: 'bg-pink-600',
        status: 'In Office',
        activity: 'PO confirmed · Today',
      },
      {
        name: 'Evan Cho',
        role: 'Planning Analyst',
        initials: 'EC',
        color: 'bg-indigo-600',
        status: 'Remote',
        activity: 'Report refreshed · Today',
      },
    ],
  },
  'customer-services': {
    name: 'Customer Services',
    description:
      'Resolve customer questions, returns, and marketplace cases quickly while protecting service quality.',
    objective: 'Fast resolution with a consistent customer experience',
    skills: ['Customer Care', 'Returns', 'Marketplace Cases', 'SLA'],
    metrics: [
      { label: 'Open Cases', value: '42', description: '11 assigned today' },
      { label: 'SLA Met', value: '92%', description: '+4% this week' },
      {
        label: 'Returns Awaiting',
        value: '13',
        description: '4 need inspection',
      },
      {
        label: 'Customer Satisfaction',
        value: '4.7',
        description: 'Based on 186 responses',
      },
    ],
    focusTitle: 'Service Queue',
    focusItems: [
      {
        title: 'Amazon A-to-z claims',
        detail: '5 cases · Response due today',
        owner: 'Sophia Chen',
        status: 'Urgent',
        tone: 'danger',
      },
      {
        title: 'Fitment-related returns',
        detail: 'Car Cover · 8 returns',
        owner: 'Alex Rivera',
        status: 'Investigating',
        tone: 'warning',
      },
      {
        title: 'Walmart customer messages',
        detail: '12 unread conversations',
        owner: 'Jamie Wu',
        status: 'In Progress',
        tone: 'cyan',
      },
      {
        title: 'Refund approval batch',
        detail: '7 orders · $684 total',
        owner: 'Nina Patel',
        status: 'Ready',
        tone: 'success',
      },
    ],
    members: [
      {
        name: 'Sophia Chen',
        role: 'Customer Service Lead',
        initials: 'SC',
        color: 'bg-amber-600',
        status: 'In Office',
        activity: 'Case assigned · 8 min ago',
      },
      {
        name: 'Alex Rivera',
        role: 'Returns Specialist',
        initials: 'AR',
        color: 'bg-orange-600',
        status: 'In Office',
        activity: 'Return inspected · 35 min ago',
      },
      {
        name: 'Jamie Wu',
        role: 'Marketplace Support',
        initials: 'JW',
        color: 'bg-yellow-600',
        status: 'Remote',
        activity: 'Customer replied · 1 hr ago',
      },
      {
        name: 'Nina Patel',
        role: 'Resolution Specialist',
        initials: 'NP',
        color: 'bg-lime-600',
        status: 'In Office',
        activity: 'Refund batch prepared · Today',
      },
    ],
  },
  ecommerce: {
    name: 'eCommerce Team',
    description:
      'Keep product listings healthy, coordinate channel operations, and improve sales performance across marketplaces.',
    objective: 'Accurate listings and profitable channel growth',
    skills: ['Listings', 'Marketplaces', 'Promotions', 'Analytics'],
    metrics: [
      {
        label: 'Active Listings',
        value: '1,248',
        description: 'Across 5 channels',
      },
      {
        label: 'Listing Issues',
        value: '23',
        description: '7 suppressions need action',
      },
      {
        label: 'Promotions Live',
        value: '8',
        description: '3 ending this week',
      },
      {
        label: 'Sales Growth',
        value: '+12.6%',
        description: 'Compared with last month',
      },
    ],
    focusTitle: 'Channel Operations',
    focusItems: [
      {
        title: 'Amazon suppressed listings',
        detail: '7 ASINs · Image compliance',
        owner: 'Kevin Tran',
        status: 'Blocked',
        tone: 'danger',
      },
      {
        title: 'Walmart catalog refresh',
        detail: '126 items · Content sync',
        owner: 'Olivia Martin',
        status: 'Running',
        tone: 'cyan',
      },
      {
        title: 'eBay fall promotion',
        detail: 'Car Covers · 15% campaign',
        owner: 'Leo Zhang',
        status: 'Scheduled',
        tone: 'purple',
      },
      {
        title: 'Shopify SEO improvements',
        detail: '32 product pages',
        owner: 'Emma Davis',
        status: 'On Track',
        tone: 'success',
      },
    ],
    members: [
      {
        name: 'Kevin Tran',
        role: 'eCommerce Lead',
        initials: 'KT',
        color: 'bg-blue-600',
        status: 'In Office',
        activity: 'Listing fixed · 12 min ago',
      },
      {
        name: 'Olivia Martin',
        role: 'Marketplace Manager',
        initials: 'OM',
        color: 'bg-sky-600',
        status: 'Remote',
        activity: 'Catalog synced · 40 min ago',
      },
      {
        name: 'Leo Zhang',
        role: 'Promotion Specialist',
        initials: 'LZ',
        color: 'bg-cyan-600',
        status: 'In Office',
        activity: 'Campaign scheduled · Today',
      },
      {
        name: 'Emma Davis',
        role: 'Content Specialist',
        initials: 'ED',
        color: 'bg-indigo-600',
        status: 'Remote',
        activity: 'Content updated · Today',
      },
    ],
  },
};

export function TeamDashboardPage() {
  const { teamId } = useParams();
  const dashboard = teamId ? TEAM_DASHBOARDS[teamId] : undefined;

  if (!dashboard) return <Navigate to={ROUTES.dashboard} replace />;

  return (
    <section className="dashboard team-dashboard">
      <Card className="team-dashboard-profile">
        <CardContent>
          <div className="team-dashboard-profile-copy">
            <span className="team-dashboard-eyebrow">Team Dashboard</span>
            <h1>{dashboard.name}</h1>
            <p>{dashboard.description}</p>
            <div className="team-dashboard-skills" aria-label="Team skills">
              {dashboard.skills.map((skill) => (
                <Badge key={skill} variant="secondary" appearance="light">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
          <dl className="team-dashboard-objective">
            <div>
              <dt>Visibility</dt>
              <dd>Company-wide</dd>
            </div>
            <div>
              <dt>Primary objective</dt>
              <dd>{dashboard.objective}</dd>
            </div>
            <div>
              <dt>Members</dt>
              <dd>{dashboard.members.length} active</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="team-dashboard-metrics">
        {dashboard.metrics.map((metric) => (
          <SummaryCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            description={metric.description}
          />
        ))}
      </div>

      <div className="team-dashboard-columns">
        <Card className="dashboard-panel">
          <CardHeader>
            <CardTitle>
              {dashboard.focusTitle}
              <small>{dashboard.focusItems.length} items</small>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.focusItems.map((item) => (
              <div className="team-dashboard-focus-row" key={item.title}>
                <StatusBadge label={item.status} tone={item.tone} />
                <div className="dashboard-row-text">
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
                <span className="team-dashboard-owner">{item.owner}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="dashboard-panel">
          <CardHeader>
            <CardTitle>
              Team Members<small>{dashboard.members.length} active</small>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.members.map((member) => (
              <div className="team-dashboard-member" key={member.name}>
                <span className={`team-dashboard-avatar ${member.color}`}>
                  {member.initials}
                </span>
                <div className="dashboard-row-text">
                  <strong>{member.name}</strong>
                  <span>{member.role}</span>
                </div>
                <div className="team-dashboard-member-meta">
                  <StatusBadge
                    label={member.status}
                    tone={member.status === 'In Office' ? 'success' : 'neutral'}
                  />
                  <span>{member.activity}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
