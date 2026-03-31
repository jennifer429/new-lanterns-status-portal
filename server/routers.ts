import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { organizationsRouter } from "./routers/organizations";
import { filesRouter } from "./routers/files";
import { webhooksRouter } from "./routers/webhooks";
import { intakeRouter } from "./routers/intake";
import { authRouter } from "./routers/auth";
import { usersRouter } from "./routers/users";
import { adminRouter } from "./routers/admin";
import { validationRouter } from "./routers/validation";
import { implementationRouter } from "./routers/implementation";
import { connectivityRouter } from "./routers/connectivity";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    // Email/password authentication
    ...authRouter._def.procedures,
  }),

  // Feature routers
  admin: adminRouter,
  organizations: organizationsRouter,
  files: filesRouter,
  webhooks: webhooksRouter,
  intake: intakeRouter,
  users: usersRouter,
  validation: validationRouter,
  implementation: implementationRouter,
  connectivity: connectivityRouter,
});

export type AppRouter = typeof appRouter;
