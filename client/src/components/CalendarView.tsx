import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Users,
  Monitor,
  Wifi,
  Video,
  Phone,
  Coffee,
  Projector,
  Filter,
  ArrowLeft,
  ArrowRight,
  X,
  Plus,
  Bell,
  Clock
} from "lucide-react";
import { format, addDays, subDays, isToday, startOfDay, endOfDay } from "date-fns";
import ParticipantSelector from "./ParticipantSelector";

interface Room {
  id: number;
  name: string;
  capacity: number;
  description: string | null;
  equipment: string[];
  imageUrl: string | null;
  isActive: boolean;
}

interface Booking {
  id: number;
  title: string;
  description: string | null;
  roomId: number;
  userId: string;
  startDateTime: string;
  endDateTime: string;
  status: string;
  participants?: string[];
  repeatType?: string;
  customDays?: number[];
  room: Room;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

const bookingFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startDateTime: z.string().min(1, "Start date and time is required"),
  endDateTime: z.string().min(1, "End date and time is required"),
  roomId: z.number(),
  participants: z.array(z.string().email("Invalid email address")).default([]),
  repeatType: z.enum(["none", "daily", "weekly", "custom"]).default("none"),
  customDays: z.array(z.number().min(0).max(6)).default([]),
  remindMe: z.boolean().default(false),
  reminderTime: z.number().default(15),
});

