import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./customAuth";
import { insertRoomSchema, insertBookingSchema, updateBookingSchema, insertEmailSettingsSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import * as nodemailer from "nodemailer";
import { generateICS } from "./icsHelper";

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowedTypes.includes(ext));
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize database with default admin user
  const { initializeDatabase } = await import("./initializeDb");
  await initializeDatabase();
  
  // Create sample notifications
  const { createSampleNotifications } = await import("./createSampleNotifications");
  await createSampleNotifications();
  
  // Auth middleware
  await setupAuth(app);

  // Helper function to create audit log
  const createAuditLog = async (req: any, action: string, resourceType: string, resourceId?: string, details?: any) => {
    if (req.user?.id) {
      await storage.createAuditLog({
        userId: req.user.id,
        action,
        resourceType,
        resourceId,
        details,
      });
    }
  };

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      await createAuditLog(req, 'view', 'user', userId, { action: 'fetch_profile' });
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard routes
  app.get('/api/dashboard/stats', isAuthenticated, async (req: any, res) => {
    try {
      const stats = await storage.getDashboardStats();
      await createAuditLog(req, 'view', 'dashboard', undefined, { 
        action: 'view_dashboard_stats',
        stats: stats
      });
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Room routes
  app.get('/api/rooms', isAuthenticated, async (req: any, res) => {
    try {
      const rooms = await storage.getAllRooms();
      await createAuditLog(req, 'view', 'room', undefined, { 
        action: 'view_all_rooms',
        count: rooms.length
      });
      res.json(rooms);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      res.status(500).json({ message: "Failed to fetch rooms" });
    }
  });

  app.get('/api/rooms/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const room = await storage.getRoom(id);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      await createAuditLog(req, 'view', 'room', id.toString(), { 
        action: 'view_room_details',
        roomName: room.name
      });
      res.json(room);
    } catch (error) {
      console.error("Error fetching room:", error);
      res.status(500).json({ message: "Failed to fetch room" });
    }
  });

  // Check room availability for a specific time slot
  app.post('/api/rooms/availability', isAuthenticated, async (req, res) => {
    try {
      const { startDateTime, endDateTime, excludeBookingId } = req.body;
      
      if (!startDateTime || !endDateTime) {
        return res.status(400).json({ message: "Start and end date times are required" });
      }
      
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);
      
      const rooms = await storage.getAllRooms();
      const roomAvailability = [];
      
      for (const room of rooms) {
        const hasConflict = await storage.checkBookingConflict(
          room.id, 
          start, 
          end, 
          excludeBookingId ? parseInt(excludeBookingId) : undefined
        );
        roomAvailability.push({
          ...room,
          available: !hasConflict,
          conflictReason: hasConflict ? 'Already booked for this time slot' : null
        });
      }
      res.json(roomAvailability);
    } catch (error) {
      console.error("Error checking room availability:", error);
      res.status(500).json({ message: "Failed to check room availability" });
    }
  });

  app.post('/api/rooms', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const roomData = insertRoomSchema.parse(req.body);
      const room = await storage.createRoom(roomData);
      await createAuditLog(req, 'create', 'room', room.id.toString(), room);
      res.json(room);
    } catch (error) {
      console.error("Error creating room:", error);
      res.status(500).json({ message: "Failed to create room" });
    }
  });

  app.put('/api/rooms/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const id = parseInt(req.params.id);
      const updates = req.body;
      const room = await storage.updateRoom(id, updates);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      await createAuditLog(req, 'update', 'room', id.toString(), updates);
      res.json(room);
    } catch (error) {
      console.error("Error updating room:", error);
      res.status(500).json({ message: "Failed to update room" });
    }
  });

  app.delete('/api/rooms/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const id = parseInt(req.params.id);
      const success = await storage.deleteRoom(id);
      if (!success) {
        return res.status(404).json({ message: "Room not found" });
      }
      await createAuditLog(req, 'delete', 'room', id.toString());
      res.json({ message: "Room deleted successfully" });
    } catch (error) {
      console.error("Error deleting room:", error);
      res.status(500).json({ message: "Failed to delete room" });
    }
  });

  // Booking routes
  app.get('/api/bookings', isAuthenticated, async (req: any, res) => {
    try {
      const bookings = await storage.getAllBookings();
      const currentUserEmail = req.user.email;
      const currentUserId = req.user.id;
      
      const filteredBookings = bookings.map(booking => {
        const isOrganizer = booking.userId === currentUserId;
        const participants = Array.isArray(booking.participants) ? booking.participants as string[] : [];
        const isParticipant = participants.some(email => 
          email.toLowerCase().trim() === currentUserEmail.toLowerCase().trim()
        );
        
        if (isOrganizer || isParticipant) {
          return booking;
        } else {
          return {
            ...booking,
            title: 'Booked',
            description: null,
            participants: [],
          };
        }
      });
      
      await createAuditLog(req, 'view', 'booking', undefined, { 
        action: 'view_all_bookings',
        count: bookings.length
      });
      
      res.json(filteredBookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.get('/api/bookings/my', isAuthenticated, async (req: any, res) => {
    try {
      const bookings = await storage.getUserBookings(req.user.id);
      await createAuditLog(req, 'view', 'booking', undefined, { 
        action: 'view_my_bookings_page',
        count: bookings.length
      });
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching user bookings:", error);
      res.status(500).json({ message: "Failed to fetch user bookings" });
    }
  });

  app.get('/api/bookings/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      const user = await storage.getUser(req.user.id);
      if (user?.role !== 'admin' && booking.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await createAuditLog(req, 'view', 'booking', id.toString(), { 
        action: 'view_booking_details',
        bookingTitle: booking.title,
        roomId: booking.roomId
      });
      
      res.json(booking);
    } catch (error) {
      console.error("Error fetching booking:", error);
      res.status(500).json({ message: "Failed to fetch booking" });
    }
  });

  app.post('/api/bookings', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role === 'viewer') {
        return res.status(403).json({ message: "Viewers cannot create bookings" });
      }

      const bookingData = insertBookingSchema.parse({
        ...req.body,
        userId: req.user.id,
      });
      
      // Check for conflicts
      const hasConflict = await storage.checkBookingConflict(
        bookingData.roomId,
        new Date(bookingData.startDateTime),
        new Date(bookingData.endDateTime)
      );
      
      if (hasConflict) {
        return res.status(400).json({ 
          message: "Room is already booked for this time slot. Please choose a different time or room." 
        });
      }
      
      const booking = await storage.createBooking(bookingData);
      await createAuditLog(req, 'create', 'booking', booking.id.toString(), booking);
      
      // Send notification emails to participants
      const participants = Array.isArray(booking.participants) ? booking.participants as string[] : [];
      if (participants.length > 0) {
        try {
          const room = await storage.getRoom(booking.roomId);
          const startDate = new Date(booking.startDateTime);
          const endDate = new Date(booking.endDateTime);
          
          // Get email settings
          const emailSettings = await storage.getEmailSettings();
          if (!emailSettings) {
            console.error('[Email] Email settings not configured. Skipping participant notifications.');
          } else if (!emailSettings.enableBookingNotifications) {
            console.log('[Email] Booking notifications are disabled in settings.');
          } else {
            console.log(`[Email] Sending booking notifications to ${participants.length} participant(s)...`);
            
            const transporter = nodemailer.createTransport({
              host: emailSettings.smtpHost,
              port: emailSettings.smtpPort,
              secure: emailSettings.smtpPort === 465,
              auth: {
                user: emailSettings.smtpUsername,
                pass: emailSettings.smtpPassword,
              },
            });

            // Generate ICS calendar invite
            const icsContent = generateICS({
              title: booking.title,
              description: booking.description || undefined,
              location: room?.name || 'Meeting Room',
              startDateTime: startDate,
              endDateTime: endDate,
              organizerName: `${user?.firstName} ${user?.lastName}`,
              organizerEmail: user?.email || emailSettings.fromEmail,
              attendees: participants,
            });

            // Send email to each participant
            let successCount = 0;
            let failCount = 0;
            
            for (const participantEmail of participants) {
              try {
                // Format date and time properly to avoid timezone conversion issues
                const formatDate = (date: Date) => {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  return `${month}/${day}/${year}`;
                };
                
                const formatTime = (date: Date) => {
                  const hours = date.getHours();
                  const minutes = String(date.getMinutes()).padStart(2, '0');
                  const ampm = hours >= 12 ? 'PM' : 'AM';
                  const displayHours = hours % 12 || 12;
                  return `${displayHours}:${minutes} ${ampm}`;
                };
                
                const emailContent = `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Meeting Invitation</h2>
                    <p>You have been invited to a meeting:</p>
                    <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                      <p style="margin: 8px 0;"><strong>Title:</strong> ${booking.title}</p>
                      <p style="margin: 8px 0;"><strong>Room:</strong> ${room?.name}</p>
                      <p style="margin: 8px 0;"><strong>Date:</strong> ${formatDate(startDate)}</p>
                      <p style="margin: 8px 0;"><strong>Time:</strong> ${formatTime(startDate)} - ${formatTime(endDate)}</p>
                      ${booking.description ? `<p style="margin: 8px 0;"><strong>Description:</strong> ${booking.description}</p>` : ''}
                      <p style="margin: 8px 0;"><strong>Organizer:</strong> ${user?.firstName} ${user?.lastName} (${user?.email})</p>
                    </div>
                    <p style="color: #6b7280; font-size: 14px; margin-top: 16px;">
                      📅 A calendar invite is attached to this email. You can add this meeting to your calendar (Outlook, Google Calendar, etc.) by opening the attachment.
                    </p>
                  </div>
                `;

                await transporter.sendMail({
                  from: `"${emailSettings.fromName}" <${emailSettings.fromEmail}>`,
                  to: participantEmail,
                  subject: `Meeting Invitation: ${booking.title}`,
                  html: emailContent,
                  icalEvent: {
                    method: 'REQUEST',
                    content: icsContent,
                  },
                  attachments: [
                    {
                      filename: 'meeting-invite.ics',
                      content: icsContent,
                      contentType: 'text/calendar; charset=utf-8; method=REQUEST',
                    },
                  ],
                });
                
                successCount++;
                console.log(`[Email] ✓ Successfully sent booking notification to ${participantEmail}`);
              } catch (participantError: any) {
                failCount++;
                console.error(`[Email] ✗ Failed to send notification to ${participantEmail}:`, participantError.message);
              }
            }
            
            console.log(`[Email] Booking notification summary: ${successCount} sent, ${failCount} failed`);
          }
        } catch (emailError: any) {
          console.error('[Email] Error in booking notification process:', emailError.message);
          // Don't fail the booking creation if email fails
        }
      }
      
      res.json(booking);
    } catch (error) {
      console.error("Error creating booking:", error);
      res.status(500).json({ message: "Failed to create booking" });
    }
  });

  app.put('/api/bookings/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      const user = await storage.getUser(req.user.id);
      if (user?.role !== 'admin' && booking.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const parsedUpdates = updateBookingSchema.parse(req.body);
      const updates = {
        ...parsedUpdates,
        startDateTime: new Date(parsedUpdates.startDateTime),
        endDateTime: new Date(parsedUpdates.endDateTime),
      };
      
      const effectiveRemindMe = parsedUpdates.remindMe !== undefined ? parsedUpdates.remindMe : booking.remindMe;
      const effectiveReminderTime = parsedUpdates.reminderTime !== undefined ? parsedUpdates.reminderTime : booking.reminderTime;
      
      const timeOrReminderChanged = 
        booking.startDateTime.getTime() !== updates.startDateTime.getTime() ||
        booking.endDateTime.getTime() !== updates.endDateTime.getTime() ||
        booking.remindMe !== effectiveRemindMe ||
        booking.reminderTime !== effectiveReminderTime;
      
      if (timeOrReminderChanged && effectiveRemindMe) {
        updates.reminderSent = false;
      }
      
      const updatedBooking = await storage.updateBooking(id, updates);
      await createAuditLog(req, 'update', 'booking', id.toString(), updates);
      res.json(updatedBooking);
    } catch (error) {
      console.error("Error updating booking:", error);
      res.status(500).json({ message: "Failed to update booking" });
    }
  });

  app.delete('/api/bookings/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      const user = await storage.getUser(req.user.id);
      if (user?.role !== 'admin' && booking.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const success = await storage.deleteBooking(id);
      if (!success) {
        return res.status(404).json({ message: "Booking not found" });
      }
      await createAuditLog(req, 'delete', 'booking', id.toString());
      res.json({ message: "Booking deleted successfully" });
    } catch (error) {
      console.error("Error deleting booking:", error);
      res.status(500).json({ message: "Failed to delete booking" });
    }
  });

  // User management routes
  // GET all users - accessible to all authenticated users for participant selection
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { email, firstName, lastName, employeeCode, designation, department, role, password, autoGeneratePassword } = req.body;
      
      if (!email || !firstName || !lastName || !role) {
        return res.status(400).json({ message: "All required fields must be provided" });
      }
      
      // Validate password requirements
      if (!autoGeneratePassword && !password) {
        return res.status(400).json({ message: "Password is required when not auto-generating" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      
      // Function to generate random password
      const generatePassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        let password = '';
        for (let i = 0; i < 10; i++) {
          password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
      };
      
      // Generate or use provided password
      const actualPassword = autoGeneratePassword ? generatePassword() : password;
      
      // Hash password
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(actualPassword, 10);
      
      // Generate UUID for new user
      const { v4: uuidv4 } = await import("uuid");
      const newUser = await storage.createUser({
        id: uuidv4(),
        email,
        firstName,
        lastName,
        employeeCode: employeeCode || undefined,
        designation: designation || undefined,
        department: department || undefined,
        role,
        passwordHash,
        isActivated: true,
        mustChangePassword: autoGeneratePassword || false,
      });
      
      await createAuditLog(req, 'create', 'user', newUser.id, { 
        email, 
        firstName, 
        lastName, 
        employeeCode, 
        designation, 
        department, 
        role,
        autoGeneratePassword 
      });
      
      // Send welcome email
      try {
        const emailSettings = await storage.getEmailSettings();
        if (emailSettings && emailSettings.smtpHost) {
          const transporter = nodemailer.createTransport({
            host: emailSettings.smtpHost,
            port: emailSettings.smtpPort || 587,
            secure: emailSettings.smtpPort === 465,
            auth: {
              user: emailSettings.smtpUsername,
              pass: emailSettings.smtpPassword,
            },
          });
          
          let emailContent;
          let subject;
          
          if (autoGeneratePassword) {
            // Send OTP password email
            const loginUrl = `${req.protocol}://${req.get('host')}/`;
            emailContent = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Welcome to Room Booking System</h2>
                <p>Hello ${firstName} ${lastName},</p>
                <p>User created and your one time password is <strong style="font-size: 18px; color: #dc2626;">${actualPassword}</strong></p>
                <p>Here are your account details:</p>
                <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  ${employeeCode ? `<p style="margin: 8px 0;"><strong>Employee Code:</strong> ${employeeCode}</p>` : ''}
                  <p style="margin: 8px 0;"><strong>Email:</strong> ${email}</p>
                  ${designation ? `<p style="margin: 8px 0;"><strong>Designation:</strong> ${designation}</p>` : ''}
                  ${department ? `<p style="margin: 8px 0;"><strong>Department:</strong> ${department}</p>` : ''}
                  <p style="margin: 8px 0;"><strong>Role:</strong> ${role}</p>
                </div>
                <p style="color: #ef4444; font-size: 14px; margin-top: 16px;">
                  <strong>Important:</strong> Please use this one-time password to log in and set your permanent password.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Login to Application</a>
                </div>
                <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #2563eb;">${loginUrl}</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 12px;">
                  If you have any questions, please contact your administrator.<br>
                  Room Booking System
                </p>
              </div>
            `;
            subject = 'Welcome to Room Booking System - Your One Time Password';
          } else {
            // Send activation link email
            const crypto = await import("crypto");
            const activationToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 24 * 3600000);
            
            await storage.createPasswordResetToken({
              userId: newUser.id,
              token: activationToken,
              expiresAt,
            });
            
            const activationUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${activationToken}`;
            
            emailContent = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Welcome to Room Booking System</h2>
                <p>Hello ${firstName} ${lastName},</p>
                <p>Your account has been created successfully. Here are your account details:</p>
                <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  ${employeeCode ? `<p style="margin: 8px 0;"><strong>Employee Code:</strong> ${employeeCode}</p>` : ''}
                  <p style="margin: 8px 0;"><strong>Email:</strong> ${email}</p>
                  ${designation ? `<p style="margin: 8px 0;"><strong>Designation:</strong> ${designation}</p>` : ''}
                  ${department ? `<p style="margin: 8px 0;"><strong>Department:</strong> ${department}</p>` : ''}
                  <p style="margin: 8px 0;"><strong>Role:</strong> ${role}</p>
                </div>
                <p>To activate your account and set your password, please click the button below:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${activationUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Set Your Password</a>
                </div>
                <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #666;">${activationUrl}</p>
                <p style="color: #ef4444; font-size: 14px; margin-top: 16px;">
                  <strong>Important:</strong> This activation link will expire in 24 hours.
                </p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 12px;">
                  If you have any questions, please contact your administrator.<br>
                  Room Booking System
                </p>
              </div>
            `;
            subject = 'Welcome to Room Booking System - Activate Your Account';
          }
          
          await transporter.sendMail({
            from: `"${emailSettings.fromName}" <${emailSettings.fromEmail}>`,
            to: email,
            subject,
            html: emailContent,
          });
          
          console.log(`Welcome email sent to ${email}`);
        }
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
        // Don't fail user creation if email fails
      }
      
      // Remove password hash from response
      const { passwordHash: _, ...userResponse } = newUser;
      res.json({ ...userResponse, autoGenerated: autoGeneratePassword });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.post('/api/users/bulk', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { users: usersData } = req.body;
      
      if (!Array.isArray(usersData) || usersData.length === 0) {
        return res.status(400).json({ message: "Users array is required" });
      }

      const bcrypt = await import("bcrypt");
      const { v4: uuidv4 } = await import("uuid");
      const crypto = await import("crypto");
      
      // Function to generate random password
      const generatePassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        let password = '';
        for (let i = 0; i < 10; i++) {
          password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
      };
      
      const usersToCreate = await Promise.all(
        usersData.map(async (userData: any) => {
          const { email, firstName, lastName, employeeCode, designation, department, role } = userData;
          
          if (!email || !firstName || !lastName || !role) {
            throw new Error(`Missing required fields for user: ${email || 'unknown'}`);
          }
          
          // Auto-generate password
          const generatedPassword = generatePassword();
          const passwordHash = await bcrypt.hash(generatedPassword, 10);
          
          return {
            id: uuidv4(),
            email,
            firstName,
            lastName,
            employeeCode: employeeCode || undefined,
            designation: designation || undefined,
            department: department || undefined,
            role: role || 'user',
            passwordHash,
            isActivated: true,
            mustChangePassword: true,
            generatedPassword, // Store for email
          };
        })
      );
      
      const result = await storage.createBulkUsers(usersToCreate);
      
      await createAuditLog(req, 'create', 'user', undefined, { 
        action: 'bulk_create',
        successCount: result.success.length,
        failedCount: result.failed.length,
      });
      
      // Send welcome emails with OTP passwords for successfully created users
      const emailSettings = await storage.getEmailSettings();
      if (emailSettings && emailSettings.smtpHost) {
        for (const newUser of result.success) {
          try {
            // Find the original user data with generated password
            const userWithPassword = usersToCreate.find(u => u.email === newUser.email);
            if (!userWithPassword || !userWithPassword.generatedPassword) {
              console.error(`No generated password found for ${newUser.email}`);
              continue;
            }
            
            const transporter = nodemailer.createTransport({
              host: emailSettings.smtpHost,
              port: emailSettings.smtpPort || 587,
              secure: emailSettings.smtpPort === 465,
              auth: {
                user: emailSettings.smtpUsername,
                pass: emailSettings.smtpPassword,
              },
            });
            
            const loginUrl = `${req.protocol}://${req.get('host')}/`;
            const emailContent = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Welcome to Room Booking System</h2>
                <p>Hello ${newUser.firstName} ${newUser.lastName},</p>
                <p>User created and your one time password is <strong style="font-size: 18px; color: #dc2626;">${userWithPassword.generatedPassword}</strong></p>
                <p>Here are your account details:</p>
                <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  ${newUser.employeeCode ? `<p style="margin: 8px 0;"><strong>Employee Code:</strong> ${newUser.employeeCode}</p>` : ''}
                  <p style="margin: 8px 0;"><strong>Email:</strong> ${newUser.email}</p>
                  ${newUser.designation ? `<p style="margin: 8px 0;"><strong>Designation:</strong> ${newUser.designation}</p>` : ''}
                  ${newUser.department ? `<p style="margin: 8px 0;"><strong>Department:</strong> ${newUser.department}</p>` : ''}
                  <p style="margin: 8px 0;"><strong>Role:</strong> ${newUser.role}</p>
                </div>
                <p style="color: #ef4444; font-size: 14px; margin-top: 16px;">
                  <strong>Important:</strong> Please use this one-time password to log in and set your permanent password.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Login to Application</a>
                </div>
                <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #2563eb;">${loginUrl}</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 12px;">
                  If you have any questions, please contact your administrator.<br>
                  Room Booking System
                </p>
              </div>
            `;
            
            await transporter.sendMail({
              from: `"${emailSettings.fromName}" <${emailSettings.fromEmail}>`,
              to: newUser.email,
              subject: 'Welcome to Room Booking System - Your One Time Password',
              html: emailContent,
            });
          } catch (emailError) {
            console.error(`Error sending welcome email to ${newUser.email}:`, emailError);
          }
        }
      }
      
      res.json({
        message: `Bulk user creation completed. ${result.success.length} users created successfully, ${result.failed.length} failed.`,
        success: result.success.map(u => ({ ...u, passwordHash: undefined })),
        failed: result.failed,
      });
    } catch (error) {
      console.error("Error in bulk user creation:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create users" });
    }
  });

  app.get('/api/users/template/download', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const csv = `employeeCode,email,firstName,lastName,designation,department,role
EMP001,john.doe@company.com,John,Doe,Senior Manager,IT,admin
EMP002,jane.smith@company.com,Jane,Smith,Developer,Engineering,user
EMP003,bob.jones@company.com,Bob,Jones,Analyst,Finance,user`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=user_upload_template.csv');
      res.send(csv);
    } catch (error) {
      console.error("Error downloading template:", error);
      res.status(500).json({ message: "Failed to download template" });
    }
  });

  app.put('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const id = req.params.id;
      const updates = req.body;
      const updatedUser = await storage.updateUser(id, updates);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      await createAuditLog(req, 'update', 'user', id, updates);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const id = req.params.id;
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      await createAuditLog(req, 'delete', 'user', id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Audit log routes
  app.get('/api/audit-logs', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      
      // Create audit log for viewing audit logs
      await createAuditLog(req, 'view', 'audit-logs', undefined, { 
        userRole: user.role,
        viewType: user.role === 'admin' ? 'all' : 'own'
      });
      
      let logs;
      if (user.role === 'admin') {
        // Admin can see all logs
        logs = await storage.getAuditLogs(limit);
      } else {
        // Regular users can only see their own logs
        logs = await storage.getUserAuditLogs(req.user.id, limit);
      }
      
      console.log('Audit logs response:', logs);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Track audit log actions
  app.post('/api/audit-logs/track', isAuthenticated, async (req: any, res) => {
    try {
      const { action, resourceType, resourceId, details } = req.body;
      
      await createAuditLog(req, action, resourceType, resourceId, details);
      
      res.json({ message: "Action tracked successfully" });
    } catch (error) {
      console.error("Error tracking audit log:", error);
      res.status(500).json({ message: "Failed to track action" });
    }
  });

  // File upload route
  app.post('/api/upload', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // In a real application, you'd upload to a cloud storage service
      res.json({ 
        url: `/uploads/${req.file.filename}`,
        originalName: req.file.originalname,
        size: req.file.size
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // Conflict check route
  app.post('/api/bookings/check-conflict', isAuthenticated, async (req, res) => {
    try {
      const { roomId, startDateTime, endDateTime, excludeBookingId } = req.body;
      
      const hasConflict = await storage.checkBookingConflict(
        roomId,
        new Date(startDateTime),
        new Date(endDateTime),
        excludeBookingId
      );
      
      res.json({ hasConflict });
    } catch (error) {
      console.error("Error checking booking conflict:", error);
      res.status(500).json({ message: "Failed to check booking conflict" });
    }
  });

  // Email settings routes (admin only)
  app.get('/api/email-settings', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const settings = await storage.getEmailSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching email settings:", error);
      res.status(500).json({ message: "Failed to fetch email settings" });
    }
  });

  app.post('/api/email-settings', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const validatedData = insertEmailSettingsSchema.parse(req.body);
      const settings = await storage.upsertEmailSettings(validatedData);
      
      await createAuditLog(req, "update", "email_settings", "1", { 
        action: "Updated email settings",
        changes: validatedData
      });
      
      res.json(settings);
    } catch (error) {
      console.error("Error updating email settings:", error);
      res.status(500).json({ message: "Failed to update email settings" });
    }
  });

  app.post('/api/email-settings/test', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { testEmail } = req.body;
      
      if (!testEmail) {
        return res.status(400).json({ message: "Test email address is required" });
      }
      
      // Get email settings
      const emailSettings = await storage.getEmailSettings();
      if (!emailSettings || !emailSettings.smtpHost) {
        return res.status(400).json({ message: "Email settings not configured. Please configure SMTP settings first." });
      }
      
      // Create transporter with the configured SMTP settings
      const transporter = nodemailer.createTransport({
        host: emailSettings.smtpHost,
        port: emailSettings.smtpPort || 587,
        secure: emailSettings.smtpPort === 465,
        auth: {
          user: emailSettings.smtpUsername,
          pass: emailSettings.smtpPassword,
        },
      });
      
      // Send test email
      await transporter.sendMail({
        from: `"${emailSettings.fromName}" <${emailSettings.fromEmail}>`,
        to: testEmail,
        subject: 'Test Email - Room Booking System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Email Configuration Test</h2>
            <p>This is a test email from your Room Booking System.</p>
            <p>If you received this email, your SMTP settings are configured correctly!</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 14px;">
              Sent from Room Booking System<br>
              Configured by: ${user?.firstName} ${user?.lastName} (${user?.email})
            </p>
          </div>
        `,
      });
      
      res.json({ message: "Test email sent successfully" });
    } catch (error) {
      console.error("Error testing email connection:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Email connection test failed" });
    }
  });

  // User profile routes
  app.put('/api/auth/change-password', isAuthenticated, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }
      
      // Get current user
      const user = await storage.getUser(req.user.id);
      if (!user || !user.passwordHash) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify current password
      const bcrypt = await import("bcrypt");
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      
      // Update password and clear mustChangePassword flag
      await storage.updateUser(req.user.id, { 
        passwordHash: newPasswordHash,
        mustChangePassword: false
      });
      
      await createAuditLog(req, 'update', 'user', req.user.id, { action: "Changed password" });
      
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.put('/api/auth/profile', isAuthenticated, async (req: any, res) => {
    try {
      const { firstName, lastName } = req.body;
      
      if (!firstName || !lastName) {
        return res.status(400).json({ message: "First name and last name are required" });
      }
      
      const updatedUser = await storage.updateUser(req.user.id, { firstName, lastName });
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      await createAuditLog(req, 'update', 'user', req.user.id, { firstName, lastName });
      
      // Remove password hash from response
      const { passwordHash: _, ...userResponse } = updatedUser;
      res.json(userResponse);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Password reset routes
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      console.log('Forgot password request for:', email);
      
      // Generate reset token
      const crypto = await import("crypto");
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour
      
      // Find user by email
      const users = await storage.getAllUsers();
      const user = users.find(u => u.email === email);
      console.log('User lookup for', email, ':', user ? `Found: ${user.email}` : 'Not found');
      
      if (!user) {
        // Don't reveal if user exists or not - but still return success message
        return res.json({ message: "If the email exists, a reset link has been sent" });
      }
      
      await storage.createPasswordResetToken({
        userId: user.id,
        token,
        expiresAt,
      });
      
      // Get email settings to send the reset email
      try {
        console.log('Attempting to get email settings...');
        const emailSettings = await storage.getEmailSettings();
        console.log('Email settings retrieved:', emailSettings ? `Found: ${emailSettings.smtpHost}:${emailSettings.smtpPort}` : 'Not found');
        console.log('Full email settings:', emailSettings);
        if (emailSettings && emailSettings.smtpHost) {
          // Create transporter with the configured SMTP settings
          console.log('Creating email transporter with settings:', {
            host: emailSettings.smtpHost,
            port: emailSettings.smtpPort,
            secure: emailSettings.smtpPort === 465,
            user: emailSettings.smtpUsername
          });
          
          const transporter = nodemailer.createTransport({
            host: emailSettings.smtpHost,
            port: emailSettings.smtpPort || 587,
            secure: emailSettings.smtpPort === 465, // true for 465, false for other ports
            auth: {
              user: emailSettings.smtpUsername,
              pass: emailSettings.smtpPassword,
            },
          });
          
          // Generate reset link
          const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;
          
          // Email content
          const mailOptions = {
            from: `"${emailSettings.fromName}" <${emailSettings.fromEmail}>`,
            to: email,
            subject: 'Password Reset Request - Room Booking System',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Password Reset Request</h2>
                <p>Hello ${user.firstName},</p>
                <p>You requested to reset your password for the Room Booking System. Click the button below to reset your password:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
                </div>
                <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #666;">${resetUrl}</p>
                <p><strong>This link will expire in 1 hour.</strong></p>
                <p>If you didn't request this password reset, please ignore this email.</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">Room Booking System</p>
              </div>
            `,
            text: `
              Password Reset Request
              
              Hello ${user.firstName},
              
              You requested to reset your password for the Room Booking System.
              Please visit this link to reset your password: ${resetUrl}
              
              This link will expire in 1 hour.
              
              If you didn't request this password reset, please ignore this email.
            `
          };
          
          // Send email
          try {
            await transporter.sendMail(mailOptions);
            console.log(`Password reset email sent successfully to ${email} using SMTP: ${emailSettings.smtpHost}:${emailSettings.smtpPort}`);
          } catch (emailError) {
            console.error('Failed to send password reset email:', emailError);
            console.error('SMTP Config:', {
              host: emailSettings.smtpHost,
              port: emailSettings.smtpPort,
              user: emailSettings.smtpUsername
            });
            // Don't throw the error to avoid revealing email configuration details
          }
          
        } else {
          // Log token for development if no email configuration
          console.log(`Password reset token for ${email}: ${token}`);
        }
      } catch (emailError) {
        console.error("Error sending password reset email:", emailError);
        // Don't reveal email sending failure to user for security
      }
      
      res.json({ message: "If the email exists, a reset link has been sent" });
    } catch (error) {
      console.error("Error handling forgot password:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      
      // Find valid reset token
      const resetTokens = await storage.getPasswordResetTokens();
      const resetToken = resetTokens.find(rt => 
        rt.token === token && 
        rt.expiresAt > new Date()
      );
      
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      // Hash new password
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(newPassword, 10);
      
      // Update user password and mark as activated
      await storage.updateUser(resetToken.userId, { passwordHash, isActivated: true });
      
      // Mark token as used
      await storage.markPasswordResetTokenUsed(resetToken.id);
      
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Notification routes
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const notifications = await storage.getAllNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.put('/api/notifications/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const userId = req.user.id;
      
      // Check if notification belongs to user
      const notification = await storage.getNotification(notificationId);
      if (!notification || notification.userId !== userId) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      await storage.markNotificationAsRead(notificationId);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.put('/api/notifications/mark-all-read', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  app.delete('/api/notifications/:id', isAuthenticated, async (req: any, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const userId = req.user.id;
      
      // Check if notification belongs to user
      const notification = await storage.getNotification(notificationId);
      if (!notification || notification.userId !== userId) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      await storage.deleteNotification(notificationId);
      res.json({ message: "Notification deleted successfully" });
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  app.delete('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.deleteAllNotifications(userId);
      res.json({ message: "All notifications deleted successfully" });
    } catch (error) {
      console.error("Error deleting all notifications:", error);
      res.status(500).json({ message: "Failed to delete all notifications" });
    }
  });

  // Analytics routes (admin only)
  app.get('/api/analytics', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { dateRange = '7d', roomId = 'all', utilizationView = 'week' } = req.query;
      
      // Mock analytics data - in production, this would query the database
      // The utilizationView parameter (day/week/month) adjusts the time granularity
      
      // Generate room utilization data based on the view type
      const getRoomUtilizationData = (view: string) => {
        const baseRooms = [
          { name: 'Conference Room A', base: 45 },
          { name: 'Meeting Room B', base: 38 },
          { name: 'Board Room', base: 22 },
          { name: 'Training Room', base: 31 },
          { name: 'Executive Suite', base: 18 },
        ];
        
        // Adjust multipliers based on view type
        const multiplier = view === 'day' ? 0.3 : view === 'month' ? 4.2 : 1;
        
        return baseRooms.map(room => ({
          name: room.name,
          bookings: Math.round(room.base * multiplier),
          utilization: Math.min(95, Math.round((room.base * multiplier * 2.1) % 100)),
          hours: Math.round(room.base * multiplier * 2.3),
        }));
      };
      
      const analyticsData = {
        summary: {
          totalBookings: 245,
          totalBookingsChange: 12.5,
          uniqueUsers: 89,
          uniqueUsersChange: 8.2,
          averageBookingDuration: 2.3,
          averageBookingDurationChange: -5.1,
          peakUtilization: 87,
          peakUtilizationChange: 15.3,
        },
        bookingTrends: [
          { date: '2024-01-01', bookings: 12, duration: 2.1 },
          { date: '2024-01-02', bookings: 15, duration: 2.4 },
          { date: '2024-01-03', bookings: 18, duration: 2.0 },
          { date: '2024-01-04', bookings: 22, duration: 2.6 },
          { date: '2024-01-05', bookings: 19, duration: 2.2 },
          { date: '2024-01-06', bookings: 16, duration: 2.3 },
          { date: '2024-01-07', bookings: 21, duration: 2.5 },
        ],
        roomUtilization: getRoomUtilizationData(utilizationView as string),
        timeDistribution: Array.from({ length: 12 }, (_, i) => ({
          hour: i + 8,
          bookings: Math.floor(Math.random() * 30) + 5,
        })),
        userActivity: [
          { name: 'John Doe', bookings: 15, hours: 32 },
          { name: 'Jane Smith', bookings: 12, hours: 28 },
          { name: 'Mike Johnson', bookings: 10, hours: 25 },
          { name: 'Sarah Wilson', bookings: 8, hours: 18 },
          { name: 'David Brown', bookings: 7, hours: 16 },
        ],
        bookingStatus: [
          { name: 'Confirmed', value: 185, color: '#00C49F' },
          { name: 'Pending', value: 42, color: '#FFBB28' },
          { name: 'Cancelled', value: 18, color: '#FF8042' },
        ],
      };
      
      res.json(analyticsData);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // LDAP email search route
  app.get('/api/ldap/search-emails', isAuthenticated, async (req: any, res) => {
    try {
      const { query = '' } = req.query;
      const emailSettings = await storage.getEmailSettings();
      
      if (!emailSettings || !emailSettings.enableLdap) {
        return res.json([]);
      }

      const { searchLdapUsers } = await import('./ldapHelper');
      const users = await searchLdapUsers(emailSettings, query as string);
      
      res.json(users);
    } catch (error) {
      console.error('Error searching LDAP:', error);
      res.status(500).json({ message: 'Failed to search LDAP directory' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
