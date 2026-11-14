// Электронная справка с QR (docs/plans/certificates.md, ревью Codex 57): выпуск при «Готово», гонки, скачивание A/B,
// открытая проверка только разрешённых полей.
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/requests/[id]/document/route";
import { formatDocumentNumber, shortName, VERIFY_TOKEN } from "@/lib/documents/certificate";
import { prisma } from "@/server/db";
import { verifyCertificate } from "@/server/dal/documents";
import { cancelMyRequest, getMyRequest, listMyRequests } from "@/server/dal/requests";
import { changeFacultyRequest } from "@/server/dal/staff";
import { renderCertificatePdf } from "@/server/documents/pdf";
import { takeVerifySlot } from "@/server/documents/verify-limit";
import * as session from "@/server/session";
import { actAs, expect404 } from "./helpers";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn(), studentForApi: vi.fn() }));

type Student = Awaited<ReturnType<typeof actAs>>;
let staff: session.StaffContext;
let foreignStaff: session.StaffContext;
let A: Student;
let B: Student;
let nameA: string;
const requestIds: string[] = [];
const testUsers: string[] = [];

beforeAll(async () => {
  const user = await prisma.user.findFirstOrThrow({ where: { username: "dekanat.fhb" }, include: { staff: true } });
  staff = { userId: user.id, staffId: user.staff!.id, facultyCode: user.staff!.facultyCode };
  const own = await prisma.studentProfile.findMany({ where: { group: { facultyCode: staff.facultyCode } }, include: { user: true }, take: 2 });
  A = await actAs(own[0].user.username!);
  B = await actAs(own[1].user.username!);
  nameA = own[0].user.name;
  const foreign = await prisma.faculty.findFirstOrThrow({ where: { code: { not: staff.facultyCode } } });
  const id = randomUUID();
  await prisma.user.create({ data: { id, name: "Сотрудник другого факультета", email: `${id}@test.example`, role: "staff" } });
  testUsers.push(id);
  const profile = await prisma.staffProfile.create({ data: { userId: id, position: "Сотрудник деканата", facultyCode: foreign.code } });
  foreignStaff = { userId: id, staffId: profile.id, facultyCode: foreign.code };
});

beforeEach(() => {
  vi.mocked(session.requireStaff).mockResolvedValue(staff);
  vi.mocked(session.requireStudent).mockResolvedValue(A);
  vi.mocked(session.studentForApi).mockResolvedValue({ ok: true, student: A });
});

afterAll(async () => {
  await prisma.request.deleteMany({ where: { id: { in: requestIds } } });
  await prisma.user.update({ where: { id: A.userId }, data: { name: nameA } });
  await prisma.user.deleteMany({ where: { id: { in: testUsers } } });
  await prisma.$disconnect();
});

async function makeRequest(o: { owner?: Student; type?: string; payload?: object; status?: "SUBMITTED" | "IN_PROGRESS" } = {}) {
  const owner = o.owner ?? A;
  const status = o.status ?? "IN_PROGRESS";
  const r = await prisma.request.create({
    data: {
      studentId: owner.studentId, type: o.type ?? "study_certificate", status,
      payload: o.payload ?? { destination: "По месту работы (ООО «Пример»)", format: "electronic", copies: 1 },
      events: { create: { fromStatus: null, toStatus: status, actorType: "STUDENT", actorUserId: owner.userId } },
    },
  });
  requestIds.push(r.id);
  return r;
}
const ready = (id: string) => changeFacultyRequest({ id, fromStatus: "IN_PROGRESS", toStatus: "READY", comment: "" });
const docOf = (requestId: string) => prisma.issuedDocument.findUnique({ where: { requestId } });
const download = (id: string) => GET(new Request(`http://localhost/api/requests/${id}/document`), { params: Promise.resolve({ id }) });

