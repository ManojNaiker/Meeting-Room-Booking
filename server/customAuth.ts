import bcrypt from "bcrypt";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import passport from "passport";
import { Strategy as SamlStrategy } from "@node-saml/passport-saml";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: process.env.SESSION_SECRET || "replit-dev-secret-key-change-in-production",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Initialize SAML strategy if enabled
  const emailSettings = await storage.getEmailSettings();
  if (emailSettings?.enableSso && emailSettings.samlEntryPoint) {
    console.log("[SAML] Configuring SAML Strategy with Skillmine...");
    const samlStrategy = new SamlStrategy(
      {
        callbackUrl: "/api/auth/saml/callback",
        entryPoint: emailSettings.samlEntryPoint,
        issuer: emailSettings.samlIssuer || "Skillmine",
        cert: emailSettings.samlCert || "",
      } as any,
      ((profile: any, done: any) => {
        const email = profile.email || profile.nameID || profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"];
        if (!email) {
          return done(new Error("Email not found in SAML profile"));
        }

        (async () => {
          try {
            let user = await storage.getUserByEmail(email);
            if (!user) {
              console.log(`[SAML] User ${email} not found, creating new account...`);
              const { v4: uuidv4 } = await import("uuid");
              user = await storage.createUser({
                id: uuidv4(),
                email: email,
                firstName: profile.firstName || profile.givenName || "SSO",
                lastName: profile.lastName || profile.surname || "User",
                role: "user",
                passwordHash: "SSO_AUTH_ONLY",
                isActivated: true,
                mustChangePassword: false,
                employeeCode: null,
                designation: null,
                department: null,
                profileImageUrl: null,
              });
            }

            return done(null, user);
          } catch (err) {
            return done(err);
          }
        })();
      }) as any,
      ((profile: any, done: any) => {
        done(null, profile);
      }) as any
    );
    passport.use("saml", samlStrategy as any);

    // SAML routes
    app.get("/api/auth/saml/login", (req, res) => {
      // Direct redirect to the SSO provider
      res.redirect("https://lmplauth-sso.lightfinance.com/");
    });

    app.post(
      "/api/auth/saml/callback",
      (req, res, next) => {
        // Since we are redirecting externally, we need to ensure the callback
        // still uses the SAML strategy for validation if the provider posts back here.
        passport.authenticate("saml", { failureRedirect: "/login", failureFlash: false })(req, res, next);
      },
      async (req: any, res) => {
        // Create session compatible with existing auth
        req.session.user = {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
        };
        
        await storage.createAuditLog({
          userId: req.user.id,
          action: 'login',
          resourceType: 'user',
          resourceId: req.user.id,
          details: { email: req.user.email, method: 'saml' },
        });

        res.redirect("/");
      }
    );

    app.get("/api/auth/saml/metadata", (req, res) => {
      res.type("application/xml");
      res.status(200).send(
        samlStrategy.generateServiceProviderMetadata(emailSettings.samlCert || "")
      );
    });
  }

  // Custom login endpoint
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check password
      const isValid = await bcrypt.compare(password, user.passwordHash || "");
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if user is activated (except for admin users created before activation system)
      if (user.isActivated === false && user.role !== 'admin') {
        return res.status(403).json({ 
          message: "Please activate your account using the link sent to your email before logging in" 
        });
      }

      // Create session
      (req.session as any).user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      // Log successful login
      await storage.createAuditLog({
        userId: user.id,
        action: 'login',
        resourceType: 'user',
        resourceId: user.id,
        details: { email: user.email },
      });

      res.json({ 
        user: { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          mustChangePassword: user.mustChangePassword || false
        } 
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });




}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = (req.session as any)?.user;
  
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Attach user to request for use in other routes
  req.user = user;
  next();
};