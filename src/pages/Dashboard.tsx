import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, TrendingUp, Inbox } from "lucide-react";

const stats = [
  {
    name: "Total Revenue",
    value: "$45,231",
    change: "+20.1%",
    icon: DollarSign,
    color: "text-success",
  },
  {
    name: "Active Deals",
    value: "12",
    change: "+3",
    icon: TrendingUp,
    color: "text-primary",
  },
  {
    name: "Total Contacts",
    value: "2,345",
    change: "+180",
    icon: Users,
    color: "text-info",
  },
  {
    name: "Unread Messages",
    value: "8",
    change: "-2",
    icon: Inbox,
    color: "text-warning",
  },
];

export default function Dashboard() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground">Welcome back! Here's what's happening with your business.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.name}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.name}
                </CardTitle>
                <Icon className={cn("h-5 w-5", stat.color)} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  <span className={cn("font-medium", stat.change.startsWith("+") ? "text-success" : "text-muted-foreground")}>
                    {stat.change}
                  </span>{" "}
                  from last month
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Deals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Enterprise License - Acme Corp</p>
                  <p className="text-sm text-muted-foreground">Updated 2 hours ago</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-success">$25,000</p>
                  <p className="text-xs text-muted-foreground">Negotiation</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Annual Subscription - TechStart</p>
                  <p className="text-sm text-muted-foreground">Updated 5 hours ago</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-success">$12,000</p>
                  <p className="text-xs text-muted-foreground">Proposal</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                  JD
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">John Doe</p>
                  <p className="text-sm text-muted-foreground">Can we schedule a demo?</p>
                </div>
                <span className="text-xs text-muted-foreground">5m ago</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info/10 text-info font-semibold">
                  SM
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Sarah Miller</p>
                  <p className="text-sm text-muted-foreground">Thanks for the proposal!</p>
                </div>
                <span className="text-xs text-muted-foreground">1h ago</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}