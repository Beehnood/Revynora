require("dotenv").config({ quiet: true });
const { PrismaClient } = require("@prisma/client");
const email = process.argv[2]?.trim().toLowerCase();
if (!email || process.argv[3] !== "--confirm") {
  console.error(
    "Usage: pnpm admin:promote compte@exemple.fr --confirm\nCe compte doit déjà exister. Aucun compte ni mot de passe par défaut ne sera créé.",
  );
  process.exitCode = 1;
} else {
  const db = new PrismaClient();
  (async () => {
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.auditLog.create({
        data: {
          targetUserId: user.id,
          action: "ADMIN_PROMOTED_CLI",
          entityType: "User",
          entityId: user.id,
        },
      });
    });
    console.log(
      "Droits administrateur attribués. Reconnectez-vous avec ce compte.",
    );
  })()
    .catch(() => {
      console.error("Compte introuvable ou base inaccessible.");
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
