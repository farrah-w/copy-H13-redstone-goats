import express from "express";
import { Request, Response, NextFunction } from "express";
import { orderCreate, orderCancel, orderConfirm, orderUserSales } from "./app";
import config from "./config.json";
import cors from "cors";
import morgan from "morgan";
import { ErrKind, SessionId, UserId, Err } from './types';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv'; 

import {
  userRegister,
  userLogin,
  // userLogout,
  userDetails,
  // userDetailsUpdate,
} from './user';
import { addToken, clearAll, validToken } from "./dataStore";

const app = express();

// Middleware to parse JSON body
app.use(express.json());

// Middleware to allow access from other domains
app.use(cors());

// Middleware for logging HTTP requests
app.use(morgan("dev"));

const PORT = parseInt(process.env.PORT || config.port);
const HOST = process.env.IP || "127.0.0.1";
const JWT_SECRET = process.env.JWT_SECRET || "r3dSt0nE@Secr3tD00r!";


// ===========================================================================
// ============================= ROUTES BELOW ================================
// ===========================================================================

// Custom middleware
// app.use(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   const token = req.query.token ?? req.body.token ?? req.headers.token;

//   if (token === undefined) {
//     return next(); 
//   }

//   try {
//     const isValid = await validToken(Number(token)); 

//     if (!isValid) {
//       res.status(401).json({ error: 'Token does not refer to a valid, logged-in session' });
//       return; 
//     }

//     req.body.token = Number(token);
//     return next();
//   } catch (err) {
//     res.status(500).json({ error: 'Server error while validating session' });
//     return; 
//   }
// });

// export async function makeFmtToken(userId: number): Promise<{ token: number }> {
//   const sessionId = Math.floor(Math.random() * 1000000); // Generate a numeric session ID
//   const success = await addToken(sessionId, userId);
//   if (!success) {
//     throw new Error('Failed to create session');
//   }
//   return { token: sessionId };
// }
// END Custom middleware

//Custom middleware for JWT
app.use((req: Request, res: Response, next: NextFunction) => {
  // Extract the token from the Authorization header
  const token = req.header('Authorization')?.split(' ')[1];

  if (!token) {
    return next(); // No token provided, continue without interception
  }

  try {
    // Verify and decode the token
    const decoded: any = jwt.verify(token, JWT_SECRET);
    
    req.body.token = decoded.userId;  // Attach the userId from JWT payload to the request body

    next(); // Continue to the next middleware/route
  } catch (error) {
    // Handle error (invalid or expired token)
    res.status(ErrKind.ENOTOKEN).json({ error: 'Token is not valid or expired' });
  }
});

// Function for generating JWT 
function makeJwtToken(userId: number): { token: SessionId } {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour
  return { token: token };
}
//End of Custome middleware for JWT

// app.post('/v1/user/logout', (req: Request, res: Response) => {
//   const token = req.body.token ?? req.headers.token;
//   const result = userLogout(token);
//   res.json(result);
// });

app.post('/v1/user/register', async (req: Request, res: Response) => {
  try {
    const { email, password, nameFirst, nameLast } = req.body;
    const result = await userRegister(email, password, nameFirst, nameLast); 
    const sessionToken = await makeJwtToken(result.userId); 
    res.json(sessionToken);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message }); 
    } else {
      res.status(400).json({ error: 'An unknown error occurred' }); 
    }
  }
});

app.post('/v1/user/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await userLogin(email, password); 
    const sessionToken = await makeJwtToken(result.userId);
    res.json(sessionToken);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message }); 
    } else {
      res.status(400).json({ error: 'An unknown error occurred' }); 
    }
  }
});

app.get('/v1/user/details', async (req: Request, res: Response) => {
  try {
    const userId = req.body.token; // INTERCEPTED!!
    const result = await userDetails(userId);
    res.json(result);
  } catch (err) {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message }); 
    } else {
      res.status(400).json({ error: 'An unknown error occurred' }); 
    }
  }
});

// app.put('/v1/user/details/update', (req: Request, res: Response) => {
//   const { token, email, nameFirst, nameLast } = req.body; // INTERCEPTED!
//   const result = userDetailsUpdate(token, email, nameFirst, nameLast);
//   res.json(result);
// });

app.get("/", (req, res) => {
  res.send("Hello, Express with TypeScript!");
});

// Route that creates an order.
app.post("/v1/order/create", async (req: Request, res: Response) => {
  const order = req.body;
  try {
    const result = await orderCreate(order);
    res.status(201).json(result);
  } catch (error) {
    const e = error as Error;
    if (e.message === 'Invalid userId or a different name is registered to userId' ||
      e.message === 'No userId provided') {
      res.status(401).json({ error: e.message });
    } else {
      res.status(400).json({ error: e.message });
    }
  }
});

// Route that returns user sales data.
app.post("/v1/order/:userId/sales", async (req: Request, res: Response) => {
  const userId = parseInt(req.path);
  const csv = req.query.csv === "true";
  const json = req.query.json === "true";
  const pdf = req.query.pdf === "true";
  try {
    const result = await orderUserSales(csv, json, pdf, userId);
    res.status(200).json(result);
  } catch (error) {
    const e = error as Error;
    if (e.message === 'Invalid sellerId' || e.message === 'No sellerId provided') {
      res.status(401).json({ error: e.message });
    } else {
      res.status(400).json({ error: e.message });
    }
  }
});

// app.put("/v1/:userId/order/:orderId/cancel", (req: Request, res: Response) => {
//   try {
//     const { userId, orderId } = req.params;
//     const { reason } = req.body;

//     const result = orderCancel(Number(userId), Number(orderId), reason);
//     res.json(result);
//   } catch (error) {
//     let statusCode: number;
//     const e = error as Error;
//     if (e.message === "invalid orderId" || e.message === "invalid userId") {
//       statusCode = 401;
//     } else if (e.message === "order already cancelled") {
//       statusCode = 400;
//     } else {
//       statusCode = 404;
//     }
//     res.status(statusCode).json({ error: e.message });
//   }
// });

// app.post(
//   "/v1/:userId/order/:orderId/confirm",
//   (req: Request, res: Response) => {
//     try {
//       const { userId, orderId } = req.params;

//       const result = orderConfirm(Number(userId), Number(orderId));
//       res.json(result);
//     } catch (error) {
//       let statusCode: number;
//       const e = error as Error;
//       if (e.message === "invalid orderId" || e.message === "invalid userId") {
//         statusCode = 401;
//       } else if (e.message === "order not found") {
//         statusCode = 400;
//       } else {
//         statusCode = 404;
//       }
//       res.status(statusCode).json({ error: e.message });
//     }
//   }
// );

app.delete('/v1/clear', async (_: Request, res: Response) => {
  res.json(await clearAll());
});

// Custom **error handling** middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  err instanceof Err ? res.status(err.kind.valueOf()).json({ error: err.message }) : next();
});

// ===========================================================================
// ============================= ROUTES ABOVE ================================
// ===========================================================================

const server = app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
});

// Graceful shutdown handling
process.on("SIGINT", () => {
  server.close(() => {
    console.log("Shutting down server gracefully.");
    process.exit();
  });
});
