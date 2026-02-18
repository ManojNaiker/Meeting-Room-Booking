import bcrypt from "bcrypt";
import { storage } from "./storage";
import { v4 as uuidv4 } from "uuid";

export async function initializeDatabase() {
  try {
    // Check if admin user exists
    const existingAdmin = await storage.getUserByEmail("admin@company.com");
    
    if (!existingAdmin) {
      // Create default admin user
      const passwordHash = await bcrypt.hash("admin123", 10);
      
      const adminUser = await storage.createUser({
        id: uuidv4(),
        email: "admin@company.com",
        passwordHash,
        firstName: "Admin",
        lastName: "User",
        role: "admin",
      });
      
      console.log("Default admin user created:");
      console.log("Email: admin@company.com");
      console.log("Password: admin123");
      console.log("Please change the password after first login.");
    } else {
      console.log("Admin user already exists");
    }
    
    // Remove all existing rooms and create new default rooms
    const existingRooms = await storage.getAllRooms();
    
    // Delete all existing rooms
    if (existingRooms.length > 0) {
      for (const room of existingRooms) {
        await storage.deleteRoom(room.id);
      }
      console.log(`Removed ${existingRooms.length} existing room(s)`);
    }
    
    // Create new default rooms based on the provided list
    const defaultRooms = [
      {
        name: "Galaxy Board Room",
        capacity: 22,
        description: "",
        equipment: ["tv", "mic-speaker", "camera", "telephone", "whiteboard"],
        isActive: true,
      },
      {
        name: "Vega",
        capacity: 4,
        description: "",
        equipment: ["tv", "telephone", "whiteboard"],
        isActive: true,
      },
      {
        name: "Radiant",
        capacity: 6,
        description: "",
        equipment: ["tv", "telephone", "whiteboard"],
        isActive: true,
      },
      {
        name: "Spectrum",
        capacity: 4,
        description: "",
        equipment: ["tv", "telephone", "whiteboard"],
        isActive: true,
      },
      {
        name: "Nova",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
      },
      {
        name: "Starlight",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
      },
      {
        name: "Spark",
        capacity: 6,
        description: "",
        equipment: ["tv", "telephone", "whiteboard"],
        isActive: true,
      },
      {
        name: "Flash",
        capacity: 4,
        description: "",
        equipment: ["tv", "mic-speaker", "camera", "telephone", "whiteboard"],
        isActive: true,
      },
      {
        name: "Harmony",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
      },
      {
        name: "Dawn",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
      },
      {
        name: "Ray",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
      },
      {
        name: "Beam",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
      },
      {
        name: "Zenith",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
      },
      {
        name: "Eclipse",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
      },
      {
        name: "Glow",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
      },
      {
        name: "Orbit",
        capacity: 6,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
      },
      {
        name: "Sunshine",
        capacity: 9,
        description: "",
        equipment: ["tv", "telephone", "whiteboard"],
        isActive: true,
      },
      {
        name: "Firefly",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
      },
    ];
    
    for (const room of defaultRooms) {
      await storage.createRoom(room);
    }
    
    console.log(`Created ${defaultRooms.length} new default rooms`);
    
    return existingAdmin;
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}