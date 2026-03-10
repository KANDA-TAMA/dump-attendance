import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email?: string | null;
      role: string;
      employeeId: string;
    };
  }

  interface User {
    role: string;
    employeeId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    employeeId: string;
  }
}
