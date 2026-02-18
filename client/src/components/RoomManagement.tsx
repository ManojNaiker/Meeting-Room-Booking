import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import { 
  DoorOpen, 
  Plus, 
  Edit, 
  Trash2,
  Users,
  Phone,
  Monitor,
  Tv,
  Video,
  Mic,
  Camera,
  CloudUpload
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

const roomSchema = z.object({
  name: z.string().min(1, "Room name is required"),
  capacity: z.number().min(1, "Capacity must be at least 1"),
  description: z.string().optional(),
  equipment: z.array(z.string()).default([]),
});

type RoomFormData = z.infer<typeof roomSchema>;

const equipmentOptions = [
  { id: "telephone", label: "Telephone", icon: Phone },
  { id: "whiteboard", label: "Whiteboard", icon: Monitor },
  { id: "tv", label: "TV", icon: Tv },
  { id: "projector", label: "Projector", icon: Video },
  { id: "mic-speaker", label: "Mic & Speaker", icon: Mic },
  { id: "camera", label: "Camera", icon: Camera },
];

export default function RoomManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [roomImage, setRoomImage] = useState<File | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<number | null>(null);

  const { data: rooms = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/rooms'],
  });

  const form = useForm<RoomFormData>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      name: "",
      capacity: 1,
      description: "",
      equipment: [],
    },
  });

  const createRoomMutation = useMutation({
    mutationFn: async (data: RoomFormData & { imageUrl?: string }) => {
      const response = await apiRequest('/api/rooms', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Room created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      setIsCreateModalOpen(false);
      form.reset();
      setRoomImage(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRoomMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<RoomFormData> }) => {
      const response = await apiRequest(`/api/rooms/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Room updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      setEditingRoom(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/rooms/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Room deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadImageMutation = useMutation({
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

  const onSubmit = async (data: RoomFormData) => {
    let imageUrl;
    if (roomImage) {
      try {
        const uploadResult = await uploadImageMutation.mutateAsync(roomImage);
        imageUrl = uploadResult.url;
      } catch (error) {
        toast({
          title: "Upload Error",
          description: "Failed to upload room image",
          variant: "destructive",
        });
        return;
      }
    }

    createRoomMutation.mutate({
      ...data,
      imageUrl,
    });
  };

  const handleEdit = (room: any) => {
    setEditingRoom(room);
    form.setValue('name', room.name);
    form.setValue('capacity', room.capacity);
    form.setValue('description', room.description || '');
    form.setValue('equipment', room.equipment || []);
  };

  const handleUpdate = (data: RoomFormData) => {
    if (editingRoom) {
      updateRoomMutation.mutate({
        id: editingRoom.id,
        data,
      });
    }
  };

  const handleDelete = (id: number) => {
    setRoomToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (roomToDelete !== null) {
      deleteRoomMutation.mutate(roomToDelete);
      setIsDeleteDialogOpen(false);
      setRoomToDelete(null);
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (allowedTypes.includes(file.type)) {
        setRoomImage(file);
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please select a JPEG, PNG, GIF, or WebP image",
          variant: "destructive",
        });
      }
    }
  };

  const getEquipmentIcon = (equipmentId: string) => {
    const equipment = equipmentOptions.find(e => e.id === equipmentId);
    return equipment ? equipment.icon : Monitor;
  };

  const getEquipmentLabel = (equipmentId: string) => {
    const equipment = equipmentOptions.find(e => e.id === equipmentId);
    return equipment ? equipment.label : equipmentId;
  };

  const getEquipmentColor = (equipmentId: string) => {
    const colors = {
      telephone: 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400',
      whiteboard: 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400',
      tv: 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-400',
      projector: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400',
      'mic-speaker': 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400',
      camera: 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-400',
    };
    return colors[equipmentId as keyof typeof colors] || 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-400';
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
                ))}
              </div>
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <DoorOpen className="w-5 h-5" />
                <span>Room Management</span>
              </CardTitle>
              <p className="text-gray-600 dark:text-slate-400 mt-1">
                Manage meeting rooms and their equipment
              </p>
            </div>
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Room
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Room</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Room Name *</Label>
                      <Input
                        id="name"
                        placeholder="Enter room name"
                        {...form.register('name')}
                      />
                      {form.formState.errors.name && (
                        <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="capacity">Capacity *</Label>
                      <Input
                        id="capacity"
                        type="number"
                        placeholder="Number of people"
                        {...form.register('capacity', { valueAsNumber: true })}
                      />
                      {form.formState.errors.capacity && (
                        <p className="text-sm text-red-600">{form.formState.errors.capacity.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Room description..."
                      {...form.register('description')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Room Image</Label>
                    <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-6 text-center hover:border-primary transition-colors">
                      <input
                        type="file"
                        className="hidden"
                        id="room-image"
                        accept="image/*"
                        onChange={handleImageChange}
                      />
                      <label htmlFor="room-image" className="cursor-pointer">
                        <CloudUpload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-sm text-gray-600 dark:text-slate-400">Upload room image</p>
                      </label>
                      {roomImage && (
                        <p className="text-sm text-green-600 mt-2">
                          Selected: {roomImage.name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Equipment Checklist</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {equipmentOptions.map((equipment) => (
                        <div key={equipment.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={equipment.id}
                            onCheckedChange={(checked) => {
                              const currentEquipment = form.watch('equipment') || [];
                              if (checked) {
                                form.setValue('equipment', [...currentEquipment, equipment.id]);
                              } else {
                                form.setValue('equipment', currentEquipment.filter(id => id !== equipment.id));
                              }
                            }}
                          />
                          <Label htmlFor={equipment.id} className="text-sm">
                            {equipment.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createRoomMutation.isPending}>
                      {createRoomMutation.isPending ? 'Creating...' : 'Create Room'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {rooms.length === 0 ? (
            <div className="text-center py-8">
              <DoorOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-slate-400">No rooms found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((room: any) => (
                <Card key={room.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    {room.imageUrl && (
                      <img 
                        src={room.imageUrl} 
                        alt={room.name} 
                        className="w-full h-48 object-cover rounded-lg mb-4"
                      />
                    )}
                    
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{room.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-slate-400 flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        Capacity: {room.capacity} people
                      </p>
                      {room.description && (
                        <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">{room.description}</p>
                      )}
                    </div>

                    {room.equipment && room.equipment.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Equipment</h4>
                        <div className="flex flex-wrap gap-2">
                          {room.equipment.map((equipmentId: string, index: number) => {
                            const Icon = getEquipmentIcon(equipmentId);
                            return (
                              <Badge key={`${equipmentId}-${index}`} className={getEquipmentColor(equipmentId)}>
                                <Icon className="w-3 h-3 mr-1" />
                                {getEquipmentLabel(equipmentId)}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <Badge className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400">
                        Available
                      </Badge>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(room)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(room.id)}
                          disabled={deleteRoomMutation.isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Edit Room Dialog */}
      <Dialog open={!!editingRoom} onOpenChange={() => setEditingRoom(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Room</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Room Name *</Label>
                <Input
                  id="edit-name"
                  placeholder="Enter room name"
                  {...form.register('name')}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-capacity">Capacity *</Label>
                <Input
                  id="edit-capacity"
                  type="number"
                  placeholder="Number of people"
                  {...form.register('capacity', { valueAsNumber: true })}
                />
                {form.formState.errors.capacity && (
                  <p className="text-sm text-red-600">{form.formState.errors.capacity.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Room description..."
                {...form.register('description')}
              />
            </div>

            <div className="space-y-2">
              <Label>Equipment Checklist</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {equipmentOptions.map((equipment) => (
                  <div key={equipment.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-${equipment.id}`}
                      checked={form.watch('equipment')?.includes(equipment.id)}
                      onCheckedChange={(checked) => {
                        const currentEquipment = form.watch('equipment') || [];
                        if (checked) {
                          form.setValue('equipment', [...currentEquipment, equipment.id]);
                        } else {
                          form.setValue('equipment', currentEquipment.filter(id => id !== equipment.id));
                        }
                      }}
                    />
                    <Label htmlFor={`edit-${equipment.id}`} className="text-sm">
                      {equipment.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => setEditingRoom(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateRoomMutation.isPending}>
                {updateRoomMutation.isPending ? 'Updating...' : 'Update Room'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-room-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this room? This action cannot be undone and will affect all future bookings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-room">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-room"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
