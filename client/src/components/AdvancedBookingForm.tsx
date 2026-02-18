import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MapPin, AlertCircle, X, Plus, Users, Bell } from "lucide-react";
import { useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import RoomSelector from "./RoomSelector";
import ParticipantSelector from "./ParticipantSelector";

const bookingSchema = z.object({
  title: z.string().min(1, "Title is required"),
  roomId: z.string().min(1, "Room selection is required"),
  startDateTime: z.string().min(1, "Start date and time is required"),
  endDateTime: z.string().min(1, "End date and time is required"),
  description: z.string().optional(),
  participants: z.array(z.string().email("Invalid email address")).default([]),
  repeatType: z.enum(["none", "daily", "weekly", "custom"]).default("none"),
  customDays: z.array(z.number().min(0).max(6)).default([]), // 0 = Sunday, 6 = Saturday
  remindMe: z.boolean().default(false),
  reminderTime: z.number().default(15),
});

type BookingFormData = z.infer<typeof bookingSchema>;

interface AdvancedBookingFormProps {
  onSuccess?: () => void;
}

export default function AdvancedBookingForm({ onSuccess }: AdvancedBookingFormProps = {}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
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
  const [isRoomSelectorOpen, setIsRoomSelectorOpen] = useState(false);

  const { data: rooms = [], isLoading: roomsLoading } = useQuery<Array<{
    id: number;
    name: string;
    capacity: number;
    description: string;
    equipment: string[];
  }>>({
    queryKey: ['/api/rooms'],
  });

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      title: "",
      roomId: "",
      startDateTime: "",
      endDateTime: "",
      description: "",
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
    { value: 0, label: "Sunday" },
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
  ];


  // Helper functions for custom days
  const toggleCustomDay = (dayValue: number) => {
    const currentDays = form.getValues('customDays') || [];
    const newDays = currentDays.includes(dayValue)
      ? currentDays.filter(day => day !== dayValue)
      : [...currentDays, dayValue].sort();
    form.setValue('customDays', newDays);
  };

  // Function to check room availability
  const checkRoomAvailability = async (startDateTime: string, endDateTime: string) => {
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
        }),
      });
      const data = await response.json();
      // Ensure we have an array response
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

  // Watch for changes in start/end times
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'startDateTime' || name === 'endDateTime') {
        if (value.startDateTime && value.endDateTime) {
          checkRoomAvailability(value.startDateTime, value.endDateTime);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const createBookingMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Booking created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/dashboard');
      }
    },
    onError: (error: any) => {
      let errorMessage = "Failed to create booking";
      
      // Handle specific error cases
      if (error.message?.includes("conflict") || error.message?.includes("already booked")) {
        errorMessage = "This room is already booked for the selected time. Please choose a different time or room.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Booking Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
  });

  const onSubmit = async (data: BookingFormData) => {
    // Check if selected room is available
    if (Array.isArray(roomAvailability) && roomAvailability.length > 0) {
      const selectedRoom = roomAvailability.find(room => room.id.toString() === data.roomId);
      if (selectedRoom && !selectedRoom.available) {
        toast({
          title: "Room Unavailable",
          description: "The selected room is not available for this time slot. Please choose a different room or time.",
          variant: "destructive",
        });
        return;
      }
    }

    let attachmentUrl;
    let attachmentName;
    if (attachmentFile) {
      try {
        const uploadResult = await uploadFileMutation.mutateAsync(attachmentFile);
        attachmentUrl = uploadResult.url;
        attachmentName = attachmentFile.name;
      } catch (error) {
        toast({
          title: "Upload Error",
          description: "Failed to upload attachment",
          variant: "destructive",
        });
        return;
      }
    }

    createBookingMutation.mutate({
      ...data,
      roomId: parseInt(data.roomId),
      attachmentUrl,
      attachmentName,
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'image/jpeg', 'image/png'];
      if (allowedTypes.includes(file.type)) {
        setAttachmentFile(file);
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please select a PDF, DOCX, PPT, JPG, or PNG file",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Add Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter meeting title"
                  {...form.register('title')}
                  data-testid="input-booking-title"
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-red-600">{form.formState.errors.title.message}</p>
                )}
              </div>

              {/* Participants */}
              <ParticipantSelector
                participants={form.watch('participants') || []}
                onParticipantsChange={(participants) => form.setValue('participants', participants)}
              />

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDateTime">Start Date & Time *</Label>
                  <Input
                    id="startDateTime"
                    type="datetime-local"
                    {...form.register('startDateTime')}
                    data-testid="input-start-datetime"
                  />
                  {form.formState.errors.startDateTime && (
                    <p className="text-sm text-red-600">{form.formState.errors.startDateTime.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDateTime">End Date & Time *</Label>
                  <Input
                    id="endDateTime"
                    type="datetime-local"
                    {...form.register('endDateTime')}
                    data-testid="input-end-datetime"
                  />
                  {form.formState.errors.endDateTime && (
                    <p className="text-sm text-red-600">{form.formState.errors.endDateTime.message}</p>
                  )}
                </div>
              </div>

              {/* Room Selection */}
              <div className="space-y-2">
                <Label htmlFor="roomId">Select Room *</Label>
                {checkingAvailability && (
                  <Alert>
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>
                      Checking room availability for your selected time...
                    </AlertDescription>
                  </Alert>
                )}
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRoomSelectorOpen(true)}
                  className="w-full justify-start text-left h-10 px-3 py-2"
                  disabled={(!Array.isArray(roomAvailability) || roomAvailability.length === 0) && checkingAvailability}
                >
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4" />
                    <span>
                      {form.watch('roomId') ? 
                        (Array.isArray(roomAvailability) ? roomAvailability.find(r => r.id.toString() === form.watch('roomId'))?.name : null) || 
                        rooms.find((r) => r.id.toString() === form.watch('roomId'))?.name ||
                        'Selected Room'
                        : 'Choose a room...'
                      }
                    </span>
                  </div>
                </Button>
                
                {Array.isArray(roomAvailability) && roomAvailability.length > 0 && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Available rooms: {roomAvailability.filter(room => room.available).length}</span>
                      <span>Unavailable rooms: {roomAvailability.filter(room => !room.available).length}</span>
                    </div>
                  </div>
                )}
                
                {form.formState.errors.roomId && (
                  <p className="text-sm text-red-600">{form.formState.errors.roomId.message}</p>
                )}
              </div>

              {/* Meeting Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Add meeting agenda or notes"
                  {...form.register('description')}
                  rows={3}
                  data-testid="input-booking-description"
                />
              </div>

              {/* Repeat Options */}
              <div className="space-y-2">
                <Label>Repeat</Label>
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="repeat-none"
                      value="none"
                      checked={form.watch('repeatType') === 'none'}
                      onChange={() => form.setValue('repeatType', 'none')}
                      data-testid="radio-repeat-none"
                    />
                    <Label htmlFor="repeat-none" className="font-normal cursor-pointer">Does not repeat</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="repeat-daily"
                      value="daily"
                      checked={form.watch('repeatType') === 'daily'}
                      onChange={() => form.setValue('repeatType', 'daily')}
                      data-testid="radio-repeat-daily"
                    />
                    <Label htmlFor="repeat-daily" className="font-normal cursor-pointer">Daily</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="repeat-weekly"
                      value="weekly"
                      checked={form.watch('repeatType') === 'weekly'}
                      onChange={() => form.setValue('repeatType', 'weekly')}
                      data-testid="radio-repeat-weekly"
                    />
                    <Label htmlFor="repeat-weekly" className="font-normal cursor-pointer">Weekly</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="repeat-custom"
                      value="custom"
                      checked={form.watch('repeatType') === 'custom'}
                      onChange={() => form.setValue('repeatType', 'custom')}
                      data-testid="radio-repeat-custom"
                    />
                    <Label htmlFor="repeat-custom" className="font-normal cursor-pointer">Custom</Label>
                  </div>
                </div>
              </div>

              {/* Custom Days Selection */}
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
                        className="w-20"
                        data-testid={`button-day-${day.label.toLowerCase()}`}
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                  {form.watch('customDays')?.length === 0 && (
                    <p className="text-sm text-amber-600 dark:text-amber-500">Please select at least one day</p>
                  )}
                </div>
              )}

              {/* Reminder */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remindMe"
                    checked={form.watch('remindMe')}
                    onCheckedChange={(checked) => form.setValue('remindMe', !!checked)}
                    data-testid="checkbox-remind-me"
                  />
                  <Label htmlFor="remindMe" className="flex items-center space-x-2 cursor-pointer">
                    <Bell className="w-4 h-4" />
                    <span>Remind me</span>
                  </Label>
                </div>
                {form.watch('remindMe') && (
                  <Select onValueChange={(value) => form.setValue('reminderTime', parseInt(value))} defaultValue="15">
                    <SelectTrigger className="w-full">
                      <SelectValue />
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

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-4">
                <Button type="button" variant="outline" onClick={onSuccess}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createBookingMutation.isPending}>
                  {createBookingMutation.isPending ? 'Booking...' : 'Book Room'}
                </Button>
              </div>
            </form>
      
            {/* Room Selector Dialog */}
            <RoomSelector
              isOpen={isRoomSelectorOpen}
              onClose={() => setIsRoomSelectorOpen(false)}
              rooms={Array.isArray(roomAvailability) && roomAvailability.length > 0 ? roomAvailability : rooms.map((room) => ({
                ...room,
                equipment: room.equipment || [],
                available: true,
                conflictReason: null
              }))}
              onSelect={(roomId) => form.setValue('roomId', roomId)}
              selectedRoomId={form.watch('roomId')}
              hideUnavailable={Array.isArray(roomAvailability) && roomAvailability.length > 0}
            />
          </>
  );
}