/* eslint-disable @next/next/no-img-element */
import { schoolConfig } from "@/lib/config"

export type AdmissionPrintDocumentData = {
  student: {
    registrationNumber?: string
    name?: string
    className?: string
    section?: string
    rollNumber?: string
    dateOfBirth?: string
    dateOfAdmission?: string
    gender?: string
    aadhaar?: string
    pen?: string
    lastInstitution?: string
    tcNumber?: string
    address?: string
    mobile?: string[]
    email?: string[]
    fatherName?: string
    fatherAadhaar?: string
    motherName?: string
    motherAadhaar?: string
    photoSrc?: string
    documents?: {
      type?: string
      documentNumber?: string
      imageSrc?: string
    }[]
  }
  meta?: {
    printedAtIso?: string
  }
}

function toBoxChars(text?: string) {
  return (text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split("")
}

function BoxRow({
  value,
  cells = 25,
  cellWidthPx = 16,
  gapPx = 2,
}: {
  value?: string
  cells?: number
  cellWidthPx?: number
  gapPx?: number
}) {
  const chars = toBoxChars(value)
  const clipped = chars.slice(0, cells)
  const padded = [...clipped, ...Array(Math.max(0, cells - clipped.length)).fill("")]

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${cells}, ${cellWidthPx}px)`,
        gap: `${gapPx}px`,
      }}
    >
      {padded.map((ch, idx) => (
        <div
          key={idx}
          className="h-6 border border-slate-500 bg-white flex items-center justify-center px-0.5 text-[12px] text-slate-900"
        >
          {ch === " " ? "" : ch}
        </div>
      ))}
    </div>
  )
}

function DottedLineField({ value }: { value?: string }) {
  return (
    <div className="relative h-6">
      <div className="absolute inset-x-0 bottom-[5px] border-b border-dotted border-slate-500" />
      <div className="absolute inset-x-0 bottom-[2px] px-1 text-[12px] text-slate-900">{value || ""}</div>
    </div>
  )
}

function DateBoxes({ iso }: { iso?: string }) {
  const d = iso ? new Date(iso) : null
  const ok = d && !Number.isNaN(d.getTime())
  const dd = ok ? String(d.getDate()).padStart(2, "0") : ""
  const mm = ok ? String(d.getMonth() + 1).padStart(2, "0") : ""
  const yyyy = ok ? String(d.getFullYear()) : ""

  return (
    <div className="flex items-center gap-3">
      <BoxRow value={dd} cells={2} cellWidthPx={20} gapPx={2} />
      <BoxRow value={mm} cells={2} cellWidthPx={20} gapPx={2} />
      <BoxRow value={yyyy} cells={4} cellWidthPx={20} gapPx={2} />
    </div>
  )
}

export function AdmissionPrintDocument({ data }: { data: AdmissionPrintDocumentData }) {
  const schoolFullName = schoolConfig.name || schoolConfig.shortName || ""
  const schoolAddress = schoolConfig.address || ""
  const documents = data.student.documents || []
  const printedAt = data.meta?.printedAtIso ? new Date(data.meta.printedAtIso) : null
  const printedAtText = printedAt ? printedAt.toLocaleString() : ""

  const admissionDateText = data.student.dateOfAdmission
    ? (() => {
        const d = new Date(data.student.dateOfAdmission)
        return Number.isNaN(d.getTime()) ? data.student.dateOfAdmission : d.toLocaleDateString()
      })()
    : ""

  return (
    <div className="w-full text-slate-900" style={{ fontFamily: "Times New Roman, Times, serif", background: "#ffffff" }}>
      <div className="px-10 py-8">
        <div className="relative">
          <div className="flex flex-col items-center text-center">
            <img src="/logo.jpeg" alt={schoolFullName || "School logo"} className="h-20 w-20 object-contain" loading="eager" />
            <div className="text-[32px] font-bold tracking-tight">{schoolFullName || " "}</div>
            <div className="mt-1 text-[18px] font-semibold">{schoolAddress || " "}</div>
          </div>

          <div className="absolute right-0 top-0">
            <div className="h-[125px] w-[105px] border border-slate-600 bg-transparent flex items-center justify-center overflow-hidden">
              {data.student.photoSrc ? (
                <img
                  src={data.student.photoSrc}
                  alt={data.student.name ? `${data.student.name} photo` : "Student photo"}
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-12 gap-10 items-start">
          <div className="col-span-6">
            <div className="text-[14px]">Form Number</div>
            <div className="mt-1">
              <DottedLineField value={data.student.registrationNumber} />
            </div>
          </div>
          <div className="col-span-6">
            <div className="text-[14px]">Date of Admission</div>
            <div className="mt-1">
              <DottedLineField value={admissionDateText} />
            </div>
          </div>
        </div>

        <div className="mt-5 border border-slate-600">
          <div className="grid grid-cols-12">
            <div className="col-span-3 border-r border-slate-600 px-3 py-3 text-[14px]">Name of the Scholar</div>
            <div className="col-span-9">
              <div className="grid grid-cols-12 border-b border-slate-600">
                <div className="col-span-2 border-r border-slate-600 px-2 py-2 text-[12px]">in English</div>
                <div className="col-span-10">
                  <BoxRow value={data.student.name} cells={22} />
                </div>
              </div>
              <div className="grid grid-cols-12">
                <div className="col-span-2 border-r border-slate-600 px-2 py-2 text-[12px]">in Hindi</div>
                <div className="col-span-10">
                  <BoxRow value={""} cells={22} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 border-t border-slate-600">
            <div className="col-span-3 border-r border-slate-600 px-3 py-3 text-[14px]">Father&apos;s Name</div>
            <div className="col-span-9">
              <div className="grid grid-cols-12 border-b border-slate-600">
                <div className="col-span-2 border-r border-slate-600 px-2 py-2 text-[12px]">in English</div>
                <div className="col-span-10">
                  <BoxRow value={data.student.fatherName} cells={22} />
                </div>
              </div>
              <div className="grid grid-cols-12">
                <div className="col-span-2 border-r border-slate-600 px-2 py-2 text-[12px]">in Hindi</div>
                <div className="col-span-10">
                  <BoxRow value={""} cells={22} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 border-t border-slate-600">
            <div className="col-span-3 border-r border-slate-600 px-3 py-3 text-[14px]">Mother&apos;s Name</div>
            <div className="col-span-9">
              <div className="grid grid-cols-12 border-b border-slate-600">
                <div className="col-span-2 border-r border-slate-600 px-2 py-2 text-[12px]">in English</div>
                <div className="col-span-10">
                  <BoxRow value={data.student.motherName} cells={22} />
                </div>
              </div>
              <div className="grid grid-cols-12">
                <div className="col-span-2 border-r border-slate-600 px-2 py-2 text-[12px]">in Hindi</div>
                <div className="col-span-10">
                  <BoxRow value={""} cells={22} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 border-t border-slate-600">
            <div className="col-span-3 border-r border-slate-600 px-3 py-3 text-[14px]">Guardian&apos;s Name</div>
            <div className="col-span-9">
              <div className="grid grid-cols-12 border-b border-slate-600">
                <div className="col-span-2 border-r border-slate-600 px-2 py-2 text-[12px]">in English</div>
                <div className="col-span-10">
                  <BoxRow value={""} cells={22} />
                </div>
              </div>
              <div className="grid grid-cols-12">
                <div className="col-span-2 border-r border-slate-600 px-2 py-2 text-[12px]">in Hindi</div>
                <div className="col-span-10">
                  <BoxRow value={""} cells={22} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4 text-[14px]">
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-2">Address :</div>
            <div className="col-span-10">
              <DottedLineField value={data.student.address} />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-2">Mobile No :</div>
            <div className="col-span-4">
              <DottedLineField value={data.student.mobile?.filter(Boolean).join(", ")} />
            </div>
            <div className="col-span-2">Email :</div>
            <div className="col-span-4">
              <DottedLineField value={data.student.email?.filter(Boolean).join(", ")} />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-3">Religion &amp; Caste :</div>
            <div className="col-span-5">
              <DottedLineField value={""} />
            </div>
            <div className="col-span-2">Nationality :</div>
            <div className="col-span-2">
              <DottedLineField value={""} />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3 items-center">
            <div className="col-span-3">Scholar&apos;s Date of Birth :</div>
            <div className="col-span-9">
              <DateBoxes iso={data.student.dateOfBirth} />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-4">Last Institution Attended :</div>
            <div className="col-span-8">
              <DottedLineField value={data.student.lastInstitution} />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-5">Class to which admission is sought :</div>
            <div className="col-span-7">
              <DottedLineField value={[data.student.className, data.student.section ? `(${data.student.section})` : ""].filter(Boolean).join(" ")} />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-2">Conveyance :</div>
            <div className="col-span-10">
              <DottedLineField value={""} />
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <div className="inline-block px-10 py-2 border-b-2 border-slate-700 text-[20px] font-bold tracking-wide">DECLARATION</div>
        </div>

        <div className="mt-4 text-[13px] leading-relaxed">
          I the undersigned certify that the above information is correct. I declare that I have personally verified all the
          statements including the date of birth given in the admission form. I further declare that I will not claim any
          correction or alteration in respect of the above said statements as well as date of birth.
        </div>

        <div className="mt-8 grid grid-cols-12 gap-6 text-[14px]">
          <div className="col-span-6">
            <div>Date</div>
            <DottedLineField value={""} />
          </div>
          <div className="col-span-6" />
        </div>

        <div className="mt-10 grid grid-cols-12 text-[14px]">
          <div className="col-span-6">Sign. of Clerk</div>
          <div className="col-span-6 text-right">Sign. of Guardian</div>
        </div>

        {documents.length > 0 ? (
          <>
            <div className="page-break" />
            <div className="mt-0">
              <div className="text-[18px] font-bold text-center">Documents Attached</div>
              <div className="mt-4 space-y-4">
                {documents.map((doc, idx) => (
                  <div key={`${doc.type || "doc"}-${idx}`} className="border border-slate-600 p-3">
                    <div className="flex items-baseline justify-between">
                      <div className="text-[14px] font-semibold">{doc.type || "Document"}</div>
                      <div className="text-[12px]">{doc.documentNumber ? `No: ${doc.documentNumber}` : ""}</div>
                    </div>
                    <div className="mt-3 border border-slate-600 h-[320px] w-full bg-white flex items-center justify-center overflow-hidden">
                      {doc.imageSrc ? (
                        <img src={doc.imageSrc} alt={doc.type || "Document"} className="h-full w-full object-contain" loading="eager" />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}

        <div className="mt-6 text-[10px] text-slate-700">{printedAtText ? `Printed: ${printedAtText}` : " "}</div>
      </div>

      <style jsx>{`
        .page-break {
          break-before: page;
          page-break-before: always;
        }
      `}</style>
    </div>
  )
}