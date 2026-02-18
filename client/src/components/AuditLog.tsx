import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  ClipboardList, 
  User, 
  Calendar, 
  DoorOpen, 
  LogIn, 
  LogOut,
  Plus,
  Edit,
  Trash2,
  Filter,
  Activity,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function AuditLog() {
  const { toast } = useToast();
  const [actionFilter, setActionFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");
  const [limit, setLimit] = useState(100);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['/api/audit-logs', { limit }],
    queryFn: async () => {
      const response = await fetch(`/api/audit-logs?limit=${limit}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }
      const data = await response.json();
      console.log('Audit logs data:', data);
      return Array.isArray(data) ? data : [];
    },
    onError: (error) => {
      console.error('Audit logs error:', error);
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
      }
    },
  });

  const filteredLogs = logs.filter((log: any) => {
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesResource = resourceFilter === "all" || log.resourceType === resourceFilter;
    return matchesAction && matchesResource;
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return <Plus className="w-4 h-4 text-green-600" />;
      case 'update':
        return <Edit className="w-4 h-4 text-blue-600" />;
      case 'delete':
        return <Trash2 className="w-4 h-4 text-red-600" />;
      case 'login':
        return <LogIn className="w-4 h-4 text-green-600" />;
      case 'logout':
        return <LogOut className="w-4 h-4 text-gray-600" />;
      case 'view':
        return <Activity className="w-4 h-4 text-blue-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getResourceIcon = (resourceType: string) => {
    switch (resourceType) {
      case 'user':
        return <User className="w-4 h-4 text-blue-600" />;
      case 'room':
        return <DoorOpen className="w-4 h-4 text-purple-600" />;
      case 'booking':
        return <Calendar className="w-4 h-4 text-green-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400';
      case 'update':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400';
      case 'delete':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400';
      case 'login':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400';
      case 'logout':
        return 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-400';
      default:
        return 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-400';
    }
  };

  const getResourceColor = (resourceType: string) => {
    switch (resourceType) {
      case 'user':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400';
      case 'room':
        return 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-400';
      case 'booking':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400';
      default:
        return 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-400';
    }
  };

  const formatLogMessage = (log: any) => {
    const action = log.action;
    const resource = log.resourceType;
    const resourceId = log.resourceId;
    
    let message = `${action.charAt(0).toUpperCase() + action.slice(1)}d ${resource}`;
    if (resourceId) {
      message += ` #${resourceId}`;
    }
    
    return message;
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
            <ClipboardList className="w-5 h-5" />
            <span>Audit Log</span>
          </CardTitle>
          <p className="text-gray-600 dark:text-slate-400">
            Track system activity and changes
          </p>
        </CardHeader>
        <CardContent>
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="view">View</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
              </SelectContent>
            </Select>
            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Resource" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                <SelectItem value="user">Users</SelectItem>
                <SelectItem value="room">Rooms</SelectItem>
                <SelectItem value="booking">Bookings</SelectItem>
                <SelectItem value="dashboard">Dashboard</SelectItem>
                <SelectItem value="audit-logs">Audit Logs</SelectItem>
              </SelectContent>
            </Select>
            <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 entries</SelectItem>
                <SelectItem value="100">100 entries</SelectItem>
                <SelectItem value="200">200 entries</SelectItem>
                <SelectItem value="500">500 entries</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Audit Log Table */}
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-slate-400">
                {actionFilter !== "all" || resourceFilter !== "all" 
                  ? "No audit logs match your filters"
                  : "No audit logs found"
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log: any) => (
                <Card key={log.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          {getActionIcon(log.action)}
                          <Badge className={getActionColor(log.action)}>
                            {log.action}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {getResourceIcon(log.resourceType)}
                          <Badge className={getResourceColor(log.resourceType)}>
                            {log.resourceType}
                          </Badge>
                        </div>
                        
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800 dark:text-white">
                            {formatLogMessage(log)}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Avatar className="w-5 h-5">
                              <AvatarFallback className="text-xs">
                                {log.userFirstName?.[0]}{log.userLastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <p className="text-xs text-gray-600 dark:text-slate-400">
                              {log.userFirstName} {log.userLastName} ({log.userEmail})
                            </p>
                            <Badge variant="outline" className="text-xs">
                              {log.userRole}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <p className="text-sm text-gray-800 dark:text-white">
                            {format(new Date(log.timestamp), 'MMM dd, yyyy')}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-slate-400">
                            {format(new Date(log.timestamp), 'HH:mm:ss')}
                          </p>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 px-3">
                              <Eye className="w-4 h-4 mr-1" />
                              Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle className="flex items-center space-x-2">
                                {getActionIcon(log.action)}
                                <span>Audit Log Details</span>
                              </DialogTitle>
                            </DialogHeader>
                            
                            <div className="space-y-6">
                              {/* Basic Information */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-semibold text-sm text-gray-700 dark:text-slate-300 mb-2">Action</h4>
                                  <div className="flex items-center space-x-2">
                                    {getActionIcon(log.action)}
                                    <Badge className={getActionColor(log.action)}>
                                      {log.action}
                                    </Badge>
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="font-semibold text-sm text-gray-700 dark:text-slate-300 mb-2">Resource</h4>
                                  <div className="flex items-center space-x-2">
                                    {getResourceIcon(log.resourceType)}
                                    <Badge className={getResourceColor(log.resourceType)}>
                                      {log.resourceType}
                                    </Badge>
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="font-semibold text-sm text-gray-700 dark:text-slate-300 mb-2">Timestamp</h4>
                                  <p className="text-sm text-gray-800 dark:text-white">
                                    {format(new Date(log.timestamp), 'PPpp')}
                                  </p>
                                </div>
                                
                                <div>
                                  <h4 className="font-semibold text-sm text-gray-700 dark:text-slate-300 mb-2">Log ID</h4>
                                  <p className="text-sm text-gray-800 dark:text-white">#{log.id}</p>
                                </div>
                              </div>
                              
                              {/* User Information */}
                              <div>
                                <h4 className="font-semibold text-sm text-gray-700 dark:text-slate-300 mb-2">User Information</h4>
                                <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                                  <Avatar className="w-8 h-8">
                                    <AvatarFallback className="text-sm">
                                      {log.userFirstName?.[0]}{log.userLastName?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-800 dark:text-white">
                                      {log.userFirstName} {log.userLastName}
                                    </p>
                                    <p className="text-xs text-gray-600 dark:text-slate-400">
                                      {log.userEmail}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {log.userRole}
                                  </Badge>
                                </div>
                              </div>
                              
                              {/* Resource Details */}
                              {log.resourceId && (
                                <div>
                                  <h4 className="font-semibold text-sm text-gray-700 dark:text-slate-300 mb-2">Resource ID</h4>
                                  <p className="text-sm text-gray-800 dark:text-white font-mono bg-gray-50 dark:bg-slate-800/50 p-2 rounded">
                                    {log.resourceId}
                                  </p>
                                </div>
                              )}
                              
                              {/* Action Details */}
                              {log.details && (
                                <div>
                                  <h4 className="font-semibold text-sm text-gray-700 dark:text-slate-300 mb-2">Full Details</h4>
                                  <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
                                    <pre className="text-xs text-gray-700 dark:text-slate-300 whitespace-pre-wrap overflow-x-auto">
                                      {JSON.stringify(log.details, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>


                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Load More Button */}
          {filteredLogs.length >= limit && (
            <div className="text-center mt-6">
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Showing {filteredLogs.length} of {filteredLogs.length}+ entries
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