type BookingFormData = z.infer<typeof bookingFormSchema>;

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

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [capacityFilter, setCapacityFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ roomId: number; roomName: string; hour: number } | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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
  const timelineRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const { data: rooms = [], isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ['/api/rooms'],
    refetchOnMount: 'always',
  });

  const { data: rawBookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ['/api/bookings'],
    refetchOnMount: 'always',
  });

  // Expand repeating bookings into multiple instances
  const bookings = useMemo(() => {
    const expanded: Booking[] = [];
    const today = startOfDay(new Date());
    const daysToExpand = 60; // Expand 60 days forward

    rawBookings.forEach(booking => {
      const bookingStart = new Date(booking.startDateTime);
      const bookingEnd = new Date(booking.endDateTime);
      const duration = bookingEnd.getTime() - bookingStart.getTime();

      if (!booking.repeatType || booking.repeatType === 'none') {
        // No repeat - add as is
        expanded.push(booking);
      } else if (booking.repeatType === 'daily') {
        // Daily repeat - create instance for each day
        for (let i = 0; i < daysToExpand; i++) {
          const instanceStart = addDays(bookingStart, i);
          const instanceEnd = new Date(instanceStart.getTime() + duration);
          expanded.push({
            ...booking,
            id: booking.id + i * 100000, // Virtual ID to avoid conflicts
            startDateTime: instanceStart.toISOString(),
            endDateTime: instanceEnd.toISOString(),
          });
        }
      } else if (booking.repeatType === 'weekly') {
        // Weekly repeat - create instance for same day each week
        for (let i = 0; i < Math.ceil(daysToExpand / 7); i++) {
          const instanceStart = addDays(bookingStart, i * 7);
          const instanceEnd = new Date(instanceStart.getTime() + duration);
          expanded.push({
            ...booking,
            id: booking.id + i * 100000, // Virtual ID to avoid conflicts
            startDateTime: instanceStart.toISOString(),
            endDateTime: instanceEnd.toISOString(),
          });
        }
      } else if (booking.repeatType === 'custom' && booking.customDays && booking.customDays.length > 0) {
        // Custom days repeat - create instance for selected weekdays
        for (let i = 0; i < daysToExpand; i++) {
          const instanceStart = addDays(bookingStart, i);
          const dayOfWeek = instanceStart.getDay(); // 0 = Sunday, 6 = Saturday
          
          if (booking.customDays.includes(dayOfWeek)) {
            const instanceEnd = new Date(instanceStart.getTime() + duration);
            expanded.push({
              ...booking,
              id: booking.id + i * 100000, // Virtual ID to avoid conflicts
              startDateTime: instanceStart.toISOString(),
              endDateTime: instanceEnd.toISOString(),
            });
          }
        }
      }
    });

    return expanded;
  }, [rawBookings]);

  const timeSlots = Array.from({ length: 24 }, (_, i) => i);

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      title: "",
      description: "",
      startDateTime: "",
      endDateTime: "",
      roomId: 0,
      participants: [],
      repeatType: "none",
      customDays: [],
      remindMe: false,
      reminderTime: 15,
    },
  });

  const editForm = useForm<EditBookingData>({
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
    { value: 0, label: "Sun" },
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
  ];


  const toggleCustomDay = (dayValue: number) => {
    const currentDays = form.getValues('customDays') || [];
    const newDays = currentDays.includes(dayValue)
      ? currentDays.filter(day => day !== dayValue)
      : [...currentDays, dayValue].sort();
    form.setValue('customDays', newDays);
  };

  const bookingMutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      return await apiRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      toast({
        title: "Success",
        description: "Room booked successfully!",
      });
      setBookingDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to book room",
        variant: "destructive",
      });
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
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
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

  const handleEditBooking = async (booking: Booking) => {
    const user = currentUser as any;
    if (!user || booking.userId !== user.id) {
      toast({
        title: "Unauthorized",
        description: "You can only edit your own bookings",
        variant: "destructive",
      });
      return;
    }

    const actualBookingId = booking.id > 100000 ? booking.id % 100000 : booking.id;

    setEditingBooking(booking);
    const startDate = new Date(booking.startDateTime);
    const endDate = new Date(booking.endDateTime);
    
    const startDateTimeStr = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}-${startDate.getDate().toString().padStart(2, '0')}T${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
    const endDateTimeStr = `${endDate.getFullYear()}-${(endDate.getMonth() + 1).toString().padStart(2, '0')}-${endDate.getDate().toString().padStart(2, '0')}T${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
    
    editForm.reset({
      title: booking.title,
      description: booking.description || "",
      startDateTime: startDateTimeStr,
      endDateTime: endDateTimeStr,
      roomId: booking.roomId,
      participants: booking.participants || [],
      repeatType: (booking.repeatType as "none" | "daily" | "weekly" | "custom") || "none",
      customDays: booking.customDays || [],
      remindMe: (booking as any).remindMe || false,
      reminderTime: (booking as any).reminderTime || 15,
    });
    
    await checkRoomAvailability(startDateTimeStr, endDateTimeStr, actualBookingId);
    setIsEditModalOpen(true);
  };

  const onEditSubmit = (data: EditBookingData) => {
    if (editingBooking) {
      const actualBookingId = editingBooking.id > 100000 ? editingBooking.id % 100000 : editingBooking.id;
      updateBookingMutation.mutate({
        id: actualBookingId,
        data: {
          ...data,
          startDateTime: data.startDateTime,
          endDateTime: data.endDateTime,
        }
      });
    }
  };


  const toggleEditCustomDay = (dayValue: number) => {
    const currentDays = editForm.getValues('customDays') || [];
    const newDays = currentDays.includes(dayValue)
      ? currentDays.filter(day => day !== dayValue)
      : [...currentDays, dayValue].sort();
    editForm.setValue('customDays', newDays);
  };

  const canSeeFullDetails = (booking: Booking) => {
    if (!currentUser) return false;
    
    const user = currentUser as any;
    if (booking.userId === user.id) return true;
    
    if (booking.participants && Array.isArray(booking.participants)) {
      const userEmail = (user.email || '').toLowerCase().trim();
      return booking.participants.some((email: string) => 
        email.toLowerCase().trim() === userEmail
      );
    }
    
    return false;
  };

  const getBookingDisplayInfo = (booking: Booking) => {
    if (canSeeFullDetails(booking)) {
      return {
        title: booking.title,
        subtitle: `${booking.user.firstName || ''} ${booking.user.lastName || ''}`.trim() || booking.user.email,
      };
    } else {
      const organizerName = `${booking.user.firstName || ''} ${booking.user.lastName || ''}`.trim() || booking.user.email;
      return {
        title: 'Booked',
        subtitle: organizerName,
      };
    }
  };

  const isSlotFullyBooked = (roomId: number, hour: number) => {
    const roomBookings = getBookingsForRoomAndTime(roomId, hour);
    
    if (roomBookings.length === 0) return false;
    
    const dayStart = startOfDay(currentDate);
    const slotStart = new Date(dayStart);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(dayStart);
    slotEnd.setHours(hour + 1, 0, 0, 0);
    
    const slotStartTime = slotStart.getTime();
    const slotEndTime = slotEnd.getTime();
    
    const intervals: Array<{ start: number; end: number }> = roomBookings.map((booking) => {
      const bookingStart = new Date(booking.startDateTime).getTime();
      const bookingEnd = new Date(booking.endDateTime).getTime();
      
      return {
        start: Math.max(bookingStart, slotStartTime),
        end: Math.min(bookingEnd, slotEndTime),
      };
    });
    
    intervals.sort((a, b) => a.start - b.start);
    
    const mergedIntervals: Array<{ start: number; end: number }> = [];
    for (const interval of intervals) {
      if (mergedIntervals.length === 0 || mergedIntervals[mergedIntervals.length - 1].end < interval.start) {
        mergedIntervals.push(interval);
      } else {
        mergedIntervals[mergedIntervals.length - 1].end = Math.max(
          mergedIntervals[mergedIntervals.length - 1].end,
          interval.end
        );
      }
    }
    
    const totalCoveredTime = mergedIntervals.reduce((total, interval) => {
      return total + (interval.end - interval.start);
    }, 0);
    
    const slotDuration = slotEndTime - slotStartTime;
    
    return totalCoveredTime >= slotDuration;
  };

  const handleSlotClick = (roomId: number, roomName: string, hour: number) => {
    if (isSlotFullyBooked(roomId, hour)) {
      toast({
        title: "Room Unavailable",
        description: "This time slot is already booked. Please choose a different time or room.",
        variant: "destructive",
      });
      return;
    }

    const startDate = new Date(currentDate);
    startDate.setHours(hour, 0, 0, 0);
    const endDate = new Date(currentDate);
    endDate.setHours(hour + 1, 0, 0, 0);

    // Format datetime for datetime-local input (YYYY-MM-DDTHH:mm)
    const formatDateTimeLocal = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    setSelectedSlot({ roomId, roomName, hour });
    form.reset({
      title: "",
      description: "",
      roomId: roomId,
      startDateTime: formatDateTimeLocal(startDate),
      endDateTime: formatDateTimeLocal(endDate),
      participants: [],
      repeatType: "none",
      customDays: [],
      remindMe: false,
      reminderTime: 15,
    });
    setBookingDialogOpen(true);
  };

  const onSubmit = (data: BookingFormData) => {
    // Convert datetime-local format to ISO format for API
    const submitData = {
      ...data,
      startDateTime: new Date(data.startDateTime).toISOString(),
      endDateTime: new Date(data.endDateTime).toISOString(),
    };
    bookingMutation.mutate(submitData);
  };

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date());
    } else if (direction === 'prev') {
      setCurrentDate(prev => subDays(prev, 1));
    } else {
      setCurrentDate(prev => addDays(prev, 1));
    }
  };

  const scrollToTime = (hour: number) => {
    if (timelineRef.current) {
      const slotWidth = 80;
      const scrollPosition = hour * slotWidth;
      timelineRef.current.scrollTo({ left: scrollPosition, behavior: 'smooth' });
    }
  };

  const scrollToCurrentTime = () => {
    if (currentTimeRef.current && timelineRef.current) {
      const scrollLeft = currentTimeRef.current.offsetLeft - timelineRef.current.offsetWidth / 2 + 40;
      timelineRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  };

  const scrollToOfficeHours = () => {
    if (timelineRef.current) {
      const officeStartHour = 9.5;
      const hourWidth = 80;
      const scrollLeft = officeStartHour * hourWidth - timelineRef.current.clientWidth / 2;
      timelineRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  };

  const scrollTimeline = (direction: 'left' | 'right') => {
    if (timelineRef.current) {
      const scrollAmount = 300;
      const scrollLeft = timelineRef.current.scrollLeft + (direction === 'right' ? scrollAmount : -scrollAmount);
      timelineRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  };

  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      const matchesCapacity = capacityFilter === "all" || 
        (capacityFilter === "small" && room.capacity <= 4) ||
        (capacityFilter === "medium" && room.capacity > 4 && room.capacity <= 10) ||
        (capacityFilter === "large" && room.capacity > 10);
      
      const matchesSearch = searchTerm === "" ||
        room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesCapacity && matchesSearch;
    });
  }, [rooms, capacityFilter, searchTerm]);

  useEffect(() => {
    if (!roomsLoading && !bookingsLoading && timelineRef.current) {
      const timer = setTimeout(() => {
        if (isToday(currentDate) && currentTimeRef.current) {
          scrollToCurrentTime();
        } else {
          scrollToOfficeHours();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentDate, roomsLoading, bookingsLoading, filteredRooms.length]);

  useEffect(() => {
    if (editingBooking) {
      const subscription = editForm.watch((value, { name }) => {
        if (name === 'startDateTime' || name === 'endDateTime') {
          if (value.startDateTime && value.endDateTime) {
            const actualBookingId = editingBooking.id > 100000 ? editingBooking.id % 100000 : editingBooking.id;
            checkRoomAvailability(value.startDateTime, value.endDateTime, actualBookingId);
          }
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [editForm, editingBooking]);

  const getBookingsForRoomAndTime = (roomId: number, hour: number) => {
    const dayStart = startOfDay(currentDate);
    const slotStart = new Date(dayStart);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(dayStart);
    slotEnd.setHours(hour + 1, 0, 0, 0);

    return bookings.filter((booking) => {
      if (booking.roomId !== roomId) return false;
      if (booking.status === 'cancelled') return false;

      const bookingStart = new Date(booking.startDateTime);
      const bookingEnd = new Date(booking.endDateTime);

      return (
        (bookingStart < slotEnd && bookingEnd > slotStart)
      );
    });
  };

  const getEquipmentIcon = (equipment: string) => {
    const eq = equipment.toLowerCase();
    if (eq.includes('projector') || eq.includes('screen')) return <Projector className="w-3 h-3" />;
    if (eq.includes('video') || eq.includes('camera')) return <Video className="w-3 h-3" />;
    if (eq.includes('phone') || eq.includes('telephone')) return <Phone className="w-3 h-3" />;
    if (eq.includes('whiteboard') || eq.includes('board')) return <Monitor className="w-3 h-3" />;
    if (eq.includes('wifi') || eq.includes('internet')) return <Wifi className="w-3 h-3" />;
    if (eq.includes('coffee') || eq.includes('refreshment')) return <Coffee className="w-3 h-3" />;
    return <Monitor className="w-3 h-3" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-500/80 hover:bg-blue-600/80 dark:bg-blue-600/80 dark:hover:bg-blue-700/80';
      case 'pending':
        return 'bg-amber-500/80 hover:bg-amber-600/80 dark:bg-amber-600/80 dark:hover:bg-amber-700/80';
      default:
        return 'bg-gray-500/80 hover:bg-gray-600/80 dark:bg-gray-600/80 dark:hover:bg-gray-700/80';
    }
  };

  const calculateBookingPosition = (booking: Booking) => {
    const bookingStart = new Date(booking.startDateTime);
    const bookingEnd = new Date(booking.endDateTime);
    const dayStart = startOfDay(currentDate);
    
    const startHour = bookingStart.getHours();
    const endHour = bookingEnd.getHours();
    const startMinutes = bookingStart.getMinutes();
    const endMinutes = bookingEnd.getMinutes();
    
    const startOffsetInHour = (startMinutes / 60) * 100;
    const totalDurationInMinutes = (bookingEnd.getTime() - bookingStart.getTime()) / (60 * 1000);
    const totalWidthInHours = totalDurationInMinutes / 60;
    const totalWidthPercentage = totalWidthInHours * 100;
    
    return { 
      startHour, 
      endHour,
      left: startOffsetInHour,
      width: totalWidthPercentage
    };
  };

  const shouldRenderBooking = (booking: Booking, hour: number) => {
    const bookingStart = new Date(booking.startDateTime);
    const bookingStartHour = bookingStart.getHours();
    return bookingStartHour === hour || 
      (bookingStartHour < hour && hour === 0) ||
      (bookingStart < startOfDay(currentDate) && hour === 0);
  };

  if (roomsLoading || bookingsLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded mb-4"></div>
              <div className="h-96 bg-slate-200 dark:bg-slate-700 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Room Scheduler</span>
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigateDate('prev')}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="ml-1">Previous Day</span>
                </Button>
                <Button 
                  variant={isToday(currentDate) ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => navigateDate('today')}
                >
                  Today
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigateDate('next')}
                >
                  <span className="mr-1">Next Day</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-lg font-semibold">
                  {format(currentDate, 'EEEE, MMMM d, yyyy')}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Search rooms..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-48"
                />
                <Select value={capacityFilter} onValueChange={setCapacityFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Capacity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Capacities</SelectItem>
                    <SelectItem value="small">Small (1-4)</SelectItem>
                    <SelectItem value="medium">Medium (5-10)</SelectItem>
                    <SelectItem value="large">Large (11+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center justify-between border-t border-gray-200 dark:border-slate-700 pt-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Quick Time Jump:</span>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => scrollToTime(9)}
                  data-testid="button-scroll-morning"
                >
                  9 AM
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => scrollToTime(12)}
                  data-testid="button-scroll-noon"
                >
                  12 PM
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => scrollToTime(14)}
                  data-testid="button-scroll-afternoon"
                >
                  2 PM
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => scrollToTime(17)}
                  data-testid="button-scroll-evening"
                >
                  5 PM
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-y-auto scrollbar-visible max-h-[600px]">
            <div className="flex relative">
              <div className="w-64 flex-shrink-0 bg-gray-50 dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 sticky left-0 z-10">
                <div className="h-12 border-b border-gray-200 dark:border-slate-700 flex items-center px-4 font-semibold text-sm">
                  Rooms
                </div>
                <div>
                  {filteredRooms.map((room) => (
                    <div 
                      key={room.id} 
                      className="h-20 border-b border-gray-200 dark:border-slate-700 p-3 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors flex flex-col justify-center"
                    >
                      <div className="font-medium text-sm">{room.name}</div>
                      <div className="flex items-center space-x-2 mt-1 text-xs text-gray-600 dark:text-slate-400">
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <Users className="w-3 h-3" />
                          <span>{room.capacity}</span>
                        </div>
                        {room.equipment && room.equipment.length > 0 && (
                          <>
                            <span className="flex-shrink-0">•</span>
                            <span className="whitespace-normal break-words leading-tight">
                              {room.equipment.join(', ')}
                            </span>
                          </>
                        )}
                      </div>
                      {room.description && (
                        <div className="text-xs text-gray-500 dark:text-slate-500 truncate mt-1">
                          {room.description}
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredRooms.length === 0 && (
                    <div className="p-8 text-center text-gray-500 dark:text-slate-400 text-sm">
                      No rooms match your filters
                    </div>
                  )}
                </div>
              </div>

              <div 
                className="flex-1 overflow-x-auto scrollbar-visible" 
                ref={timelineRef}
              >
                <div className="grid grid-cols-24" style={{ gridTemplateColumns: 'repeat(24, minmax(80px, 1fr))' }}>
                  {timeSlots.map((hour) => {
                    const currentHour = new Date().getHours();
                    const isCurrentHour = isToday(currentDate) && hour === currentHour;
                    return (
                      <div
                        key={hour}
                        ref={isCurrentHour ? currentTimeRef : null}
                        className={`border-r border-gray-200 dark:border-slate-700 last:border-r-0 ${isCurrentHour ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      >
                        <div className="h-12 border-b border-gray-200 dark:border-slate-700 flex items-center justify-center bg-gray-50 dark:bg-slate-800 px-2">
                          <span className={`text-xs font-medium ${isCurrentHour ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-600 dark:text-slate-400'}`}>
                            {format(new Date().setHours(hour, 0, 0, 0), 'h a')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div>
                  {filteredRooms.map((room) => (
                    <div key={room.id} className="flex">
                      <div className="grid grid-cols-24" style={{ gridTemplateColumns: 'repeat(24, minmax(80px, 1fr))' }}>
                        {timeSlots.map((hour) => {
                          const roomBookings = getBookingsForRoomAndTime(room.id, hour);
                          const currentHour = new Date().getHours();
                          const isCurrentHour = isToday(currentDate) && hour === currentHour;
                          const isBooked = isSlotFullyBooked(room.id, hour);
                          return (
                            <div
                              key={`${room.id}-${hour}`}
                              className={`h-20 border-r border-b border-gray-200 dark:border-slate-700 last:border-r-0 relative transition-colors ${
                                isBooked 
                                  ? 'bg-gray-100 dark:bg-slate-800 cursor-not-allowed' 
                                  : `cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 ${isCurrentHour ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-slate-900'}`
                              }`}
                              onClick={() => handleSlotClick(room.id, room.name, hour)}
                              data-testid={`slot-${room.id}-${hour}`}
                            >
                              {roomBookings
                                .filter(booking => shouldRenderBooking(booking, hour))
                                .map((booking) => {
                                  const position = calculateBookingPosition(booking);
                                  const bookingStart = new Date(booking.startDateTime);
                                  const bookingEnd = new Date(booking.endDateTime);
                                  const displayInfo = getBookingDisplayInfo(booking);
                                  const tooltipText = canSeeFullDetails(booking) 
                                    ? `${booking.title}\n${format(bookingStart, 'h:mm a')} - ${format(bookingEnd, 'h:mm a')}\nOrganizer: ${booking.user.email}`
                                    : `Booked\n${format(bookingStart, 'h:mm a')} - ${format(bookingEnd, 'h:mm a')}\nOrganizer: ${booking.user.email}`;
                                  
                                  const user = currentUser as any;
                                  const isOrganizer = user && booking.userId === user.id;
                                  
                                  return (
                                    <div
                                      key={booking.id}
                                      className={`absolute inset-y-2 ${getStatusColor(booking.status)} rounded px-2 py-1 text-white text-xs cursor-pointer transition-all shadow-sm overflow-hidden flex flex-col justify-center ${isOrganizer ? 'hover:opacity-80' : ''}`}
                                      style={{ 
                                        left: `${position.left}%`, 
                                        width: `${position.width}%`,
                                        zIndex: 10
                                      }}
                                      title={isOrganizer ? `${tooltipText}\n\nClick to edit` : tooltipText}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isOrganizer) {
                                          handleEditBooking(booking);
                                        }
                                      }}
                                      data-testid={`booking-${booking.id}`}
                                    >
                                      <div className="font-medium truncate">
                                        {displayInfo.title}
                                      </div>
                                      {position.width > 15 && (
                                        <div className="text-[10px] opacity-90 truncate">
                                          {format(bookingStart, 'h:mm a')} - {format(bookingEnd, 'h:mm a')}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-sm text-gray-600 dark:text-slate-400">Confirmed</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-amber-500 rounded"></div>
            <span className="text-sm text-gray-600 dark:text-slate-400">Pending</span>
          </div>
        </div>
        <div className="text-sm text-gray-500 dark:text-slate-500">
          Showing {filteredRooms.length} of {rooms.length} rooms
        </div>
      </div>

      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Room</DialogTitle>
            <DialogDescription>
              {selectedSlot && (
                <span className="font-medium">
                  {selectedSlot.roomName}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meeting Title *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter meeting title" 
                        {...field} 
                        data-testid="input-booking-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDateTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date & Time *</FormLabel>
                      <FormControl>
                        <Input 
                          type="datetime-local" 
                          {...field} 
                          data-testid="input-start-datetime"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDateTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date & Time *</FormLabel>
                      <FormControl>
                        <Input 
                          type="datetime-local" 
                          {...field} 
                          data-testid="input-end-datetime"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add meeting agenda or notes" 
                        {...field} 
                        rows={3}
                        data-testid="input-booking-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ParticipantSelector
                participants={form.watch('participants') || []}
                onParticipantsChange={(participants) => form.setValue('participants', participants)}
              />

              <FormField
                control={form.control}
                name="repeatType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repeat</FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="flex flex-col space-y-1"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="none" id="repeat-none" />
                          <Label htmlFor="repeat-none" className="font-normal cursor-pointer">Does not repeat</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="daily" id="repeat-daily" />
                          <Label htmlFor="repeat-daily" className="font-normal cursor-pointer">Daily</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="weekly" id="repeat-weekly" />
                          <Label htmlFor="repeat-weekly" className="font-normal cursor-pointer">Weekly</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="custom" id="repeat-custom" />
                          <Label htmlFor="repeat-custom" className="font-normal cursor-pointer">Custom</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('repeatType') === 'custom' && (
                <div className="space-y-2 pl-4 border-l-2 border-gray-200 dark:border-slate-700">
                  <Label>Repeat on</Label>
                  <div className="flex flex-wrap gap-2">
                    {weekDays.map((day) => (
                      <Button
                        key={day.value}
                        type="button"
                        variant={form.watch('customDays')?.includes(day.value) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleCustomDay(day.value)}
                        className="w-14"
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="remindMe"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-remind-me"
                        />
                      </FormControl>
                      <FormLabel className="flex items-center space-x-2 !mt-0 cursor-pointer">
                        <Bell className="w-4 h-4" />
                        <span>Remind me</span>
                      </FormLabel>
                    </FormItem>
                  )}
                />

                {form.watch('remindMe') && (
                  <FormField
                    control={form.control}
                    name="reminderTime"
                    render={({ field }) => (
                      <FormItem className="pl-6">
                        <FormControl>
                          <Select
                            value={field.value.toString()}
                            onValueChange={(value) => field.onChange(parseInt(value))}
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
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBookingDialogOpen(false)}
                  data-testid="button-cancel-booking"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={bookingMutation.isPending}
                  data-testid="button-submit-booking"
                >
                  {bookingMutation.isPending ? "Booking..." : "Book Room"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Booking Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Booking</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title *</Label>
                <Input
                  id="edit-title"
                  placeholder="Enter booking title"
                  {...editForm.register('title')}
                  data-testid="input-edit-title"
                />
                {editForm.formState.errors.title && (
                  <p className="text-sm text-red-600">{editForm.formState.errors.title.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-room">Room *</Label>
                <Select value={editForm.watch('roomId')?.toString()} onValueChange={(value) => editForm.setValue('roomId', parseInt(value))}>
                  <SelectTrigger data-testid="select-edit-room">
                    <SelectValue placeholder="Select a room" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const currentRoomId = editForm.watch('roomId');
                      if (roomAvailability.length > 0) {
                        const availableRooms = roomAvailability.filter(room => room.available);
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
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    Showing {roomAvailability.filter(r => r.available).length} available room(s) for selected time
                  </p>
                )}
                {editForm.formState.errors.roomId && (
                  <p className="text-sm text-red-600">{editForm.formState.errors.roomId.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="edit-start">Start Date & Time *</Label>
                <Input
                  id="edit-start"
                  type="datetime-local"
                  {...editForm.register('startDateTime')}
                  data-testid="input-edit-start"
                />
                {editForm.formState.errors.startDateTime && (
                  <p className="text-sm text-red-600">{editForm.formState.errors.startDateTime.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end">End Date & Time *</Label>
                <Input
                  id="edit-end"
                  type="datetime-local"
                  {...editForm.register('endDateTime')}
                  data-testid="input-edit-end"
                />
                {editForm.formState.errors.endDateTime && (
                  <p className="text-sm text-red-600">{editForm.formState.errors.endDateTime.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Enter booking description..."
                {...editForm.register('description')}
                data-testid="textarea-edit-description"
              />
            </div>

            <ParticipantSelector
              participants={editForm.watch('participants') || []}
              onParticipantsChange={(participants) => editForm.setValue('participants', participants)}
            />

            <div className="space-y-2">
              <Label>Repeat</Label>
              <Select 
                value={editForm.watch('repeatType')} 
                onValueChange={(value) => editForm.setValue('repeatType', value as any)}
              >
                <SelectTrigger data-testid="select-edit-repeat">
                  <SelectValue placeholder="Does not repeat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Does not repeat</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              
              {editForm.watch('repeatType') === 'custom' && (
                <div className="mt-3">
                  <Label>Select Days</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {weekDays.map((day) => (
                      <Button
                        key={day.value}
                        type="button"
                        variant={(editForm.watch('customDays') || []).includes(day.value) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleEditCustomDay(day.value)}
                        data-testid={`button-edit-day-${day.label.toLowerCase()}`}
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-remindMe"
                  checked={editForm.watch('remindMe')}
                  onCheckedChange={(checked) => editForm.setValue('remindMe', !!checked)}
                  data-testid="checkbox-edit-remind-me"
                />
                <Label htmlFor="edit-remindMe" className="flex items-center space-x-2">
                  <Bell className="w-4 h-4" />
                  <span>Remind me</span>
                </Label>
              </div>
              {editForm.watch('remindMe') && (
                <Select 
                  value={editForm.watch('reminderTime')?.toString()} 
                  onValueChange={(value) => editForm.setValue('reminderTime', parseInt(value))}
                >
                  <SelectTrigger data-testid="select-edit-reminder-time">
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
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} data-testid="button-cancel-edit">
                Cancel
              </Button>
              <Button type="submit" disabled={updateBookingMutation.isPending} data-testid="button-submit-edit">
                {updateBookingMutation.isPending ? 'Updating...' : 'Update Booking'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
