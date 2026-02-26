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
  Users as UsersIcon,
  Phone, 
  Monitor, 
  Tv, 
  Video, 
  Mic, 
  Camera, 
  CloudUpload,
  LayoutGrid,
  List,
  Upload,
  Download,
  FileSpreadsheet,
  Search,
  Columns3
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { ScrollArea } from "@/components/ui/scroll-area";

const roomSchema = z.object({
  name: z.string().min(1, "Room name is required"),
  capacity: z.number().min(1, "Capacity must be at least 1"),
  description: z.string().optional(),
  equipment: z.array(z.string()).default([]),
  restrictedUsers: z.array(z.string()).default([]),
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

function UserSelectionField({ form, name }: { form: any, name: string }) {
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  const selectedUsers = form.watch(name) || [];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedUsers.map((userId: string) => {
          const user = users.find((u: any) => u.id === userId);
          if (!user) return null;
          return (
            <Badge key={userId} variant="secondary" className="flex items-center gap-1">
              {user.firstName} {user.lastName}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => {
                  form.setValue(name, selectedUsers.filter((id: string) => id !== userId));
                }}
              >
                <Plus className="h-3 w-3 rotate-45" />
              </Button>
            </Badge>
          );
        })}
      </div>
      <ScrollArea className="h-[150px] w-full border rounded-md p-2">
        <div className="space-y-2">
          {users.map((user: any) => (
            <div key={user.id} className="flex items-center space-x-2">
              <Checkbox
                id={`${name}-${user.id}`}
                checked={selectedUsers.includes(user.id)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    form.setValue(name, [...selectedUsers, user.id]);
                  } else {
                    form.setValue(name, selectedUsers.filter((id: string) => id !== user.id));
                  }
                }}
              />
              <Label htmlFor={`${name}-${user.id}`} className="text-sm cursor-pointer">
                {user.firstName} {user.lastName} ({user.email})
              </Label>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function RoomManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [roomImage, setRoomImage] = useState<File | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [bulkUploadResults, setBulkUploadResults] = useState<any>(null);

  const allColumns = [
    { key: "name", label: "Room Name", alwaysVisible: true },
    { key: "capacity", label: "Capacity" },
    { key: "description", label: "Description" },
    { key: "equipment", label: "Equipment" },
    { key: "status", label: "Status" },
    { key: "actions", label: "Actions", alwaysVisible: true },
  ];
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    ["name", "capacity", "description", "equipment", "status", "actions"]
  );
  const toggleColumn = (key: string) => {
    setVisibleColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };
  const isColumnVisible = (key: string) => visibleColumns.includes(key);

  const { data: rooms = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/rooms'],
  });

  const filteredRooms = rooms.filter((room: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      room.name?.toLowerCase().includes(term) ||
      room.description?.toLowerCase().includes(term) ||
      room.equipment?.some((e: string) => e.toLowerCase().includes(term))
    );
  });

  const form = useForm<RoomFormData>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      name: "",
      capacity: 1,
      description: "",
      equipment: [],
      restrictedUsers: [],
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

  const bulkUploadMutation = useMutation({
    mutationFn: async (roomsData: any[]) => {
      const response = await apiRequest('/api/rooms/bulk', {
        method: 'POST',
        body: JSON.stringify({ rooms: roomsData }),
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Upload Completed",
        description: `${data.success?.length || 0} rooms created, ${data.failed?.length || 0} failed`,
      });
      setBulkUploadResults(data);
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
    form.setValue('restrictedUsers', room.restrictedUsers || []);
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

  const handleExportCSV = () => {
    if (!rooms.length) return;
    const headers = ["name", "capacity", "description", "equipment"];
    const csvRows = [headers.join(",")];
    rooms.forEach((room: any) => {
      const equipmentStr = (room.equipment || []).join(", ");
      csvRows.push([
        `"${(room.name || '').replace(/"/g, '""')}"`,
        room.capacity,
        `"${(room.description || '').replace(/"/g, '""')}"`,
        `"${equipmentStr}"`,
      ].join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rooms_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export Complete", description: `Exported ${rooms.length} rooms to CSV` });
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleBulkUpload = () => {
    if (!uploadFile) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split("\n").filter(l => l.trim());
        if (lines.length < 2) {
          toast({ title: "Error", description: "CSV must have a header row and at least one data row", variant: "destructive" });
          return;
        }
        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
        const nameIdx = headers.indexOf("name");
        const capacityIdx = headers.indexOf("capacity");
        const descIdx = headers.indexOf("description");
        const equipIdx = headers.indexOf("equipment");

        if (nameIdx === -1 || capacityIdx === -1) {
          toast({ title: "Error", description: "CSV must have 'name' and 'capacity' columns", variant: "destructive" });
          return;
        }

        const roomsToCreate = lines.slice(1).map(line => {
          const cols = parseCSVLine(line);
          return {
            name: cols[nameIdx] || "",
            capacity: cols[capacityIdx] || "",
            description: descIdx !== -1 ? (cols[descIdx] || "") : "",
            equipment: equipIdx !== -1 ? (cols[equipIdx] || "") : "",
          };
        }).filter(r => r.name);

        bulkUploadMutation.mutate(roomsToCreate);
      } catch (err) {
        toast({ title: "Error", description: "Failed to parse CSV file", variant: "destructive" });
      }
    };
    reader.readAsText(uploadFile);
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

  const renderRoomForm = (onSubmitHandler: (data: RoomFormData) => void, isEdit: boolean) => (
    <form onSubmit={form.handleSubmit(onSubmitHandler)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor={isEdit ? "edit-name" : "name"}>Room Name *</Label>
          <Input
            id={isEdit ? "edit-name" : "name"}
            placeholder="Enter room name"
            {...form.register('name')}
          />
          {form.formState.errors.name && (
            <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor={isEdit ? "edit-capacity" : "capacity"}>Capacity *</Label>
          <Input
            id={isEdit ? "edit-capacity" : "capacity"}
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
        <Label htmlFor={isEdit ? "edit-description" : "description"}>Description</Label>
        <Textarea
          id={isEdit ? "edit-description" : "description"}
          placeholder="Room description..."
          {...form.register('description')}
        />
      </div>

      {!isEdit && (
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
      )}

      <div className="space-y-2">
        <Label>Equipment Checklist</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {equipmentOptions.map((equipment) => (
            <div key={equipment.id} className="flex items-center space-x-2">
              <Checkbox
                id={isEdit ? `edit-${equipment.id}` : equipment.id}
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
              <Label htmlFor={isEdit ? `edit-${equipment.id}` : equipment.id} className="text-sm">
                {equipment.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center space-x-2">
          <UsersIcon className="w-5 h-5 text-primary" />
          <Label className="text-base font-semibold">Restrict Access</Label>
        </div>
        <p className="text-sm text-muted-foreground">
          Select specific users who are allowed to book this room. If none are selected, anyone can book.
        </p>
        <UserSelectionField form={form} name="restrictedUsers" />
      </div>

      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={() => isEdit ? setEditingRoom(null) : setIsCreateModalOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={isEdit ? updateRoomMutation.isPending : createRoomMutation.isPending}>
          {isEdit
            ? (updateRoomMutation.isPending ? 'Updating...' : 'Update Room')
            : (createRoomMutation.isPending ? 'Creating...' : 'Create Room')
          }
        </Button>
      </div>
    </form>
  );

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <DoorOpen className="w-5 h-5" />
                <span>Room Management</span>
              </CardTitle>
              <p className="text-gray-600 dark:text-slate-400 mt-1">
                Manage meeting rooms and their equipment
              </p>
            </div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-2">
              <Dialog open={isBulkUploadOpen} onOpenChange={(open) => {
                setIsBulkUploadOpen(open);
                if (!open) { setUploadFile(null); setBulkUploadResults(null); }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-bulk-upload-rooms">
                    <Upload className="w-4 h-4 mr-2" />
                    Bulk Upload
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Bulk Upload Rooms</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      Upload a CSV file with columns: <strong>name</strong>, <strong>capacity</strong>, description, equipment (comma-separated within quotes).
                    </p>
                    <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        className="hidden"
                        id="bulk-room-upload"
                        accept=".csv"
                        onChange={(e) => {
                          setUploadFile(e.target.files?.[0] || null);
                          setBulkUploadResults(null);
                        }}
                      />
                      <label htmlFor="bulk-room-upload" className="cursor-pointer">
                        <FileSpreadsheet className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 dark:text-slate-400">
                          {uploadFile ? uploadFile.name : "Click to select CSV file"}
                        </p>
                      </label>
                    </div>
                    {bulkUploadResults && (
                      <div className="space-y-2 text-sm">
                        <p className="text-green-600">
                          {bulkUploadResults.success?.length || 0} rooms created successfully
                        </p>
                        {bulkUploadResults.failed?.length > 0 && (
                          <div className="text-red-600">
                            <p>{bulkUploadResults.failed.length} rooms failed:</p>
                            <ul className="list-disc pl-5 mt-1">
                              {bulkUploadResults.failed.map((fail: any, idx: number) => (
                                <li key={idx}>{fail.name}: {fail.reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsBulkUploadOpen(false)}>
                        Close
                      </Button>
                      <Button
                        onClick={handleBulkUpload}
                        disabled={!uploadFile || bulkUploadMutation.isPending}
                        data-testid="button-submit-bulk-upload-rooms"
                      >
                        {bulkUploadMutation.isPending ? "Uploading..." : "Upload"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button variant="outline" onClick={handleExportCSV} data-testid="button-export-rooms">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>

              <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-room">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Room
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New Room</DialogTitle>
                  </DialogHeader>
                  {renderRoomForm(onSubmit, false)}
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search rooms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-rooms"
              />
            </div>
            <div className="flex items-center space-x-2">
              {viewMode === "list" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-column-chooser-rooms">
                      <Columns3 className="w-4 h-4 mr-2" />
                      Columns
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56" align="end">
                    <div className="space-y-1">
                      <p className="text-sm font-medium mb-2">Toggle Columns</p>
                      {allColumns.map(col => (
                        <label
                          key={col.key}
                          className={`flex items-center space-x-2 py-1.5 px-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer ${col.alwaysVisible ? "opacity-50" : ""}`}
                        >
                          <Checkbox
                            checked={isColumnVisible(col.key)}
                            onCheckedChange={() => !col.alwaysVisible && toggleColumn(col.key)}
                            disabled={col.alwaysVisible}
                          />
                          <span className="text-sm">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <TooltipProvider delayDuration={200}>
                <div className="flex border rounded-md">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={viewMode === "grid" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("grid")}
                        className="rounded-r-none"
                        data-testid="button-view-grid"
                        aria-label="Grid view"
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Grid View</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={viewMode === "list" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("list")}
                        className="rounded-l-none"
                        data-testid="button-view-list"
                        aria-label="List view"
                      >
                        <List className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>List View</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>
          </div>

          {filteredRooms.length === 0 ? (
            <div className="text-center py-8">
              <DoorOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-slate-400">
                {searchTerm ? "No rooms match your search" : "No rooms found"}
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRooms.map((room: any) => (
                <Card key={room.id} className="hover:shadow-md transition-shadow" data-testid={`card-room-${room.id}`}>
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
                        <UsersIcon className="w-4 h-4 mr-1" />
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
                      <TooltipProvider delayDuration={200}>
                        <div className="flex space-x-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEdit(room)}
                                aria-label="Edit"
                                data-testid={`button-edit-room-${room.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                onClick={() => handleDelete(room.id)}
                                disabled={deleteRoomMutation.isPending}
                                aria-label="Delete"
                                data-testid={`button-delete-room-${room.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700">
                    {isColumnVisible("name") && <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400">Room Name</th>}
                    {isColumnVisible("capacity") && <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400">Capacity</th>}
                    {isColumnVisible("description") && <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400">Description</th>}
                    {isColumnVisible("equipment") && <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400">Equipment</th>}
                    {isColumnVisible("status") && <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400">Status</th>}
                    {isColumnVisible("actions") && <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredRooms.map((room: any) => (
                    <tr key={room.id} className="border-b border-gray-100 dark:border-slate-800" data-testid={`row-room-${room.id}`}>
                      {isColumnVisible("name") && (
                        <td className="py-4 px-4">
                          <div className="flex items-center">
                            {room.imageUrl && (
                              <img src={room.imageUrl} alt={room.name} className="w-10 h-10 rounded object-cover mr-3" />
                            )}
                            <div>
                              <p className="font-medium text-gray-800 dark:text-white">{room.name}</p>
                            </div>
                          </div>
                        </td>
                      )}
                      {isColumnVisible("capacity") && (
                        <td className="py-4 px-4 text-sm text-gray-600 dark:text-slate-400">
                          <div className="flex items-center">
                            <UsersIcon className="w-4 h-4 mr-1" />
                            {room.capacity}
                          </div>
                        </td>
                      )}
                      {isColumnVisible("description") && (
                        <td className="py-4 px-4 text-sm text-gray-600 dark:text-slate-400 max-w-xs truncate">
                          {room.description || "—"}
                        </td>
                      )}
                      {isColumnVisible("equipment") && (
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1">
                            {room.equipment && room.equipment.length > 0 ? (
                              room.equipment.map((equipmentId: string, index: number) => {
                                const Icon = getEquipmentIcon(equipmentId);
                                return (
                                  <Badge key={`${equipmentId}-${index}`} className={`text-xs ${getEquipmentColor(equipmentId)}`}>
                                    <Icon className="w-3 h-3 mr-1" />
                                    {getEquipmentLabel(equipmentId)}
                                  </Badge>
                                );
                              })
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </div>
                        </td>
                      )}
                      {isColumnVisible("status") && (
                        <td className="py-4 px-4">
                          <Badge className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400">
                            Available
                          </Badge>
                        </td>
                      )}
                      {isColumnVisible("actions") && (
                        <td className="py-4 px-4">
                          <TooltipProvider delayDuration={200}>
                            <div className="flex items-center space-x-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleEdit(room)}
                                    aria-label="Edit"
                                    data-testid={`button-edit-room-${room.id}`}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => handleDelete(room.id)}
                                    disabled={deleteRoomMutation.isPending}
                                    aria-label="Delete"
                                    data-testid={`button-delete-room-${room.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingRoom} onOpenChange={() => setEditingRoom(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Room</DialogTitle>
          </DialogHeader>
          {renderRoomForm(handleUpdate, true)}
        </DialogContent>
      </Dialog>

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
