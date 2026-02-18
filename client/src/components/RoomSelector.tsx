import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, Users, MapPin, Phone, Monitor, Projector, Mic, Camera, Clipboard } from 'lucide-react';

interface Room {
  id: number;
  name: string;
  capacity: number;
  description: string;
  equipment: string[];
  available: boolean;
  conflictReason: string | null;
}

interface RoomSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
  onSelect: (roomId: string) => void;
  selectedRoomId?: string;
  hideUnavailable?: boolean;
}

const getEquipmentIcon = (equipment: string) => {
  switch (equipment.toLowerCase()) {
    case 'telephone':
    case 'phone':
      return <Phone className="w-3 h-3" />;
    case 'tv':
    case 'monitor':
      return <Monitor className="w-3 h-3" />;
    case 'projector':
      return <Projector className="w-3 h-3" />;
    case 'mic':
    case 'microphone':
    case 'mic & speaker':
      return <Mic className="w-3 h-3" />;
    case 'camera':
      return <Camera className="w-3 h-3" />;
    case 'whiteboard':
      return <Clipboard className="w-3 h-3" />;
    default:
      return <div className="w-3 h-3 bg-gray-400 rounded-full" />;
  }
};

export default function RoomSelector({ isOpen, onClose, rooms, onSelect, selectedRoomId, hideUnavailable = false }: RoomSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const availableRooms = rooms.filter(room => room.available);

  const filterRooms = (roomsList: Room[]) => {
    if (!searchTerm) return roomsList;
    return roomsList.filter(room => 
      room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const filteredAvailableRooms = filterRooms(availableRooms);

  const handleRoomSelect = (room: Room) => {
    if (room.available) {
      onSelect(room.id.toString());
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[60vh] overflow-hidden flex flex-col" data-testid="dialog-room-selector">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-base font-semibold">Select Room</DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Choose an available room for your booking
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
          {/* Search Bar */}
          <div className="relative flex-shrink-0">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
            <Input
              placeholder="Search rooms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 h-9 text-sm"
              data-testid="input-search-room"
            />
          </div>

          {/* Room List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredAvailableRooms.length > 0 ? (
              filteredAvailableRooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => handleRoomSelect(room)}
                  className={`p-3 border rounded-lg cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    selectedRoomId === room.id.toString() 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                  data-testid={`card-room-${room.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2 flex-1">
                      <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{room.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-2 mt-0.5">
                          <div className="flex items-center space-x-1">
                            <Users className="w-3 h-3" />
                            <span>{room.capacity}</span>
                          </div>
                          {room.description && (
                            <>
                              <span>•</span>
                              <span className="truncate">{room.description}</span>
                            </>
                          )}
                        </div>
                        {room.equipment && room.equipment.length > 0 && (
                          <div className="flex items-center space-x-1 mt-1.5 flex-wrap gap-1">
                            {room.equipment.slice(0, 3).map((eq, index) => (
                              <div key={index} className="flex items-center space-x-0.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded text-xs">
                                {getEquipmentIcon(eq)}
                                <span>{eq}</span>
                              </div>
                            ))}
                            {room.equipment.length > 3 && (
                              <span className="text-xs text-gray-400">+{room.equipment.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 text-green-600 ml-2 flex-shrink-0">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                <MapPin className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <div className="text-sm font-medium">No available rooms</div>
                <div className="text-xs mt-1">Try a different time slot</div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}