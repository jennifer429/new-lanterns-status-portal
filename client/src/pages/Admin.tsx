/**
 * Admin Dashboard - View and access all client portals with metrics
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ExternalLink, Building2, Calendar, CheckCircle2, Clock, Users, TrendingUp, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Admin() {
  const { data: metrics, isLoading } = trpc.organizations.getMetrics.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-purple-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-purple-950">
      {/* Header */}
      <header className="border-b border-purple-500/20 bg-black/20 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/images/flame-icon.png" alt="New Lantern" className="h-10 w-10" />
              <div>
                <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-sm text-purple-300 mt-1">PACS Implementation Portal</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">
        <Card className="border-purple-500/20 bg-black/40 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white text-xl">Client Portals</CardTitle>
            <CardDescription className="text-gray-300">
              Access implementation portals for all active clients
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {metrics?.map((org) => (
                <Card
                  key={org.id}
                  className="border-purple-500/30 bg-purple-950/20 hover:bg-purple-950/40 transition-colors"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-purple-400" />
                        <CardTitle className="text-white text-base">{org.name}</CardTitle>
                      </div>
                      {org.status === "active" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-400" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Completion Percentage */}
                      <div className="flex items-center gap-2 text-sm">
                        <TrendingUp className="w-4 h-4 text-purple-400" />
                        <div>
                          <div className="text-white font-semibold">{org.completionPercentage}%</div>
                          <div className="text-xs text-gray-400">Complete</div>
                        </div>
                      </div>

                      {/* User Count */}
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-purple-400" />
                        <div>
                          <div className="text-white font-semibold">{org.userCount}</div>
                          <div className="text-xs text-gray-400">Users</div>
                        </div>
                      </div>
                    </div>

                    {/* Last Login */}
                    <div className="flex items-center gap-2 text-xs text-gray-300 border-t border-purple-500/20 pt-2">
                      <Activity className="w-3 h-3 text-purple-400" />
                      <span>
                        Last login: {org.lastLoginAt 
                          ? formatDistanceToNow(new Date(org.lastLoginAt), { addSuffix: true })
                          : "Never"}
                      </span>
                    </div>

                    {/* Goal Date */}
                    <div className="text-sm text-gray-300 flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-purple-400" />
                      <span>Goal: {org.goalDate || "Not set"}</span>
                    </div>

                    {/* Open Portal Button */}
                    <Link href={`/org/${org.slug}`}>
                      <Button
                        className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white"
                        size="sm"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open Portal
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>

            {(!metrics || metrics.length === 0) && (
              <div className="text-center py-12 text-gray-400">
                No client portals found
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
