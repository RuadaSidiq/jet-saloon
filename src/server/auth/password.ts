import bcrypt from "bcryptjs";
export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
export const PASSWORD_RULE = { min: 8, message: "Use at least 8 characters, including a letter and a number" };
export const isStrongEnough = (pw: string) => pw.length >= 8 && /[a-z]/i.test(pw) && /\d/.test(pw);
