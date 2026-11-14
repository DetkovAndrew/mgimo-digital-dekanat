-- CreateTable
CREATE TABLE "issued_document" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "verifyToken" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "issuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issued_document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "issued_document_number_key" ON "issued_document"("number");

-- CreateIndex
CREATE UNIQUE INDEX "issued_document_requestId_key" ON "issued_document"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "issued_document_verifyToken_key" ON "issued_document"("verifyToken");

-- AddForeignKey
ALTER TABLE "issued_document" ADD CONSTRAINT "issued_document_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "request"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Дописано вручную (docs/plans/certificates.md).
ALTER TABLE "issued_document" ADD CONSTRAINT "issued_document_kind_known" CHECK ("kind" IN ('study_certificate'));
ALTER TABLE "issued_document" ADD CONSTRAINT "issued_document_token_format" CHECK ("verifyToken" ~ '^[A-Za-z0-9_-]{22}$');
ALTER TABLE "issued_document" ADD CONSTRAINT "issued_document_content_object" CHECK (jsonb_typeof("content") = 'object');

-- Владелец документа определяется через заявку: после выпуска владелец и тип заявки не меняются (ревью Codex 57).
CREATE FUNCTION "request_fixed_after_document"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."studentId" IS DISTINCT FROM OLD."studentId" OR NEW."type" IS DISTINCT FROM OLD."type")
     AND EXISTS (SELECT 1 FROM "issued_document" WHERE "requestId" = OLD."id") THEN
    RAISE EXCEPTION 'request % has an issued document: owner and type are fixed', OLD."id";
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "request_fixed_after_document" BEFORE UPDATE OF "studentId", "type" ON "request"
  FOR EACH ROW EXECUTE FUNCTION "request_fixed_after_document"();
