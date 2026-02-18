import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  PieChart as PieChartIcon,
  Download,
  Calendar,
  Clock,
  Users,
  DoorOpen,
  Filter
} from "lucide-react";

type AnalyticsData = {
  summary: {
    totalBookings: number;
    totalBookingsChange: number;
    uniqueUsers: number;
    uniqueUsersChange: number;
    averageBookingDuration: number;
    averageBookingDurationChange: number;
    peakUtilization: number;
    peakUtilizationChange: number;
  };
  bookingTrends: Array<{ date: string; bookings: number; duration: number }>;
  roomUtilization: Array<{ name: string; bookings: number; utilization: number; hours: number }>;
  timeDistribution: Array<{ hour: number; bookings: number }>;
  userActivity: Array<{ name: string; bookings: number; hours: number }>;
  bookingStatus: Array<{ name: string; value: number; color: string }>;
};

export default function Analytics() {
  const [dateRange, setDateRange] = useState("7d");
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [utilizationView, setUtilizationView] = useState<"day" | "week" | "month">("week");

  const { data: analyticsData, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics', { dateRange, roomId: selectedRoom, utilizationView }],
    retry: false,
  });

  const { data: rooms = [] } = useQuery<any[]>({
    queryKey: ['/api/rooms'],
    retry: false,
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  // Mock data for demonstration
  const mockData = {
    summary: {
      totalBookings: 245,
      totalBookingsChange: 12.5,
      uniqueUsers: 89,
      uniqueUsersChange: 8.2,
      averageBookingDuration: 2.3,
      averageBookingDurationChange: -5.1,
      peakUtilization: 87,
      peakUtilizationChange: 15.3,
    },
    bookingTrends: [
      { date: '2024-01-01', bookings: 12, duration: 2.1 },
      { date: '2024-01-02', bookings: 15, duration: 2.4 },
      { date: '2024-01-03', bookings: 18, duration: 2.0 },
      { date: '2024-01-04', bookings: 22, duration: 2.6 },
      { date: '2024-01-05', bookings: 19, duration: 2.2 },
      { date: '2024-01-06', bookings: 16, duration: 2.3 },
      { date: '2024-01-07', bookings: 21, duration: 2.5 },
    ],
    roomUtilization: [
      { name: 'Conference Room A', bookings: 45, utilization: 78, hours: 96 },
      { name: 'Meeting Room B', bookings: 38, utilization: 65, hours: 82 },
      { name: 'Board Room', bookings: 22, utilization: 45, hours: 54 },
      { name: 'Training Room', bookings: 31, utilization: 58, hours: 71 },
    ],
    timeDistribution: [
      { hour: 8, bookings: 5 },
      { hour: 9, bookings: 12 },
      { hour: 10, bookings: 18 },
      { hour: 11, bookings: 22 },
      { hour: 12, bookings: 15 },
      { hour: 13, bookings: 8 },
      { hour: 14, bookings: 25 },
      { hour: 15, bookings: 20 },
      { hour: 16, bookings: 18 },
      { hour: 17, bookings: 14 },
      { hour: 18, bookings: 8 },
    ],
    userActivity: [
      { name: 'John Doe', bookings: 15, hours: 32 },
      { name: 'Jane Smith', bookings: 12, hours: 28 },
      { name: 'Mike Johnson', bookings: 10, hours: 25 },
      { name: 'Sarah Wilson', bookings: 8, hours: 18 },
      { name: 'David Brown', bookings: 7, hours: 16 },
    ],
    bookingStatus: [
      { name: 'Confirmed', value: 185, color: '#00C49F' },
      { name: 'Pending', value: 42, color: '#FFBB28' },
      { name: 'Cancelled', value: 18, color: '#FF8042' },
    ],
  };

  const data = analyticsData || mockData;

  const formatChange = (value: number) => {
    const isPositive = value > 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const color = isPositive ? 'text-green-600' : 'text-red-600';
    
    return (
      <div className={`flex items-center space-x-1 ${color}`}>
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{Math.abs(value)}%</span>
      </div>
    );
  };

  const exportData = () => {
    const csvData = [
      ['Date', 'Bookings', 'Duration'],
      ...data.bookingTrends.map(item => [item.date, item.bookings, item.duration])
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booking-analytics-${dateRange}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics & Reports</h1>
          <p className="text-gray-600 dark:text-slate-400">
            Advanced insights into room booking patterns and usage
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32" data-testid="select-date-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d" data-testid="select-date-range-7d">Last 7 days</SelectItem>
              <SelectItem value="30d" data-testid="select-date-range-30d">Last 30 days</SelectItem>
              <SelectItem value="90d" data-testid="select-date-range-90d">Last 90 days</SelectItem>
              <SelectItem value="365d" data-testid="select-date-range-365d">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedRoom} onValueChange={setSelectedRoom}>
            <SelectTrigger className="w-40" data-testid="select-room-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="select-room-all">All Rooms</SelectItem>
              {rooms.map((room: any) => (
                <SelectItem key={room.id} value={room.id.toString()} data-testid={`select-room-${room.id}`}>
                  {room.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={exportData} variant="outline" data-testid="button-export-data">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.summary.totalBookings}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-500 dark:text-slate-400">vs last period</span>
              {formatChange(data.summary.totalBookingsChange)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Unique Users</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.summary.uniqueUsers}</p>
              </div>
              <Users className="w-8 h-8 text-green-500" />
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-500 dark:text-slate-400">vs last period</span>
              {formatChange(data.summary.uniqueUsersChange)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Avg Duration</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.summary.averageBookingDuration}h</p>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-500 dark:text-slate-400">vs last period</span>
              {formatChange(data.summary.averageBookingDurationChange)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Peak Utilization</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.summary.peakUtilization}%</p>
              </div>
              <DoorOpen className="w-8 h-8 text-purple-500" />
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-500 dark:text-slate-400">vs last period</span>
              {formatChange(data.summary.peakUtilizationChange)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends" data-testid="tab-booking-trends">Booking Trends</TabsTrigger>
          <TabsTrigger value="rooms" data-testid="tab-room-analysis">Room Analysis</TabsTrigger>
          <TabsTrigger value="time" data-testid="tab-time-distribution">Time Distribution</TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-user-activity">User Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Booking Volume</CardTitle>
                <CardDescription>Daily booking counts over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.bookingTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="bookings" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Booking Status</CardTitle>
                <CardDescription>Distribution of booking statuses</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.bookingStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {data.bookingStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rooms" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Room Utilization</CardTitle>
                  <CardDescription>Booking volume and utilization by room</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant={utilizationView === "day" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUtilizationView("day")}
                    data-testid="button-utilization-day"
                  >
                    Day
                  </Button>
                  <Button
                    variant={utilizationView === "week" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUtilizationView("week")}
                    data-testid="button-utilization-week"
                  >
                    Week
                  </Button>
                  <Button
                    variant={utilizationView === "month" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUtilizationView("month")}
                    data-testid="button-utilization-month"
                  >
                    Month
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 text-sm text-gray-600 dark:text-slate-400">
                Viewing: <span className="font-medium capitalize">{utilizationView}ly</span> utilization data
              </div>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={data.roomUtilization}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-slate-700" />
                  <XAxis 
                    dataKey="name" 
                    className="text-gray-600 dark:text-slate-400"
                    angle={-15}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis className="text-gray-600 dark:text-slate-400" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'var(--background)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="bookings" fill="#3b82f6" name="Bookings" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="utilization" fill="#10b981" name="Utilization %" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="p-3 border border-gray-200 dark:border-slate-700 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span className="text-sm text-gray-600 dark:text-slate-400">Total Bookings</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    {data.roomUtilization.reduce((sum, room) => sum + room.bookings, 0)}
                  </p>
                </div>
                <div className="p-3 border border-gray-200 dark:border-slate-700 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span className="text-sm text-gray-600 dark:text-slate-400">Avg Utilization</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    {Math.round(data.roomUtilization.reduce((sum, room) => sum + room.utilization, 0) / data.roomUtilization.length)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Hourly Distribution</CardTitle>
              <CardDescription>Booking patterns by hour of day</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={data.timeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="bookings" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Users</CardTitle>
              <CardDescription>Most active users by booking count</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.userActivity.map((user, index) => (
                  <div key={user.name} className="flex items-center justify-between p-3 border border-gray-200 dark:border-slate-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                          {index + 1}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{user.name}</p>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          {user.hours} hours total
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {user.bookings} bookings
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}