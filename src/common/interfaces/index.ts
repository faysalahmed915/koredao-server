export interface RequestWithUser {
  user: {
    id: string;
    role: string;
    email: string;
    image?: string;
  };
}