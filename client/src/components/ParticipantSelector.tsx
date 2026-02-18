import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Users, Plus, X, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface ParticipantSelectorProps {
  participants: string[];
  onParticipantsChange: (participants: string[]) => void;
}

export default function ParticipantSelector({ participants, onParticipantsChange }: ParticipantSelectorProps) {
  const [open, setOpen] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: users = [], isLoading, isError } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await apiRequest('/api/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredUsers = Array.isArray(users) ? users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    const email = user.email.toLowerCase();
    return fullName.includes(searchLower) || email.includes(searchLower);
  }) : [];

  const addParticipant = (email: string) => {
    if (email && email.includes('@') && !participants.includes(email)) {
      onParticipantsChange([...participants, email]);
    }
  };

  const removeParticipant = (emailToRemove: string) => {
    onParticipantsChange(participants.filter(email => email !== emailToRemove));
  };

  const toggleParticipant = (email: string) => {
    if (participants.includes(email)) {
      removeParticipant(email);
    } else {
      addParticipant(email);
    }
  };

  const addManualEmail = () => {
    if (manualEmail && manualEmail.includes('@')) {
      addParticipant(manualEmail);
      setManualEmail("");
    }
  };

  const handleManualEmailKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addManualEmail();
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center space-x-2">
        <Users className="w-4 h-4" />
        <span>Add Participants</span>
      </Label>

      <div className="space-y-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
              type="button"
              data-testid="button-select-participants"
            >
              <span className="truncate">
                {participants.length > 0
                  ? `${participants.length} participant${participants.length > 1 ? 's' : ''} selected`
                  : "Select from user list..."}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search users by name or email..."
                value={searchTerm}
                onValueChange={setSearchTerm}
                data-testid="input-search-users"
              />
              <CommandList>
                <CommandEmpty>
                  {isLoading ? "Loading users..." : isError ? "Error loading users." : "No users found."}
                </CommandEmpty>
                <CommandGroup>
                  {filteredUsers.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={user.email}
                      onSelect={() => {
                        toggleParticipant(user.email);
                      }}
                      data-testid={`item-user-${user.email}`}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          participants.includes(user.email) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {user.firstName} {user.lastName}
                        </span>
                        <span className="text-xs text-gray-500">{user.email}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Input
              placeholder="Or enter email manually..."
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              onKeyPress={handleManualEmailKeyPress}
              data-testid="input-manual-email"
            />
          </div>
          <Button
            type="button"
            onClick={addManualEmail}
            size="icon"
            variant="outline"
            disabled={!manualEmail || !manualEmail.includes('@')}
            data-testid="button-add-manual-email"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {participants.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2" data-testid="participants-list">
            {participants.map((email, index) => {
              const user = Array.isArray(users) ? users.find(u => u.email === email) : undefined;
              return (
                <Badge key={index} variant="secondary" className="flex items-center space-x-1" data-testid={`badge-participant-${index}`}>
                  <span>
                    {user ? `${user.firstName} ${user.lastName}` : email}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeParticipant(email)}
                    className="ml-1 hover:text-red-500"
                    data-testid={`button-remove-participant-${index}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}

        <p className="text-xs text-gray-500">
          Each participant will receive a booking notification email
        </p>
      </div>
    </div>
  );
}
