// User management (ADMIN only). Not enumerated with its own request/
// response shapes in CONTRACT.md's "REST API surface" section, but the
// roles section explicitly grants ADMIN "manage users (create/deactivate,
// change roles)" and the frontend's /users page (app/(app)/users/page.js)
// is built against GET/POST /api/users + PUT /api/users/[id] following the
// same conventions used everywhere else in the contract — so that's the
// shape implemented here. See final report for this noted as a deviation.
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";

const VALID_ROLES = ["ADMIN", "MANAGER", "STAFF", "VIEWER"];

function sanitize(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

export async function listUsers() {
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  return users.map(sanitize);
}

export async function createUser(data) {
  const username = data?.username?.trim();
  const name = data?.name?.trim();
  const password = data?.password;
  const role = data?.role || "STAFF";

  if (!username || !name || !password) {
    throw new ApiError(400, "username, name and password are required");
  }
  if (!VALID_ROLES.includes(role)) {
    throw new ApiError(400, `role must be one of ${VALID_ROLES.join(", ")}`);
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    throw new ApiError(409, `Username "${username}" is already taken`);
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { username, name, passwordHash, role },
  });
  return sanitize(user);
}

export async function updateUser(id, data, currentUserId) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "User not found");

  const updateData = {};

  if ("name" in data) {
    if (!data.name?.trim()) throw new ApiError(400, "name cannot be empty");
    updateData.name = data.name.trim();
  }

  if ("role" in data) {
    if (!VALID_ROLES.includes(data.role)) {
      throw new ApiError(400, `role must be one of ${VALID_ROLES.join(", ")}`);
    }
    // Demoting the last remaining active ADMIN away from ADMIN would lock
    // the app out of admin access entirely (nobody left who could promote
    // anyone back) — block it the same way deactivating the last admin is
    // blocked below, including when an admin does this to their own account.
    if (data.role !== "ADMIN" && existing.role === "ADMIN" && existing.isActive) {
      const activeAdmins = await prisma.user.count({
        where: { role: "ADMIN", isActive: true },
      });
      if (activeAdmins <= 1) {
        throw new ApiError(409, "Cannot change the role of the last active admin");
      }
    }
    updateData.role = data.role;
  }

  if ("password" in data && data.password) {
    updateData.passwordHash = await hashPassword(data.password);
  }

  if ("isActive" in data) {
    if (data.isActive === false && id === currentUserId) {
      throw new ApiError(400, "You cannot deactivate your own account");
    }
    if (data.isActive === false && existing.role === "ADMIN") {
      const activeAdmins = await prisma.user.count({
        where: { role: "ADMIN", isActive: true },
      });
      if (activeAdmins <= 1) {
        throw new ApiError(409, "Cannot deactivate the last active admin");
      }
    }
    updateData.isActive = Boolean(data.isActive);
  }

  const user = await prisma.user.update({ where: { id }, data: updateData });
  return sanitize(user);
}
