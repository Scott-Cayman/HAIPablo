ALTER TABLE "ActionTemplate"
ADD COLUMN "enableCustomReferenceUpload" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "allowMultipleCustomReferences" BOOLEAN NOT NULL DEFAULT false;