describe("справка: выпуск при «Готово»", () => {
  it("электронная справка об обучении — один документ со снимком и уведомление с номером", async () => {
    const r = await makeRequest();
    expect(await ready(r.id)).toMatchObject({ ok: true });
    const doc = await docOf(r.id);
    expect(doc).not.toBeNull();
    expect(doc!.verifyToken).toMatch(VERIFY_TOKEN);
    expect(doc!.content).toMatchObject({ v: 1, fullName: nameA, destination: "По месту работы (ООО «Пример»)" });
    const n = await prisma.notification.findFirstOrThrow({ where: { requestId: r.id }, orderBy: { publishedAt: "desc" } });
    expect(n.body).toContain(`Справка ${formatDocumentNumber(doc!.number)}`);
    expect(n.body).not.toContain(doc!.verifyToken); // токен — только в своей заявке
  });

  it("бумажная справка и другие виды документов — без PDF", async () => {
    const paper = await makeRequest({ payload: { destination: "Военкомат", format: "paper", copies: 2 } });
    const other = await makeRequest({ type: "scholarship_certificate", payload: { periodFrom: "2026-09", periodTo: "2026-10", destination: "Соцзащита", format: "electronic" } });
    expect(await ready(paper.id)).toMatchObject({ ok: true });
    expect(await ready(other.id)).toMatchObject({ ok: true });
    expect(await docOf(paper.id)).toBeNull();
    expect(await docOf(other.id)).toBeNull();
  });

  it("«Выдана» после «Готово» не меняет номер, токен и снимок", async () => {
    const r = await makeRequest();
    await ready(r.id);
    const before = await docOf(r.id);
    expect(await changeFacultyRequest({ id: r.id, fromStatus: "READY", toStatus: "DONE", comment: "" })).toMatchObject({ ok: true });
    expect(await docOf(r.id)).toEqual(before);
  });

  it("неполный профиль — отказ без записей: статус, история и документ не меняются", async () => {
    const r = await makeRequest({ payload: { format: "electronic", copies: 1 } }); // нет «куда предоставить»
    expect(await ready(r.id)).toMatchObject({ ok: false });
    expect(await prisma.request.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ status: "IN_PROGRESS" });
    expect(await prisma.requestEvent.count({ where: { requestId: r.id } })).toBe(1);
    expect(await docOf(r.id)).toBeNull();
  });

  it("сбой выпуска после смены статуса откатывает всё: статус, событие, уведомление, документ", async () => {
    const r = await makeRequest();
    // Временный триггер только на тестовой БД и только для этой заявки (ревью Codex 58).
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "test_fail_document"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW."requestId" = '${r.id}' THEN RAISE EXCEPTION 'forced failure'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "test_fail_document" BEFORE INSERT ON "issued_document" FOR EACH ROW EXECUTE FUNCTION "test_fail_document"()`);
    try {
      await expect(ready(r.id)).rejects.toThrow();
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER "test_fail_document" ON "issued_document"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION "test_fail_document"()`);
    }
    expect(await prisma.request.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ status: "IN_PROGRESS" });
    expect(await prisma.requestEvent.count({ where: { requestId: r.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { requestId: r.id } })).toBe(0);
    expect(await docOf(r.id)).toBeNull();
  });

  it("сотрудник другого факультета — 404 без документа и смены статуса", async () => {
    const r = await makeRequest();
    vi.mocked(session.requireStaff).mockResolvedValue(foreignStaff);
    await expect404(ready(r.id));
    expect(await docOf(r.id)).toBeNull();
    expect(await prisma.request.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ status: "IN_PROGRESS" });
  });
});

describe("справка: гонки", () => {
  it("два одновременных «Готово» — одна справка", async () => {
    const r = await makeRequest();
    const results = await Promise.all([ready(r.id), ready(r.id)]);
    expect(results.filter((x) => x.ok)).toHaveLength(1);
    expect(await prisma.issuedDocument.count({ where: { requestId: r.id } })).toBe(1);
  });

  it("отзыв студентом против «Готово»: справка есть только если победило «Готово»", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await makeRequest();
      await Promise.all([cancelMyRequest(r.id), ready(r.id)]);
      const { status } = await prisma.request.findUniqueOrThrow({ where: { id: r.id } });
      expect(["READY", "CANCELLED"]).toContain(status);
      expect(await prisma.issuedDocument.count({ where: { requestId: r.id } })).toBe(status === "READY" ? 1 : 0);
    }
  });

  it("после выпуска владелец и тип заявки в БД не меняются", async () => {
    const r = await makeRequest();
    await ready(r.id);
    await expect(prisma.request.update({ where: { id: r.id }, data: { studentId: B.studentId } })).rejects.toThrow();
    await expect(prisma.request.update({ where: { id: r.id }, data: { type: "transcript" } })).rejects.toThrow();
    expect(await prisma.request.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ studentId: A.studentId, type: "study_certificate" });
  });
});

