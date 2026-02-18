import { useState } from "react";
import * as React from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "./ThemeProvider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { 
  Calendar, 
  CalendarPlus, 
  LayoutDashboard, 
  List, 
  Users, 
  DoorOpen, 
  ClipboardList,
  Bell,
  Settings,
  LogOut,
  Sun,
  Moon,
  Mail,
  BarChart3,
  User,
  Lock,
  Menu,
  X
} from "lucide-react";
import lightLogo from "@assets/Light_Logo_1752837156719.png";
import NotificationDropdown from "@/components/NotificationDropdown";

const profileUpdateSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, navigate] = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { trackNavigation, trackAction } = useAuditLog();

  const profileForm = useForm<z.infer<typeof profileUpdateSchema>>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
    },
  });

  // Update form values when user data changes or dialog opens
  React.useEffect(() => {
    if (user && isProfileOpen) {
      profileForm.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
      });
    }
  }, [user, isProfileOpen, profileForm]);

  const passwordForm = useForm<z.infer<typeof passwordChangeSchema>>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof profileUpdateSchema>) => {
      const response = await apiRequest('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setIsProfileOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof passwordChangeSchema>) => {
      const response = await apiRequest('/api/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword
        })
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password changed successfully",
      });
      passwordForm.reset();
      setIsProfileOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  // Check if user must change password (for auto-generated passwords)
  const mustChangePassword = user?.mustChangePassword === true;

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Room Scheduler', href: '/calendar', icon: Calendar },
    { name: 'My Bookings', href: '/my-bookings', icon: List },
  ];

  const adminNavigation = [
    { name: 'User Management', href: '/users', icon: Users },
    { name: 'Room Management', href: '/rooms', icon: DoorOpen },
    { name: 'Email Settings', href: '/email-settings', icon: Mail },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Audit Log', href: '/audit', icon: ClipboardList },
  ];

  const isAdmin = user?.role === 'admin';
  const isCurrentPage = (href: string) => location === href;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div 
        id="mobile-sidebar"
        className={`
          w-64 bg-white dark:bg-slate-800 shadow-lg border-r border-gray-200 dark:border-slate-700 flex flex-col
          fixed lg:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-center">
            <img 
              src={lightLogo} 
              alt="Light Finance Logo" 
              className="h-12 w-auto object-contain"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => {
                  navigate(item.href);
                  trackNavigation(item.name, { href: item.href, section: 'main-navigation' });
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                  isCurrentPage(item.href)
                    ? 'text-primary bg-blue-50 dark:bg-blue-900/20'
                    : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </button>
            );
          })}

          {/* Admin Section */}
          {isAdmin && (
            <div className="pt-4 border-t border-gray-200 dark:border-slate-700 mt-4">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                Administration
              </p>
              {adminNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      navigate(item.href);
                      trackNavigation(item.name, { href: item.href, section: 'admin-navigation' });
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                      isCurrentPage(item.href)
                        ? 'text-primary bg-blue-50 dark:bg-blue-900/20'
                        : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={user?.profileImageUrl || ''} alt={user?.firstName || ''} />
              <AvatarFallback>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800 dark:text-white">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-600 dark:text-slate-400 capitalize">{user?.role}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                trackAction('logout', 'user', user?.id, { page: location });
                logoutMutation.mutate();
              }}
              disabled={logoutMutation.isPending}
              className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-gray-200 dark:border-slate-700 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle navigation menu"
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-sidebar"
                data-testid="button-mobile-menu"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                  {getPageTitle(location)}
                </h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400">
                  {getPageSubtitle(location)}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="flex items-center space-x-2">
                <Sun className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                <Switch
                  checked={theme === 'dark'}
                  onCheckedChange={toggleTheme}
                />
                <Moon className="w-4 h-4 text-gray-500 dark:text-slate-400" />
              </div>
              <NotificationDropdown />
              <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings className="w-5 h-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Profile Settings</DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue="profile" className="w-full">
                    <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      <TabsTrigger value="profile">
                        <User className="w-4 h-4 mr-2" />
                        Profile
                      </TabsTrigger>
                      <TabsTrigger value="password">
                        <Lock className="w-4 h-4 mr-2" />
                        Password
                      </TabsTrigger>
                      {isAdmin && (
                        <TabsTrigger value="administration">
                          <Settings className="w-4 h-4 mr-2" />
                          Admin
                        </TabsTrigger>
                      )}
                    </TabsList>
                    
                    <TabsContent value="profile" className="space-y-4">
                      <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
                        <Avatar className="w-16 h-16">
                          <AvatarImage src={user?.profileImageUrl || ''} alt={user?.firstName || ''} />
                          <AvatarFallback className="text-lg">
                            {user?.firstName?.[0]}{user?.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-lg">{user?.firstName} {user?.lastName}</h3>
                          <p className="text-sm text-gray-600 dark:text-slate-400">{user?.email}</p>
                          <p className="text-sm text-gray-500 dark:text-slate-500 capitalize">Role: {user?.role}</p>
                        </div>
                      </div>
                      
                      <Form {...profileForm}>
                        <form onSubmit={profileForm.handleSubmit((data) => updateProfileMutation.mutate(data))} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={profileForm.control}
                              name="firstName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>First Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="John" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={profileForm.control}
                              name="lastName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Last Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Doe" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsProfileOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button type="submit" disabled={updateProfileMutation.isPending}>
                              {updateProfileMutation.isPending ? "Updating..." : "Update Profile"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </TabsContent>
                    
                    <TabsContent value="password" className="space-y-4">
                      <Form {...passwordForm}>
                        <form onSubmit={passwordForm.handleSubmit((data) => changePasswordMutation.mutate(data))} className="space-y-4">
                          <FormField
                            control={passwordForm.control}
                            name="currentPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Current Password</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="Enter current password" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={passwordForm.control}
                            name="newPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>New Password</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="Enter new password" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={passwordForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Confirm New Password</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="Confirm new password" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end space-x-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsProfileOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button type="submit" disabled={changePasswordMutation.isPending}>
                              {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </TabsContent>
                    
                    {isAdmin && (
                      <TabsContent value="administration" className="space-y-4">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Administrative Tools</h3>
                          <p className="text-sm text-blue-700 dark:text-blue-200">
                            Quick access to system administration features
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                          {adminNavigation.map((item) => {
                            const Icon = item.icon;
                            return (
                              <Button
                                key={item.name}
                                variant="outline"
                                className="justify-start h-auto p-4 flex items-center space-x-3 hover:bg-gray-50 dark:hover:bg-slate-800"
                                onClick={() => {
                                  navigate(item.href);
                                  setIsProfileOpen(false);
                                }}
                              >
                                <Icon className="w-5 h-5 text-gray-600 dark:text-slate-400" />
                                <div className="text-left">
                                  <div className="font-medium">{item.name}</div>
                                  <div className="text-sm text-gray-500 dark:text-slate-400">
                                    {getAdminToolDescription(item.name)}
                                  </div>
                                </div>
                              </Button>
                            );
                          })}
                        </div>
                      </TabsContent>
                    )}
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Forced Password Change Modal */}
      <Dialog open={mustChangePassword} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Lock className="w-5 h-5" />
              Password Change Required
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              You're using a temporary password. For security reasons, you must change your password before continuing.
            </p>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit((data) => changePasswordMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password (Temporary)</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Enter your temporary password"
                          data-testid="input-current-password"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Enter new password (min 6 characters)"
                          data-testid="input-new-password"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Confirm new password"
                          data-testid="input-confirm-password"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={changePasswordMutation.isPending}
                  data-testid="button-change-password"
                >
                  {changePasswordMutation.isPending ? "Changing Password..." : "Change Password"}
                </Button>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getPageTitle(location: string): string {
  const titles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/book': 'Book Room',
    '/calendar': 'Room Scheduler',
    '/my-bookings': 'My Bookings',
    '/users': 'User Management',
    '/rooms': 'Room Management',
    '/audit': 'Audit Log',
  };
  return titles[location] || 'Dashboard';
}

function getPageSubtitle(location: string): string {
  const subtitles: Record<string, string> = {
    '/dashboard': 'Welcome back, manage your bookings efficiently',
    '/book': 'Schedule your meeting and reserve the perfect room',
    '/calendar': 'View all bookings in calendar format',
    '/my-bookings': 'Manage your current and upcoming bookings',
    '/users': 'Manage user accounts and permissions',
    '/rooms': 'Manage meeting rooms and their equipment',
    '/audit': 'View system activity and changes',
  };
  return subtitles[location] || 'Welcome back';
}

function getAdminToolDescription(toolName: string): string {
  const descriptions: Record<string, string> = {
    'User Management': 'Manage user accounts and permissions',
    'Room Management': 'Add, edit, and manage meeting rooms',
    'Email Settings': 'Configure email notifications and SMTP',
    'Analytics': 'View usage statistics and reports',
    'Audit Log': 'Monitor system activity and changes',
  };
  return descriptions[toolName] || 'Administrative tool';
}
