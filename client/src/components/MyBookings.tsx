import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Search, 
  Edit, 
  Trash2,
  Filter,
  Download,
  Bell
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import ParticipantSelector from "@/components/ParticipantSelector";

const editBookingSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startDateTime: z.string().min(1, "Start date and time are required"),
  endDateTime: z.string().min(1, "End date and time are required"),
  roomId: z.number().min(1, "Room is required"),
  participants: z.array(z.string().email("Invalid email address")).default([]),
  repeatType: z.enum(["none", "daily", "weekly", "custom"]).default("none"),
  customDays: z.array(z.number().min(0).max(6)).default([]),
  remindMe: z.boolean().default(false),
  reminderTime: z.number().default(15),
});

type EditBookingData = z.infer<typeof editBookingSchema>;

export default function MyBookings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roomFilter, setRoomFilter] = useState("all");
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<number | null>(null);
  const [roomAvailability, setRoomAvailability] = useState<Array<{
    id: number;
    name: string;
    capacity: number;
    description: string;
    equipment: string[];
    available: boolean;
    conflictReason: string | null;
  }>>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['/api/bookings/my'],
    refetchOnMount: 'always',
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['/api/rooms'],
  });

  const form = useForm<EditBookingData>({
    resolver: zodResolver(editBookingSchema),
    defaultValues: {
      title: "",
      description: "",
      startDateTime: "",
      endDateTime: "",
      roomId: 1,
      participants: [],
      repeatType: "none",
      customDays: [],
      remindMe: false,
      reminderTime: 15,
    },
  });

  const updateBookingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: EditBookingData }) => {
      const response = await apiRequest(`/api/bookings/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Booking updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings/my'] });
      setIsEditModalOpen(false);
      setEditingBooking(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteBookingMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/bookings/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Booking deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings/my'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredBookings = bookings.filter((booking: any) => {
    const matchesSearch = booking.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.room.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
    const matchesRoom = roomFilter === "all" || booking.roomId.toString() === roomFilter;
    
    return matchesSearch && matchesStatus && matchesRoom;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400';
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400';
      case 'cancelled':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400';
      default:
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400';
    }
  };

  const reminderOptions = [
    { value: 5, label: "5 minutes before" },
    { value: 10, label: "10 minutes before" },
    { value: 15, label: "15 minutes before" },
    { value: 30, label: "30 minutes before" },
    { value: 60, label: "1 hour before" },
    { value: 120, label: "2 hours before" },
    { value: 1440, label: "1 day before" },
  ];

  const weekDays = [
    { value: 0, label: "Sunday" },
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
  ];

  const toggleCustomDay = (dayValue: number) => {
    const currentDays = form.getValues('customDays') || [];
    const newDays = currentDays.includes(dayValue)
      ? currentDays.filter(day => day !== dayValue)
      : [...currentDays, dayValue].sort();
    form.setValue('customDays', newDays);
  };

  const checkRoomAvailability = async (startDateTime: string, endDateTime: string, excludeBookingId?: number) => {
    if (!startDateTime || !endDateTime) {
      setRoomAvailability([]);
      return;
    }

    setCheckingAvailability(true);
    try {
      const response = await apiRequest('/api/rooms/availability', {
        method: 'POST',
        body: JSON.stringify({
          startDateTime,
          endDateTime,
          excludeBookingId: excludeBookingId?.toString(),
        }),
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setRoomAvailability(data);
      } else {
        console.error('API returned non-array response:', data);
        setRoomAvailability([]);
      }
    } catch (error) {
      console.error('Error checking room availability:', error);
      setRoomAvailability([]);
    } finally {
      setCheckingAvailability(false);
    }
  };

  useEffect(() => {
    if (editingBooking) {
      const subscription = form.watch((value, { name }) => {
        if (name === 'startDateTime' || name === 'endDateTime') {
          if (value.startDateTime && value.endDateTime) {
            checkRoomAvailability(value.startDateTime, value.endDateTime, editingBooking.id);
          }
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [form, editingBooking]);

  const handleDeleteBooking = (id: number) => {
    setBookingToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (bookingToDelete !== null) {
      deleteBookingMutation.mutate(bookingToDelete);
      setIsDeleteDialogOpen(false);
      setBookingToDelete(null);
    }
  };

  const handleEditBooking = async (booking: any) => {
    setEditingBooking(booking);
    // Format dates for datetime-local input
    const startDate = new Date(booking.startDateTime);
    const endDate = new Date(booking.endDateTime);
    
    const startDateTimeStr = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}-${startDate.getDate().toString().padStart(2, '0')}T${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
    const endDateTimeStr = `${endDate.getFullYear()}-${(endDate.getMonth() + 1).toString().padStart(2, '0')}-${endDate.getDate().toString().padStart(2, '0')}T${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
    
    form.reset({
      title: booking.title,
      description: booking.description || "",
      startDateTime: startDateTimeStr,
      endDateTime: endDateTimeStr,
      roomId: booking.roomId,
      participants: booking.participants || [],
      repeatType: booking.repeatType || "none",
      customDays: booking.customDays || [],
      remindMe: booking.remindMe || false,
      reminderTime: booking.reminderTime || 15,
    });
    
    // Check room availability for the current booking time before opening modal
    await checkRoomAvailability(startDateTimeStr, endDateTimeStr, booking.id);
    setIsEditModalOpen(true);
  };

  const onEditSubmit = (data: EditBookingData) => {
    if (editingBooking) {
      updateBookingMutation.mutate({
        id: editingBooking.id,
        data: {
          ...data,
          startDateTime: data.startDateTime,
          endDateTime: data.endDateTime,
        }
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>My Bookings</span>
          </CardTitle>
          <p className="text-gray-600 dark:text-slate-400">
            Manage your current and upcoming bookings
          </p>
        </CardHeader>
        <CardContent>
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <Input
                  placeholder="Search bookings..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roomFilter} onValueChange={setRoomFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Room" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rooms</SelectItem>
                {rooms.map((room: any) => (
                  <SelectItem key={room.id} value={room.id.toString()}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          {/* Bookings List */}
          {filteredBookings.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-slate-400">
                {searchTerm || statusFilter !== "all" || roomFilter !== "all" 
                  ? "No bookings match your filters"
                  : "No bookings found"
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map((booking: any) => (
                <Card key={booking.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                            {booking.title}
                          </h3>
                          <Badge className={getStatusColor(booking.status)}>
                            {booking.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-slate-400">
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4" />
                            <span>{booking.room.name} (Capacity: {booking.room.capacity})</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4" />
                            <span>
                              {format(new Date(booking.startDateTime), 'MMM dd, yyyy HH:mm')} - 
                              {format(new Date(booking.endDateTime), 'HH:mm')}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4" />
                            <span>
                              Duration: {Math.round((new Date(booking.endDateTime).getTime() - new Date(booking.startDateTime).getTime()) / (1000 * 60 * 60))} hours
                            </span>
                          </div>
                        </div>

                        {booking.description && (
                          <p className="mt-3 text-sm text-gray-600 dark:text-slate-400">
                            {booking.description}
                          </p>
                        )}

                        {booking.equipment && booking.equipment.length > 0 && (
                          <div className="mt-3">
                            <div className="flex flex-wrap gap-2">
                              {booking.room.equipment.map((item: string, index: number) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={booking.status === 'cancelled'}
                          onClick={() => handleEditBooking(booking)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteBooking(booking.id)}
                          disabled={deleteBookingMutation.isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Booking Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Booking</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title *</Label>
                <Input
                  id="edit-title"
                  placeholder="Enter booking title"
                  {...form.register('title')}
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-red-600">{form.formState.errors.title.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-room">Room *</Label>
                <Select value={form.watch('roomId')?.toString()} onValueChange={(value) => form.setValue('roomId', parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a room" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const currentRoomId = form.watch('roomId');
                      if (roomAvailability.length > 0) {
                        // Get available rooms
                        const availableRooms = roomAvailability.filter(room => room.available);
                        // Always include the currently selected room even if not available
                        const currentRoom = roomAvailability.find(room => room.id === currentRoomId);
                        const roomsToShow = currentRoom && !currentRoom.available 
                          ? [...availableRooms, currentRoom]
                          : availableRooms;
                        return roomsToShow.map((room: any) => (
                          <SelectItem key={room.id} value={room.id.toString()}>
                            {room.name} (Capacity: {room.capacity}) {!room.available ? '(Currently selected - unavailable)' : ''}
                          </SelectItem>
                        ));
                      }
                      return rooms.map((room: any) => (
                        <SelectItem key={room.id} value={room.id.toString()}>
                          {room.name} (Capacity: {room.capacity})
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
                {checkingAvailability && (
                  <p className="text-sm text-blue-600">Checking availability...</p>
                )}
                {roomAvailability.length > 0 && !checkingAvailability && (
                  <p className="text-sm text-gray-600">
                    Showing {roomAvailability.filter(r => r.available).length} available room(s) for selected time
                  </p>
                )}
                {form.formState.errors.roomId && (
                  <p className="text-sm text-red-600">{form.formState.errors.roomId.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="edit-start">Start Date & Time *</Label>
                <Input
                  id="edit-start"
                  type="datetime-local"
                  {...form.register('startDateTime')}
                />
                {form.formState.errors.startDateTime && (
                  <p className="text-sm text-red-600">{form.formState.errors.startDateTime.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end">End Date & Time *</Label>
                <Input
                  id="edit-end"
                  type="datetime-local"
                  {...form.register('endDateTime')}
                />
                {form.formState.errors.endDateTime && (
                  <p className="text-sm text-red-600">{form.formState.errors.endDateTime.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Enter booking description..."
                {...form.register('description')}
              />
            </div>

            <ParticipantSelector
              participants={form.watch('participants') || []}
              onParticipantsChange={(participants) => form.setValue('participants', participants)}
            />

            {/* Repeat Options */}
            <div className="space-y-2">
              <Label>Repeat</Label>
              <Select 
                value={form.watch('repeatType')} 
                onValueChange={(value) => form.setValue('repeatType', value as any)}
              >
                <SelectTrigger data-testid="select-repeat-type">
                  <SelectValue placeholder="Does not repeat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Does not repeat</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              
              {form.watch('repeatType') === 'custom' && (
                <div className="mt-3">
                  <Label>Select Days</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {weekDays.map((day) => (
                      <Button
                        key={day.value}
                        type="button"
                        variant={(form.watch('customDays') || []).includes(day.value) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleCustomDay(day.value)}
                        data-testid={`button-day-${day.label.toLowerCase()}`}
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Remind Me */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remindMe"
                  checked={form.watch('remindMe')}
                  onCheckedChange={(checked) => form.setValue('remindMe', !!checked)}
                  data-testid="checkbox-remind-me"
                />
                <Label htmlFor="remindMe" className="flex items-center space-x-2">
                  <Bell className="w-4 h-4" />
                  <span>Remind me</span>
                </Label>
              </div>
              {form.watch('remindMe') && (
                <Select 
                  value={form.watch('reminderTime')?.toString()} 
                  onValueChange={(value) => form.setValue('reminderTime', parseInt(value))}
                >
                  <SelectTrigger data-testid="select-reminder-time">
                    <SelectValue placeholder="Select reminder time" />
                  </SelectTrigger>
                  <SelectContent>
                    {reminderOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={updateBookingMutation.isPending} data-testid="button-book-room">
                {updateBookingMutation.isPending ? 'Updating...' : 'Book Room'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this booking? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