describe("справка: скачивание и заявка", () => {
  it("A скачивает свой PDF; B — 404; без сессии — 401; сотрудник — 403", async () => {
    const r = await makeRequest();
    await ready(r.id);
    const doc = (await docOf(r.id))!;

    const res = await download(r.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="spravka-S-\d{6}\.pdf"; filename\*=UTF-8''/);
    const pdf = await PDFDocument.load(new Uint8Array(await res.arrayBuffer()));
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe(`Справка об обучении ${formatDocumentNumber(doc.number)}`);

    vi.mocked(session.studentForApi).mockResolvedValue({ ok: true, student: B });
    const foreign = await download(r.id);
    expect(foreign.status).toBe(404);
    expect(foreign.headers.get("cache-control")).toBe("private, no-store");
    expect((await download("nope")).status).toBe(404);
    for (const status of [401, 403] as const) {
      vi.mocked(session.studentForApi).mockResolvedValue({ ok: false, status });
      expect((await download(r.id)).status).toBe(status);
    }
  });

  it("токен виден только в своей заявке: не в списке заявок и не у чужого студента", async () => {
    const r = await makeRequest();
    await ready(r.id);
    const doc = (await docOf(r.id))!;
    expect((await getMyRequest(r.id)).document).toMatchObject({ number: doc.number, verifyToken: doc.verifyToken });
    expect(JSON.stringify(await listMyRequests())).not.toContain(doc.verifyToken);
    vi.mocked(session.requireStudent).mockResolvedValue(B);
    await expect404(getMyRequest(r.id));
  });
});

describe("справка: открытая проверка", () => {
  it("по токену — только разрешённые поля из снимка; изменения профиля после выдачи не видны", async () => {
    const r = await makeRequest();
    await ready(r.id);
    const doc = (await docOf(r.id))!;
    const profile = await prisma.studentProfile.findUniqueOrThrow({ where: { id: A.studentId }, include: { group: true } });
    await prisma.user.update({ where: { id: A.userId }, data: { name: "Переименованная Студентка Тестовна" } });

    const v = await verifyCertificate(doc.verifyToken);
    expect(v).toEqual({
      number: formatDocumentNumber(doc.number), title: "Справка об обучении", issuedAt: doc.issuedAt,
      holder: shortName(nameA), faculty: expect.any(String), course: profile.group.course, studyForm: profile.studyForm,
    });
    const text = JSON.stringify(v);
    for (const secret of [profile.recordBookNumber, profile.group.code, profile.funding, A.studentId, r.id, doc.id, doc.verifyToken, nameA]) {
      expect(text).not.toContain(secret);
    }
    await prisma.user.update({ where: { id: A.userId }, data: { name: nameA } });
  });

  it("неизвестный, изменённый и битый токен — одинаково null", async () => {
    const r = await makeRequest();
    await ready(r.id);
    const token = (await docOf(r.id))!.verifyToken;
    const changed = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    for (const bad of [changed, "AAAAAAAAAAAAAAAAAAAAAA", token.slice(1), `${token}x`, "../../api/health", "", 42, null]) {
      expect(await verifyCertificate(bad)).toBeNull();
    }
  });

  it("лимит проверок: 30 в минуту с одного адреса, другие адреса не страдают", () => {
    const now = 1_000_000;
    for (let i = 0; i < 30; i++) expect(takeVerifySlot("198.51.100.7", now)).toBe(true);
    expect(takeVerifySlot("198.51.100.7", now)).toBe(false);
    expect(takeVerifySlot("198.51.100.8", now)).toBe(true);
    expect(takeVerifySlot("198.51.100.7", now + 61_000)).toBe(true);
  });
});

describe("справка: PDF", () => {
  it("длинные строки, управляющие символы и эмодзи — одна страница, без падения", async () => {
    const bytes = await renderCertificatePdf({
      number: "С-000001",
      issuedAt: new Date("2026-11-14T09:00:00Z"),
      verifyUrl: "https://university-dekanat.duckdns.org/verify/AbCdEfGhIjKlMnOpQrStUv",
      content: {
        v: 1, fullName: "Очень-Длинная-Фамилия-Через-Дефисы Имя Отчество", faculty: "Ф".repeat(200), program: "Программа\u0007 с переносом",
        profile: null, level: "бакалавриат", course: 4, group: "P3212", studyForm: "очная", funding: "договор",
        enrolledAt: "2023-09-01", destination: `${"Слово ".repeat(40)}😀 中文`,
      },
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getCreationDate()?.toISOString()).toBe("2026-11-14T09:00:00.000Z");
  });

  it("все поля по 200 символов: таблица не заходит на блок проверки (иначе рендер бросает ошибку)", async () => {
    const long = (k: string) => `Длинноезначение ${k} `.repeat(20).slice(0, 200);
    const bytes = await renderCertificatePdf({
      number: "С-000002",
      issuedAt: new Date("2026-11-14T09:00:00Z"),
      verifyUrl: "https://university-dekanat.duckdns.org/verify/AbCdEfGhIjKlMnOpQrStUv",
      content: {
        v: 1, fullName: long("fullName"), faculty: long("faculty"), program: long("program"), profile: long("profile"),
        level: long("level"), course: 6, group: long("group"), studyForm: long("studyForm"), funding: long("funding"),
        enrolledAt: "2020-09-01", destination: long("destination"),
      },
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
