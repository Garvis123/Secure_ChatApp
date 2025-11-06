import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Users, 
  MessageCircle, 
  Shield, 
  AlertTriangle, 
  Activity,
  RefreshCw,
  Search,
  TrendingUp,
  Clock
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../utils/api';

const AdminDashboard = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, logsRes, anomaliesRes] = await Promise.all([
        apiClient.getDashboardStats(),
        apiClient.getAuditLogs({ limit: 50 }),
        apiClient.getAnomalies({ limit: 20 })
      ]);

      setStats(statsRes.data);
      setAuditLogs(logsRes.data.logs || []);
      setAnomalies(anomaliesRes.data.anomalies || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const filteredLogs = auditLogs.filter(log =>
    log.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Monitor system activity and security</p>
        </div>
        <Button onClick={fetchDashboardData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.users?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.users?.online || 0} online
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.messages?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.messages?.last24h || 0} in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rooms</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.rooms?.active || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.rooms?.total || 0} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anomalies Detected</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{anomalies.length}</div>
            <p className="text-xs text-muted-foreground">
              {anomalies.filter(a => a.anomalies?.some(an => an.severity === 'critical')).length} critical
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="audit" className="space-y-4">
        <TabsList>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
          <TabsTrigger value="system">System Health</TabsTrigger>
        </TabsList>

        {/* Audit Logs Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Logs</CardTitle>
              <CardDescription>Recent user activities and system events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{log.username || 'Unknown'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.type}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.metadata?.roomName || 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Anomalies</CardTitle>
              <CardDescription>Detected suspicious activities and potential threats</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {anomalies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No anomalies detected
                        </TableCell>
                      </TableRow>
                    ) : (
                      anomalies.map((anomaly, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{anomaly.username || 'Unknown'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{anomaly.type}</Badge>
                          </TableCell>
                          <TableCell>
                            {anomaly.anomalies?.map((a, i) => (
                              <Badge
                                key={i}
                                variant={getSeverityColor(a.severity)}
                                className="mr-1"
                              >
                                {a.severity}
                              </Badge>
                            ))}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {anomaly.anomalies?.[0]?.details || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {new Date(anomaly.timestamp).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Health Tab */}
        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>Current system status and metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Database</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    Connected
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Active Sessions</span>
                  <span className="text-sm">{stats?.sessions?.active || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">System Uptime</span>
                  <span className="text-sm">Running</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;

