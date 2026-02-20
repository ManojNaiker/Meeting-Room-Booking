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
    
    // Check if rooms already exist
    const existingRooms = await storage.getAllRooms();
    
    // Only create rooms if none exist
    if (existingRooms.length === 0) {
      console.log("No rooms found, creating default rooms...");
    
    // Create new default rooms based on the provided list
    const defaultRooms = [
      {
        name: "Galaxy Board Room",
        capacity: 22,
        description: "",
        equipment: ["tv", "mic-speaker", "camera", "telephone", "whiteboard"],
        isActive: true,
        restrictedUsers: [],
      },
      {
        name: "Vega",
        capacity: 4,
        description: "",
        equipment: ["tv", "telephone", "whiteboard"],
        isActive: true,
        restrictedUsers: [],
      },
      {
        name: "Radiant",
        capacity: 6,
        description: "",
        equipment: ["tv", "telephone", "whiteboard"],
        isActive: true,
        restrictedUsers: [],
      },
      {
        name: "Spectrum",
        capacity: 4,
        description: "",
        equipment: ["tv", "telephone", "whiteboard"],
        isActive: true,
        restrictedUsers: [],
      },
      {
        name: "Nova",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
        restrictedUsers: [],
      },
      {
        name: "Starlight",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
        restrictedUsers: [],
      },
      {
        name: "Spark",
        capacity: 6,
        description: "",
        equipment: ["tv", "telephone", "whiteboard"],
        isActive: true,
        restrictedUsers: [],
      },
      {
        name: "Flash",
        capacity: 4,
        description: "",
        equipment: ["tv", "mic-speaker", "camera", "telephone", "whiteboard"],
        isActive: true,
        restrictedUsers: [],
      },
      {
        name: "Harmony",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
        restrictedUsers: [],
      },
      {
        name: "Dawn",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
        restrictedUsers: [],
      },
      {
        name: "Ray",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
        restrictedUsers: [],
      },
      {
        name: "Beam",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
        restrictedUsers: [],
      },
      {
        name: "Zenith",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
        restrictedUsers: [],
      },
      {
        name: "Eclipse",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
        restrictedUsers: [],
      },
      {
        name: "Glow",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
        restrictedUsers: [],
      },
      {
        name: "Orbit",
        capacity: 6,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
        restrictedUsers: [],
      },
      {
        name: "Sunshine",
        capacity: 9,
        description: "",
        equipment: ["tv", "telephone", "whiteboard"],
        isActive: true,
        restrictedUsers: [],
      },
      {
        name: "Firefly",
        capacity: 4,
        description: "",
        equipment: ["telephone", "whiteboard"],
        isActive: true,
        restrictedUsers: [],
      },
    ];
    
    for (const room of defaultRooms) {
      await storage.createRoom(room);
    }
    
    }
    
    return existingAdmin;
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}