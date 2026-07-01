"use server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";
import z from "zod";
import { IUser, updateUserSchema, userSchema } from "@/src/interfaces/User";
//create user
export const createUserAction = action
  .input(userSchema)
  .handler(async ({ input }) => {
    const {
      username,
      email,
      nom,
      postnom,
      prenom,
      dateOfBirth,
      telephone,
      sexe,
      password,
      address,
    } = input;

    const hashedPassword = await bcrypt.hash(password, 10);
    const existUser = await prisma.user.findMany({
      where: {
        OR: [
          {
            email: email,
            username: username,
          },
        ],
      },
    });
    if (existUser.length > 0) {
      throw new Error("L'utilisateur existe deja");
    }
    const sexeMap: Record<string, "M" | "F"> = {
      masculin: "M",
      feminin: "F",
    };
    const user = await prisma.user.create({
      data: {
        username,
        email,
        name,
        postnom,
        prenom,
        dateOfBirth,
        sexe: sexeMap[sexe],
        telephone,
        address,
        password: hashedPassword,
      },
    });

    return user;
  });
//update user
export const updateUserAction = action
  .input(updateUserSchema)
  .handler(async ({ input }) => {
    const {
      username,
      email,
      nom,
      postnom,
      prenom,
      dateOfBirth,
      sexe,
      telephone,
      address,
      password,
    } = input;
    const existUser = await prisma.user.findMany({
      where: {
        username,
      },
    });
    if (existUser.length === 0) {
      throw new Error("L'utilisateur n'existe pas");
    }
    const sexeMap: Record<string, "M" | "F"> = {
      masculin: "M",
      feminin: "F",
    };
    const updatedUser = await prisma.user.update({
      where: {
        id: input.id,
      },
      data: {
        nom,
        postnom,
        prenom,
        dateOfBirth,
        email,
        sexe: sexe ? sexeMap[sexe] : undefined,
        telephone,
        address,
        password: password ? await bcrypt.hash(password, 10) : undefined,
      },
    });
    return updatedUser;
  });

//update user password
export const updateUserPasswordAction = action
  .input(z.object({ username: z.string(), password: z.string() }))
  .handler(async ({ input }) => {
    const { username, password } = input;
    const hashedPassword = await bcrypt.hash(password, 10);

    const existUser = await prisma.user.findMany({
      where: {
        username,
      },
    });
    if (existUser.length < 0) {
      throw new Error("L'utilisateur n'existe pas");
    }
    const updatedUser = await prisma.user.update({
      where: {
        id: existUser[0].id,
        username,
      },
      data: {
        password: hashedPassword,
      },
    });
    return updatedUser;
  });

export const resetUserPasswordAction = action
  .input(z.object({ username: z.string() }))
  .handler(async ({ input }) => {
    const { username } = input;
    const hashedPassword = await bcrypt.hash(username, 10);

    const existUser = await prisma.user.findMany({
      where: {
        username,
      },
    });
    if (existUser.length < 0) {
      throw new Error("L'utilisateur n'existe pas");
    }
    const resetdUser = await prisma.user.update({
      where: {
        id: existUser[0].id,
        username,
      },
      data: {
        password: hashedPassword,
      },
    });
    return resetdUser;
  });
//delete user
export const deleteUserAction = action
  .input(userSchema)
  .handler(async ({ input }) => {
    const { username, email } = input;

    const existUser = await prisma.user.findMany({
      where: {
        OR: [
          {
            email,
            username,
          },
        ],
      },
    });

    if (existUser.length < 0) {
      throw new Error("L'utilisateur n'existe pas");
    }
    const deletedUser = await prisma.user.delete({
      where: {
        id: existUser[0].id,
      },
    });

    return deletedUser;
  });
//get user
export const getUserAction = action
  .input(
    userSchema.omit({
      dateOfBirth: true,
      id: true,
      nom: true,
      password: true,
      postnom: true,
      prenom: true,
      sexe: true,
      telephone: true,
      address: true,
    }),
  )
  .handler(async ({ input }) => {
    const { username, email } = input;

    const existUser = await prisma.user.findMany({
      where: {
        OR: [
          {
            email,
            username,
          },
        ],
      },
    });

    if (existUser.length < 0) {
      throw new Error("L'utilisateur n'existe pas");
    }

    return existUser[0];
  });
//get users
export const getUsersAction = action.handler(async () => {
  const users = await prisma.user.findMany();
  return users;
});
