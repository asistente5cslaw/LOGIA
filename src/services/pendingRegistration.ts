let password: string | null = null;

export const pendingRegistration = {
  setPassword(value: string) {
    password = value;
  },
  getPassword(): string | null {
    return password;
  },
  clear() {
    password = null;
  },
};
