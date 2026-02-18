import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Calendar, 
  CheckCircle, 
  CalendarCheck, 
  TrendingUp, 
  Plus, 
  Download,
  DoorOpen,
  Users,
  Clock
} from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import AdvancedBookingForm from "@/components/AdvancedBookingForm";

interface DashboardStats {
  totalRooms: number;
  availableRooms: number;
  bookedToday: number;
  weeklyBookings: number;
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  const { data: recentBookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['/api/bookings'],
    select: (data: any[]) => data.slice(0, 5), // Show only 5 recent bookings
  });

  if (statsLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Total Rooms</p>
                <p className="text-3xl font-bold text-gray-800 dark:text-white">{stats?.totalRooms || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <DoorOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Available Now</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats?.availableRooms || 0}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Booked Today</p>
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{stats?.bookedToday || 0}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
                <CalendarCheck className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">This Week</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats?.weeklyBookings || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Room Utilization Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Room Utilization</CardTitle>
              <div className="flex space-x-2">
                <Button variant="default" size="sm">Week</Button>
                <Button variant="outline" size="sm">Month</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-gray-50 dark:bg-slate-800/50 rounded-lg flex items-center justify-center">
              <div className="w-full h-full relative">
                <div className="absolute bottom-0 left-0 w-full h-full flex items-end justify-around px-4">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, index) => (
                    <div key={day} className="flex flex-col items-center">
                      <div 
                        className="w-8 bg-primary rounded-t" 
                        style={{ height: `${[60, 80, 45, 70, 90][index]}%` }}
                      />
                      <span className="text-xs text-gray-600 dark:text-slate-400 mt-2">{day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full" 
              onClick={() => setIsBookingModalOpen(true)}
              data-testid="button-book-room-quick"
            >
              <Plus className="w-4 h-4 mr-2" />
              Book Room
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/calendar')}
            >
              <Calendar className="w-4 h-4 mr-2" />
              View Calendar
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Bookings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Bookings</CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate('/my-bookings')}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {bookingsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
                </div>
              ))}
            </div>
          ) : recentBookings.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-slate-400">No recent bookings</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400">Room</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400">Organizer</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400">Date & Time</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map((booking: any) => (
                    <tr key={booking.id} className="border-b border-gray-100 dark:border-slate-800">
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mr-3">
                            <DoorOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 dark:text-white">{booking.room.name}</p>
                            <p className="text-sm text-gray-600 dark:text-slate-400">
                              Capacity: {booking.room.capacity}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          <Avatar className="w-8 h-8 mr-3">
                            <AvatarImage src={booking.user.profileImageUrl} />
                            <AvatarFallback>
                              {booking.user.firstName?.[0]}{booking.user.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-gray-800 dark:text-white">
                              {booking.user.firstName} {booking.user.lastName}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-slate-400">{booking.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 text-gray-400 mr-2" />
                          <div>
                            <p className="font-medium text-gray-800 dark:text-white">
                              {format(new Date(booking.startDateTime), 'MMM dd, HH:mm')}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-slate-400">
                              {format(new Date(booking.endDateTime), 'HH:mm')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge 
                          variant={booking.status === 'confirmed' ? 'default' : 'secondary'}
                          className="capitalize"
                        >
                          {booking.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Book Room Modal */}
      <Dialog open={isBookingModalOpen} onOpenChange={setIsBookingModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Room</DialogTitle>
            <DialogDescription>
              Schedule your meeting and reserve a room
            </DialogDescription>
          </DialogHeader>
          <AdvancedBookingForm onSuccess={() => setIsBookingModalOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
