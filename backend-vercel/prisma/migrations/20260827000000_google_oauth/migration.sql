-- Connexion Google : le mot de passe devient facultatif pour les comptes
-- crees via Google, et on ajoute l'identifiant Google unique utilise pour
-- retrouver le compte a la reconnexion.
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "googleId" TEXT;
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
